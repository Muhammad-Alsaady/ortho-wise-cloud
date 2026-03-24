-- Allow payments to be recorded against appointment fees (not just treatment plans)
-- This enables the "Appointment Fee" to appear as a selectable payment item.

-- 1. Make treatment_plan_id nullable
ALTER TABLE public.payments ALTER COLUMN treatment_plan_id DROP NOT NULL;

-- 2. Add appointment_id column for appointment-fee payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE;

-- 3. Ensure exactly one target per payment
ALTER TABLE public.payments ADD CONSTRAINT payments_one_target CHECK (
  (treatment_plan_id IS NOT NULL AND appointment_id IS NULL) OR
  (treatment_plan_id IS NULL AND appointment_id IS NOT NULL)
);

-- 4. Index for appointment_id lookups
CREATE INDEX IF NOT EXISTS idx_payments_appointment_id ON public.payments(appointment_id);

-- 5. Update RLS policies to also allow appointment-based payments
DROP POLICY IF EXISTS "Clinic users can view payments" ON public.payments;
CREATE POLICY "Clinic users can view payments" ON public.payments
  FOR SELECT TO authenticated
  USING (
    (treatment_plan_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.treatment_plans tp
      JOIN public.visits v ON v.id = tp.visit_id
      WHERE tp.id = payments.treatment_plan_id
        AND v.clinic_id = public.get_user_clinic_id(auth.uid())
    ))
    OR
    (appointment_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = payments.appointment_id
        AND a.clinic_id = public.get_user_clinic_id(auth.uid())
    ))
  );

DROP POLICY IF EXISTS "Clinic users can insert payments" ON public.payments;
CREATE POLICY "Clinic users can insert payments" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    (treatment_plan_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.treatment_plans tp
      JOIN public.visits v ON v.id = tp.visit_id
      WHERE tp.id = payments.treatment_plan_id
        AND v.clinic_id = public.get_user_clinic_id(auth.uid())
    ))
    OR
    (appointment_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = payments.appointment_id
        AND a.clinic_id = public.get_user_clinic_id(auth.uid())
    ))
  );

-- 6. Recreate appointment_summary view to include appointment-fee payments
DROP VIEW IF EXISTS public.appointment_summary;
CREATE VIEW public.appointment_summary WITH (security_invoker = true) AS
SELECT
  a.id AS appointment_id,
  a.clinic_id,
  COUNT(DISTINCT tp.id) AS treatment_count,
  COALESCE(SUM(tp.price - tp.discount), 0) + a.appointment_fee AS total_billed,
  COALESCE(SUM(pay_agg.paid), 0) + COALESCE(apt_pay.paid, 0) AS total_paid
FROM public.appointments a
LEFT JOIN public.visits v ON v.appointment_id = a.id
LEFT JOIN public.treatment_plans tp ON tp.visit_id = v.id
LEFT JOIN (
  SELECT treatment_plan_id, SUM(amount) AS paid
  FROM public.payments
  WHERE treatment_plan_id IS NOT NULL
  GROUP BY treatment_plan_id
) pay_agg ON pay_agg.treatment_plan_id = tp.id
LEFT JOIN (
  SELECT appointment_id, SUM(amount) AS paid
  FROM public.payments
  WHERE appointment_id IS NOT NULL
  GROUP BY appointment_id
) apt_pay ON apt_pay.appointment_id = a.id
GROUP BY a.id, a.clinic_id, a.appointment_fee, apt_pay.paid;

-- 7. Recreate patient_balances view to include appointment-fee payments
DROP VIEW IF EXISTS public.patient_balances;
CREATE VIEW public.patient_balances WITH (security_invoker = true) AS
SELECT pt.clinic_id, pt.id AS patient_id, pt.name AS patient_name, pt.phone,
  COALESCE(SUM(tp.price - tp.discount), 0) + COALESCE(appt_fees.total_fees, 0) AS total_billed,
  COALESCE(SUM(pay_agg.paid), 0) + COALESCE(apt_fee_pay.total_paid, 0) AS total_paid,
  COALESCE(SUM(tp.price - tp.discount), 0) + COALESCE(appt_fees.total_fees, 0)
    - COALESCE(SUM(pay_agg.paid), 0) - COALESCE(apt_fee_pay.total_paid, 0) AS balance
FROM public.patients pt
LEFT JOIN public.appointments a ON a.patient_id = pt.id
LEFT JOIN public.visits v ON v.appointment_id = a.id
LEFT JOIN public.treatment_plans tp ON tp.visit_id = v.id
LEFT JOIN (
  SELECT treatment_plan_id, SUM(amount) AS paid
  FROM public.payments
  WHERE treatment_plan_id IS NOT NULL
  GROUP BY treatment_plan_id
) pay_agg ON pay_agg.treatment_plan_id = tp.id
LEFT JOIN (
  SELECT patient_id, SUM(appointment_fee) AS total_fees
  FROM public.appointments
  WHERE status != 'Cancelled'
  GROUP BY patient_id
) appt_fees ON appt_fees.patient_id = pt.id
LEFT JOIN (
  SELECT a2.patient_id, SUM(p.amount) AS total_paid
  FROM public.payments p
  JOIN public.appointments a2 ON a2.id = p.appointment_id
  WHERE p.appointment_id IS NOT NULL
  GROUP BY a2.patient_id
) apt_fee_pay ON apt_fee_pay.patient_id = pt.id
GROUP BY pt.clinic_id, pt.id, pt.name, pt.phone, appt_fees.total_fees, apt_fee_pay.total_paid;
