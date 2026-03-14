-- Add appointment_fee to clinics table
-- This is a per-clinic default consultation/booking fee that admins can control
-- and that gets auto-suggested to receptionists when adding payments.
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS appointment_fee numeric NOT NULL DEFAULT 0;

-- Allow admins and admin_doctors to update their own clinic's settings directly.
-- Superadmin already has full access via the existing superadmin policy.
CREATE POLICY "Admins can update clinic settings"
  ON public.clinics
  FOR UPDATE
  TO authenticated
  USING (
    id = public.get_user_clinic_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'admin_doctor')
    )
  )
  WITH CHECK (
    id = public.get_user_clinic_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'admin_doctor')
    )
  );
