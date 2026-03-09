
DROP POLICY IF EXISTS "Auth users can upload treatment images" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can view treatment images" ON storage.objects;

CREATE POLICY "Clinic users can upload own treatment images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'treatment-images' AND
    (storage.foldername(name))[1] = get_user_clinic_id(auth.uid())::text
  );

CREATE POLICY "Clinic users can view own treatment images" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'treatment-images' AND
    (storage.foldername(name))[1] = get_user_clinic_id(auth.uid())::text
  );
