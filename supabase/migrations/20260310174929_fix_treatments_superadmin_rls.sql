-- ============================================================
-- Fix treatments RLS policies for superadmin access
-- Superadmins have clinic_id = NULL, so the existing policy
-- `clinic_id = get_user_clinic_id(auth.uid())` fails for them.
-- We need a separate policy that grants superadmins access to all treatments.
-- ============================================================

-- Drop the existing combined policy that's causing issues
DROP POLICY IF EXISTS "Admins can manage treatments" ON public.treatments;

-- Create separate policies: one for superadmin (all access), one for admin (clinic-scoped)
CREATE POLICY "Superadmins can manage all treatments"
  ON public.treatments
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admins can manage clinic treatments"
  ON public.treatments
  FOR ALL
  TO authenticated
  USING (
    clinic_id = public.get_user_clinic_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  );

-- Keep the view policy for all clinic users (including admins and superadmins)
-- But also add an explicit superadmin SELECT policy for clarity
CREATE POLICY "Superadmins can view all treatments"
  ON public.treatments
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));