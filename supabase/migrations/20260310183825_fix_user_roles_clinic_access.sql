-- ============================================================
-- Fix user_roles RLS to allow clinic users to see each other's roles
-- Currently reception users can only see their own role, which prevents
-- them from querying who are the doctors in their clinic.
-- ============================================================

-- Allow all clinic users to read roles of other users in the same clinic
CREATE POLICY "Clinic users can view clinic user roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p1
    JOIN public.profiles p2 ON p2.clinic_id = p1.clinic_id
    WHERE p1.user_id = auth.uid()
      AND p2.user_id = user_roles.user_id
  )
);