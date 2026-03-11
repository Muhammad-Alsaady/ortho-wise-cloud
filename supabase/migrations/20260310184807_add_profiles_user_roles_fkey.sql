-- ============================================================
-- Add explicit foreign key relationship between profiles and user_roles
-- This allows Supabase to understand the relationship in schema cache
-- and enables JOIN queries to work properly in the client
-- ============================================================

-- Add foreign key constraint from user_roles.user_id to profiles.user_id
-- This establishes the relationship that Supabase needs to recognize
ALTER TABLE public.user_roles
ADD CONSTRAINT fk_user_roles_profiles_user_id
FOREIGN KEY (user_id) 
REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Add index for performance on the foreign key
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);