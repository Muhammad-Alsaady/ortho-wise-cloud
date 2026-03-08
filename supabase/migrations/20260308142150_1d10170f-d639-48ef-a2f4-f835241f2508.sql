
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('superadmin', 'admin', 'doctor', 'reception');
CREATE TYPE public.appointment_status AS ENUM ('Booked', 'Waiting', 'WithDoctor', 'Completed', 'Cancelled');
CREATE TYPE public.visit_status AS ENUM ('InProgress', 'Completed');

-- CLINICS
CREATE TABLE public.clinics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  license_key TEXT,
  license_expiry TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_profiles_clinic_id ON public.profiles(clinic_id);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);

-- get_user_clinic_id (after profiles table exists)
CREATE OR REPLACE FUNCTION public.get_user_clinic_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT clinic_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- PATIENTS
CREATE TABLE public.patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  age INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_patients_clinic_id ON public.patients(clinic_id);
CREATE INDEX idx_patients_name ON public.patients(name);
CREATE INDEX idx_patients_phone ON public.patients(phone);

-- APPOINTMENTS
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status appointment_status NOT NULL DEFAULT 'Booked',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_appointments_clinic_id ON public.appointments(clinic_id);
CREATE INDEX idx_appointments_doctor_id ON public.appointments(doctor_id);
CREATE INDEX idx_appointments_patient_id ON public.appointments(patient_id);
CREATE INDEX idx_appointments_date ON public.appointments(appointment_date);
CREATE INDEX idx_appointments_status ON public.appointments(status);

-- VISITS
CREATE TABLE public.visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notes TEXT,
  status visit_status NOT NULL DEFAULT 'InProgress',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_visits_clinic_id ON public.visits(clinic_id);
CREATE INDEX idx_visits_appointment_id ON public.visits(appointment_id);
CREATE INDEX idx_visits_doctor_id ON public.visits(doctor_id);

-- TREATMENTS
CREATE TABLE public.treatments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_treatments_clinic_id ON public.treatments(clinic_id);

-- TREATMENT PLANS
CREATE TABLE public.treatment_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  treatment_id UUID NOT NULL REFERENCES public.treatments(id) ON DELETE RESTRICT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_treatment_plans_visit_id ON public.treatment_plans(visit_id);
CREATE INDEX idx_treatment_plans_treatment_id ON public.treatment_plans(treatment_id);

-- PAYMENTS
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  treatment_plan_id UUID NOT NULL REFERENCES public.treatment_plans(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_payments_treatment_plan_id ON public.payments(treatment_plan_id);

-- TREATMENT IMAGES
CREATE TABLE public.treatment_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  treatment_plan_id UUID NOT NULL REFERENCES public.treatment_plans(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.treatment_images ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_treatment_images_treatment_plan_id ON public.treatment_images(treatment_plan_id);

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_logs_clinic_id ON public.audit_logs(clinic_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Clinics
CREATE POLICY "Superadmins can manage all clinics" ON public.clinics FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Users can view own clinic" ON public.clinics FOR SELECT TO authenticated USING (id = public.get_user_clinic_id(auth.uid()));

-- User roles
CREATE POLICY "Superadmins manage all roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Profiles
CREATE POLICY "Users can view profiles in own clinic" ON public.profiles FOR SELECT TO authenticated USING (clinic_id = public.get_user_clinic_id(auth.uid()) OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage clinic profiles" ON public.profiles FOR ALL TO authenticated USING (clinic_id = public.get_user_clinic_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin')));

-- Patients
CREATE POLICY "Clinic users can view patients" ON public.patients FOR SELECT TO authenticated USING (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY "Clinic users can insert patients" ON public.patients FOR INSERT TO authenticated WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY "Clinic users can update patients" ON public.patients FOR UPDATE TO authenticated USING (clinic_id = public.get_user_clinic_id(auth.uid()));

-- Appointments
CREATE POLICY "Clinic users can view appointments" ON public.appointments FOR SELECT TO authenticated USING (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY "Clinic users can insert appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY "Clinic users can update appointments" ON public.appointments FOR UPDATE TO authenticated USING (clinic_id = public.get_user_clinic_id(auth.uid()));

-- Visits
CREATE POLICY "Clinic users can view visits" ON public.visits FOR SELECT TO authenticated USING (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY "Clinic users can insert visits" ON public.visits FOR INSERT TO authenticated WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY "Clinic users can update visits" ON public.visits FOR UPDATE TO authenticated USING (clinic_id = public.get_user_clinic_id(auth.uid()));

-- Treatments
CREATE POLICY "Clinic users can view treatments" ON public.treatments FOR SELECT TO authenticated USING (clinic_id = public.get_user_clinic_id(auth.uid()));
CREATE POLICY "Admins can manage treatments" ON public.treatments FOR ALL TO authenticated USING (clinic_id = public.get_user_clinic_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin')));

-- Treatment plans (via visit)
CREATE POLICY "Clinic users can view treatment plans" ON public.treatment_plans FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.visits v WHERE v.id = treatment_plans.visit_id AND v.clinic_id = public.get_user_clinic_id(auth.uid())));
CREATE POLICY "Clinic users can insert treatment plans" ON public.treatment_plans FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.visits v WHERE v.id = treatment_plans.visit_id AND v.clinic_id = public.get_user_clinic_id(auth.uid())));
CREATE POLICY "Clinic users can update treatment plans" ON public.treatment_plans FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.visits v WHERE v.id = treatment_plans.visit_id AND v.clinic_id = public.get_user_clinic_id(auth.uid())));

-- Payments (via treatment_plan → visit)
CREATE POLICY "Clinic users can view payments" ON public.payments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.treatment_plans tp JOIN public.visits v ON v.id = tp.visit_id WHERE tp.id = payments.treatment_plan_id AND v.clinic_id = public.get_user_clinic_id(auth.uid())));
CREATE POLICY "Clinic users can insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.treatment_plans tp JOIN public.visits v ON v.id = tp.visit_id WHERE tp.id = payments.treatment_plan_id AND v.clinic_id = public.get_user_clinic_id(auth.uid())));

-- Treatment images (via treatment_plan → visit)
CREATE POLICY "Clinic users can view treatment images" ON public.treatment_images FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.treatment_plans tp JOIN public.visits v ON v.id = tp.visit_id WHERE tp.id = treatment_images.treatment_plan_id AND v.clinic_id = public.get_user_clinic_id(auth.uid())));
CREATE POLICY "Clinic users can insert treatment images" ON public.treatment_images FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.treatment_plans tp JOIN public.visits v ON v.id = tp.visit_id WHERE tp.id = treatment_images.treatment_plan_id AND v.clinic_id = public.get_user_clinic_id(auth.uid())));

-- Audit logs
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING ((clinic_id = public.get_user_clinic_id(auth.uid()) AND public.has_role(auth.uid(), 'admin')) OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (clinic_id = public.get_user_clinic_id(auth.uid()));

-- ============================================
-- REPORTING VIEWS
-- ============================================

CREATE OR REPLACE VIEW public.daily_revenue AS
SELECT v.clinic_id, pay.created_at::date AS revenue_date, SUM(pay.amount) AS total_revenue, COUNT(DISTINCT pay.id) AS payment_count
FROM public.payments pay
JOIN public.treatment_plans tp ON tp.id = pay.treatment_plan_id
JOIN public.visits v ON v.id = tp.visit_id
GROUP BY v.clinic_id, pay.created_at::date;

CREATE OR REPLACE VIEW public.doctor_performance AS
SELECT v.clinic_id, v.doctor_id, p.name AS doctor_name, COUNT(DISTINCT v.id) AS total_visits, COUNT(DISTINCT tp.id) AS total_treatments,
  COALESCE(SUM(tp.price - tp.discount), 0) AS total_billed, COALESCE(SUM(pay_agg.paid), 0) AS total_collected
FROM public.visits v
JOIN public.profiles p ON p.id = v.doctor_id
LEFT JOIN public.treatment_plans tp ON tp.visit_id = v.id
LEFT JOIN (SELECT treatment_plan_id, SUM(amount) AS paid FROM public.payments GROUP BY treatment_plan_id) pay_agg ON pay_agg.treatment_plan_id = tp.id
GROUP BY v.clinic_id, v.doctor_id, p.name;

CREATE OR REPLACE VIEW public.patient_balances AS
SELECT pt.clinic_id, pt.id AS patient_id, pt.name AS patient_name, pt.phone,
  COALESCE(SUM(tp.price - tp.discount), 0) AS total_billed, COALESCE(SUM(pay_agg.paid), 0) AS total_paid,
  COALESCE(SUM(tp.price - tp.discount), 0) - COALESCE(SUM(pay_agg.paid), 0) AS balance
FROM public.patients pt
LEFT JOIN public.appointments a ON a.patient_id = pt.id
LEFT JOIN public.visits v ON v.appointment_id = a.id
LEFT JOIN public.treatment_plans tp ON tp.visit_id = v.id
LEFT JOIN (SELECT treatment_plan_id, SUM(amount) AS paid FROM public.payments GROUP BY treatment_plan_id) pay_agg ON pay_agg.treatment_plan_id = tp.id
GROUP BY pt.clinic_id, pt.id, pt.name, pt.phone;

-- UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES ('treatment-images', 'treatment-images', false);
CREATE POLICY "Auth users can upload treatment images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'treatment-images');
CREATE POLICY "Auth users can view treatment images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'treatment-images');
