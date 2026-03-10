-- ============================================================
-- Fix 1: Make profiles.clinic_id nullable
-- Superadmin users don't belong to any specific clinic,
-- so they can't have a non-null clinic_id.
-- ============================================================
ALTER TABLE public.profiles
  ALTER COLUMN clinic_id DROP NOT NULL;

-- ============================================================
-- Fix 2: Rebuild profile RLS policies to support superadmin
-- with null clinic_id. The original policy for superadmin was:
--   clinic_id = get_user_clinic_id(auth.uid()) AND (has_role..superadmin..)
-- That AND means superadmin is still blocked when clinic_id is NULL.
-- We rebuild it as a separate, unconditional superadmin policy.
-- ============================================================
DROP POLICY IF EXISTS "Admins can manage clinic profiles" ON public.profiles;

-- Superadmins can do anything on any profile
CREATE POLICY "Superadmins can manage all profiles"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

-- Admins can manage profiles within their own clinic only
CREATE POLICY "Admins can manage clinic profiles"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (
    clinic_id = public.get_user_clinic_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  );

-- ============================================================
-- Fix 3: Fix audit_logs INSERT policy so superadmin can log
-- The original check: clinic_id = get_user_clinic_id(auth.uid())
-- fails when superadmin's clinic_id is NULL.
-- ============================================================
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    clinic_id = public.get_user_clinic_id(auth.uid())
    OR public.has_role(auth.uid(), 'superadmin')
  );

-- ============================================================
-- Fix 4: Add explicit INSERT policy for user_roles so that
-- the edge function (service role) can create roles — this
-- already works via service role, but add it for direct usage.
-- Also allow superadmin to manage all roles via direct client
-- (they previously only had the SELECT policy).
-- ============================================================
-- The existing "Superadmins manage all roles" covers FOR ALL,
-- but let's make sure it exists and covers INSERT:
DROP POLICY IF EXISTS "Superadmins manage all roles" ON public.user_roles;

CREATE POLICY "Superadmins manage all roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- ============================================================
-- Fix 5: Allow admins to INSERT user_roles for their clinic
-- (so the edge function path is not the only option).
-- ============================================================
CREATE POLICY "Admins can manage clinic user roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = user_roles.user_id
        AND p.clinic_id = public.get_user_clinic_id(auth.uid())
    )
    AND public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = user_roles.user_id
        AND p.clinic_id = public.get_user_clinic_id(auth.uid())
    )
    AND public.has_role(auth.uid(), 'admin')
  );

-- ============================================================
-- Fix 6: Update get_user_clinic_id to return NULL safely
-- (already returns NULL when no row, but marking clearly)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_clinic_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT clinic_id FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;
