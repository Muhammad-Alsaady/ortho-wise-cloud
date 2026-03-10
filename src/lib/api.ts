import { supabase } from '@/integrations/supabase/client';

/**
 * Reusable helper for calling the manage-user Edge Function.
 * Explicitly fetches the session so the Authorization header is
 * always present regardless of SDK internal state.
 */
export const callManageUser = async (action: string, payload: Record<string, any> = {}) => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw new Error('Not authenticated. Please log in again.');

  const { data, error } = await supabase.functions.invoke('manage-user', {
    body: { action, ...payload },
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
  });

  if (error) {
    // Try to extract the real error message from the response body.
    // Use a timeout so we never hang indefinitely.
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
        // If we extracted a real message, propagate it
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
