import { supabase } from '@/integrations/supabase/client';

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? 'mdcwkvsdkclwzqxxetiw';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kY3drdnNka2Nsd3pxeHhldGl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMjgyMjksImV4cCI6MjA4ODYwNDIyOX0.lfZ78KdMGKK51pWxe8oN7BNx4U09LnDUMXdecFb0qNs';

export const invokeManageUser = async (body: Record<string, any>) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const res = await fetch(`https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/manage-user`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};
