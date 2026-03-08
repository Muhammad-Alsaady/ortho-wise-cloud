
ALTER TABLE public.appointments 
  ALTER COLUMN patient_id DROP NOT NULL,
  ADD COLUMN patient_name text,
  ADD COLUMN patient_phone text;
