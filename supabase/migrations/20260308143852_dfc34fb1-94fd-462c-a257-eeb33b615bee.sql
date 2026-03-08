-- Enable realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.treatment_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.visits;

-- Add plan_type to clinics
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS plan_type text DEFAULT 'basic';

-- Create audit log trigger function
CREATE OR REPLACE FUNCTION public.fn_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _clinic_id uuid;
  _details jsonb;
BEGIN
  _user_id := auth.uid();

  IF TG_OP = 'INSERT' THEN
    _details := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    _details := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    _details := to_jsonb(OLD);
  END IF;

  _clinic_id := get_user_clinic_id(_user_id);

  INSERT INTO public.audit_logs (user_id, clinic_id, action, entity_type, entity_id, details)
  VALUES (_user_id, _clinic_id, TG_ARGV[0], TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), _details);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Audit triggers
CREATE TRIGGER audit_payments_insert AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION fn_audit_log('payment_created');
CREATE TRIGGER audit_treatments_update AFTER UPDATE ON public.treatments FOR EACH ROW EXECUTE FUNCTION fn_audit_log('treatment_updated');
CREATE TRIGGER audit_treatments_insert AFTER INSERT ON public.treatments FOR EACH ROW EXECUTE FUNCTION fn_audit_log('treatment_created');
CREATE TRIGGER audit_appointments_update AFTER UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION fn_audit_log('appointment_updated');
CREATE TRIGGER audit_appointments_insert AFTER INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION fn_audit_log('appointment_created');
CREATE TRIGGER audit_treatment_plans_insert AFTER INSERT ON public.treatment_plans FOR EACH ROW EXECUTE FUNCTION fn_audit_log('treatment_plan_created');
CREATE TRIGGER audit_treatment_plans_update AFTER UPDATE ON public.treatment_plans FOR EACH ROW EXECUTE FUNCTION fn_audit_log('treatment_plan_updated');

-- Monthly revenue view
CREATE OR REPLACE VIEW public.monthly_revenue WITH (security_invoker = true) AS
SELECT v.clinic_id, date_trunc('month', p.created_at)::date AS revenue_month, SUM(p.amount) AS total_revenue, COUNT(p.id) AS payment_count
FROM payments p JOIN treatment_plans tp ON tp.id = p.treatment_plan_id JOIN visits v ON v.id = tp.visit_id
GROUP BY v.clinic_id, date_trunc('month', p.created_at);

-- Treatment popularity view
CREATE OR REPLACE VIEW public.treatment_popularity WITH (security_invoker = true) AS
SELECT v.clinic_id, t.id AS treatment_id, t.name AS treatment_name, COUNT(tp.id) AS usage_count, SUM(tp.price - tp.discount) AS total_revenue
FROM treatment_plans tp JOIN treatments t ON t.id = tp.treatment_id JOIN visits v ON v.id = tp.visit_id
GROUP BY v.clinic_id, t.id, t.name;