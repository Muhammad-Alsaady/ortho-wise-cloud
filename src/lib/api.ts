import { supabase } from '@/integrations/supabase/client';

// ─── Auth-error detection ────────────────────────────────────────────

/** Check if an error looks like an auth/JWT problem */
export const isAuthError = (err: any): boolean => {
  const msg = String(err?.message || err || '').toLowerCase();
  const code = String(err?.code || '');
  return (
    /jwt|invalid.?token|token.?expired|unauthorized|not authenticated|session.?expired/i.test(msg) ||
    msg.includes('401') ||
    code === 'PGRST301'
  );
};

// Guard to prevent multiple simultaneous logouts
let _loggingOut = false;

/** Force-clear the session and redirect to login */
export const forceLogout = async () => {
  if (_loggingOut) return;
  _loggingOut = true;

  // ALWAYS clear localStorage first — even if signOut hangs
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('sb-')) localStorage.removeItem(k);
    });
  } catch { /* ignore */ }

  // Best-effort signOut (may already be invalid)
  try {
    await supabase.auth.signOut();
  } catch { /* ignore */ }

  window.location.replace('/');
};

// ─── Query helpers ───────────────────────────────────────────────────

/**
 * Check a Supabase error and auto-logout if auth-related.
 * Returns true if it was an auth error (caller should abort).
 */
export const checkAuthError = (error: any, context?: string): boolean => {
  if (!error) return false;
  console.error(`[${context || 'DB'}]`, error.message || error);
  if (isAuthError(error)) {
    console.error(`[${context || 'DB'}] Auth error detected — forcing logout`);
    forceLogout();
    return true;
  }
  return false;
};

/**
 * Wrap any async operation: auto-logout on auth errors, re-throw others.
 */
export const safeAsync = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (err: any) {
    if (isAuthError(err)) {
      console.error('[safeAsync] Auth error detected, logging out:', err);
      await forceLogout();
    }
    throw err;
  }
};

/** Turn a Supabase { error } response into a thrown Error */
export const handleSupabaseError = (error: any, context?: string) => {
  if (!error) return;
  if (checkAuthError(error, context)) return;
  throw new Error(error.message || 'Unknown database error');
};

// ─── Edge Function helper ────────────────────────────────────────────

/**
 * Reusable helper for calling the manage-user Edge Function.
 * Explicitly fetches the session so the Authorization header is
 * always present regardless of SDK internal state.
 */
export const callManageUser = async (action: string, payload: Record<string, any> = {}) => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    await forceLogout();
    throw new Error('Not authenticated. Please log in again.');
  }

  const { data, error } = await supabase.functions.invoke('manage-user', {
    body: { action, ...payload },
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
  });

  if (error) {
    if (isAuthError(error)) {
      console.error('[callManageUser] Auth error, forcing logout');
      await forceLogout();
      throw error;
    }

    // Try to extract the real error message from the response body.
    const ctx = (error as any).context;
    if (ctx instanceof Response && !ctx.bodyUsed) {
      try {
        const bodyText = await Promise.race<string>([
          ctx.text(),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 3000)
          ),
        ]);
        const body = JSON.parse(bodyText);
        const realMessage = body?.error || body?.message;
        if (realMessage) throw new Error(realMessage);
      } catch (parseErr: any) {
        if (parseErr.message !== error.message) throw parseErr;
      }
    }
    throw new Error(error.message);
  }

  // Guard against edge function returning { error } with status 200
  if (data?.error) throw new Error(data.error);

  return data;
};

/** @deprecated Use callManageUser instead */
export const invokeManageUser = (body: Record<string, any>) => {
  const { action, ...rest } = body;
  return callManageUser(action, rest);
};
