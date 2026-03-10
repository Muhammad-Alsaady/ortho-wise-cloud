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

  if (error) throw error;
  return data;
};

/** @deprecated Use callManageUser instead */
export const invokeManageUser = (body: Record<string, any>) => {
  const { action, ...rest } = body;
  return callManageUser(action, rest);
};
