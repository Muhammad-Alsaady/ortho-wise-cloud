import { supabase } from '@/integrations/supabase/client';

/**
 * Reusable helper for calling the manage-user Edge Function.
 * Uses supabase.functions.invoke() so the Authorization + apikey headers
 * are injected automatically from the active session.
 */
export const callManageUser = async (action: string, payload: Record<string, any> = {}) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User must be logged in before calling manage-user function');

  const { data, error } = await supabase.functions.invoke('manage-user', {
    body: { action, ...payload },
  });

  if (error) {
    // FunctionsHttpError.context is the raw Response; extract the real message from the body
    if (error.context instanceof Response) {
      try {
        const body = await (error.context as Response).clone().json();
        throw new Error(body?.error || error.message);
      } catch (parseErr: any) {
        // if parseErr is already our re-thrown error, rethrow it
        if (parseErr.message !== error.message) throw parseErr;
      }
    }
    throw new Error(error.message);
  }

  // Edge function may return { error: '...' } with status 200 in some cases
  if (data?.error) throw new Error(data.error);

  return data;
};

/** @deprecated Use callManageUser instead */
export const invokeManageUser = (body: Record<string, any>) => {
  const { action, ...rest } = body;
  return callManageUser(action, rest);
};
