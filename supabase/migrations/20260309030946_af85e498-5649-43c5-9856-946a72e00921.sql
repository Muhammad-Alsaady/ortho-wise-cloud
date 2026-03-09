
-- appointment_summary view to fix N+1 queries
CREATE VIEW public.appointment_summary WITH (security_invoker = true) AS
SELECT
  a.id AS appointment_id,
  a.clinic_id,
  COUNT(DISTINCT tp.id) AS treatment_count,
  COALESCE(SUM(tp.price - tp.discount), 0) AS total_billed,
  COALESCE(SUM(pay_agg.paid), 0) AS total_paid
FROM public.appointments a
LEFT JOIN public.visits v ON v.appointment_id = a.id
LEFT JOIN public.treatment_plans tp ON tp.visit_id = v.id
LEFT JOIN (
  SELECT treatment_plan_id, SUM(amount) AS paid FROM public.payments GROUP BY treatment_plan_id
) pay_agg ON pay_agg.treatment_plan_id = tp.id
GROUP BY a.id, a.clinic_id;

-- Allow deletion of treatment plans (needed for remove treatment from visit)
CREATE POLICY "Clinic users can delete treatment plans"
ON public.treatment_plans
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM visits v WHERE v.id = treatment_plans.visit_id AND v.clinic_id = get_user_clinic_id(auth.uid())
));

-- Allow deletion of treatments from catalog
CREATE POLICY "Admins can delete treatments"
ON public.treatments
FOR DELETE
TO authenticated
USING (
  clinic_id = get_user_clinic_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role))
);
