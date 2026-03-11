-- ============================================================
-- Add admin_doctor role and update treatment access policies
-- Clinic owners/lead doctors should have both doctor and admin capabilities
-- ============================================================

-- Add new admin_doctor role to the enum
ALTER TYPE public.app_role ADD VALUE 'admin_doctor';

-- Update treatments RLS policies to include admin_doctor
-- Drop and recreate to include the new role

-- Allow admin_doctors to manage treatments in their clinic
CREATE POLICY "Admin doctors can manage clinic treatments"
  ON public.treatments
  FOR ALL
  TO authenticated
  USING (
    clinic_id = public.get_user_clinic_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin') 
      OR public.has_role(auth.uid(), 'admin_doctor')
    )
  );

-- Update other relevant policies for admin_doctor role
-- User management: admin_doctors can create users in their clinic
CREATE POLICY "Admin doctors can manage clinic user roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = user_roles.user_id
        AND p.clinic_id = public.get_user_clinic_id(auth.uid())
    )
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'admin_doctor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = user_roles.user_id
        AND p.clinic_id = public.get_user_clinic_id(auth.uid())
    )
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'admin_doctor')
    )
  );