
-- Fix security definer views by recreating as security invoker
DROP VIEW IF EXISTS public.daily_revenue;
DROP VIEW IF EXISTS public.doctor_performance;
DROP VIEW IF EXISTS public.patient_balances;

CREATE VIEW public.daily_revenue WITH (security_invoker = true) AS
SELECT v.clinic_id, pay.created_at::date AS revenue_date, SUM(pay.amount) AS total_revenue, COUNT(DISTINCT pay.id) AS payment_count
FROM public.payments pay
JOIN public.treatment_plans tp ON tp.id = pay.treatment_plan_id
JOIN public.visits v ON v.id = tp.visit_id
GROUP BY v.clinic_id, pay.created_at::date;

CREATE VIEW public.doctor_performance WITH (security_invoker = true) AS
SELECT v.clinic_id, v.doctor_id, p.name AS doctor_name, COUNT(DISTINCT v.id) AS total_visits, COUNT(DISTINCT tp.id) AS total_treatments,
  COALESCE(SUM(tp.price - tp.discount), 0) AS total_billed, COALESCE(SUM(pay_agg.paid), 0) AS total_collected
FROM public.visits v
JOIN public.profiles p ON p.id = v.doctor_id
LEFT JOIN public.treatment_plans tp ON tp.visit_id = v.id
LEFT JOIN (SELECT treatment_plan_id, SUM(amount) AS paid FROM public.payments GROUP BY treatment_plan_id) pay_agg ON pay_agg.treatment_plan_id = tp.id
GROUP BY v.clinic_id, v.doctor_id, p.name;

CREATE VIEW public.patient_balances WITH (security_invoker = true) AS
SELECT pt.clinic_id, pt.id AS patient_id, pt.name AS patient_name, pt.phone,
  COALESCE(SUM(tp.price - tp.discount), 0) AS total_billed, COALESCE(SUM(pay_agg.paid), 0) AS total_paid,
  COALESCE(SUM(tp.price - tp.discount), 0) - COALESCE(SUM(pay_agg.paid), 0) AS balance
FROM public.patients pt
LEFT JOIN public.appointments a ON a.patient_id = pt.id
LEFT JOIN public.visits v ON v.appointment_id = a.id
LEFT JOIN public.treatment_plans tp ON tp.visit_id = v.id
LEFT JOIN (SELECT treatment_plan_id, SUM(amount) AS paid FROM public.payments GROUP BY treatment_plan_id) pay_agg ON pay_agg.treatment_plan_id = tp.id
GROUP BY pt.clinic_id, pt.id, pt.name, pt.phone;
