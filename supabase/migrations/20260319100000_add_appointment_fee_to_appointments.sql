-- Add appointment_fee to individual appointments (auto-set from clinic default)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS appointment_fee numeric NOT NULL DEFAULT 0;

-- Backfill existing appointments with their clinic's current fee
UPDATE public.appointments a
SET appointment_fee = c.appointment_fee
FROM public.clinics c
WHERE a.clinic_id = c.id
  AND a.appointment_fee = 0
  AND c.appointment_fee > 0;

-- Recreate appointment_summary view to include appointment fee in total_billed
DROP VIEW IF EXISTS public.appointment_summary;
CREATE VIEW public.appointment_summary WITH (security_invoker = true) AS
SELECT
  a.id AS appointment_id,
  a.clinic_id,
  COUNT(DISTINCT tp.id) AS treatment_count,
  COALESCE(SUM(tp.price - tp.discount), 0) + a.appointment_fee AS total_billed,
  COALESCE(SUM(pay_agg.paid), 0) AS total_paid
FROM public.appointments a
LEFT JOIN public.visits v ON v.appointment_id = a.id
LEFT JOIN public.treatment_plans tp ON tp.visit_id = v.id
LEFT JOIN (
  SELECT treatment_plan_id, SUM(amount) AS paid FROM public.payments GROUP BY treatment_plan_id
) pay_agg ON pay_agg.treatment_plan_id = tp.id
GROUP BY a.id, a.clinic_id, a.appointment_fee;

-- Recreate patient_balances view to include appointment fees
DROP VIEW IF EXISTS public.patient_balances;
CREATE VIEW public.patient_balances WITH (security_invoker = true) AS
SELECT pt.clinic_id, pt.id AS patient_id, pt.name AS patient_name, pt.phone,
  COALESCE(SUM(tp.price - tp.discount), 0) + COALESCE(appt_fees.total_fees, 0) AS total_billed,
  COALESCE(SUM(pay_agg.paid), 0) AS total_paid,
  COALESCE(SUM(tp.price - tp.discount), 0) + COALESCE(appt_fees.total_fees, 0) - COALESCE(SUM(pay_agg.paid), 0) AS balance
FROM public.patients pt
LEFT JOIN public.appointments a ON a.patient_id = pt.id
LEFT JOIN public.visits v ON v.appointment_id = a.id
LEFT JOIN public.treatment_plans tp ON tp.visit_id = v.id
LEFT JOIN (SELECT treatment_plan_id, SUM(amount) AS paid FROM public.payments GROUP BY treatment_plan_id) pay_agg
  ON pay_agg.treatment_plan_id = tp.id
LEFT JOIN (
  SELECT patient_id, SUM(appointment_fee) AS total_fees
  FROM public.appointments
  WHERE status != 'Cancelled'
  GROUP BY patient_id
) appt_fees ON appt_fees.patient_id = pt.id
GROUP BY pt.clinic_id, pt.id, pt.name, pt.phone, appt_fees.total_fees;
