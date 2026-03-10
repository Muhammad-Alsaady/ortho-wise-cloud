import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Hardcoded to the correct project — do NOT use env vars here because
// Vercel may have stale values from the old project (ypzkmygbgkjzzcccxnet)
// which causes "Invalid JWT" errors on the edge function.
const SUPABASE_URL = 'https://mdcwkvsdkclwzqxxetiw.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kY3drdnNka2Nsd3pxeHhldGl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMjgyMjksImV4cCI6MjA4ODYwNDIyOX0.lfZ78KdMGKK51pWxe8oN7BNx4U09LnDUMXdecFb0qNs';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});