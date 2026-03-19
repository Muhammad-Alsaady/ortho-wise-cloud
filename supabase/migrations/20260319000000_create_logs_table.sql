-- Create logs table for multi-tenant logging system
CREATE TABLE IF NOT EXISTS public.logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid,
  level text NOT NULL CHECK (level IN ('INFO', 'WARNING', 'ERROR')),
  action text NOT NULL,
  entity text NOT NULL,
  message text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_logs_clinic_id ON public.logs (clinic_id);
CREATE INDEX idx_logs_created_at ON public.logs (created_at DESC);
CREATE INDEX idx_logs_level ON public.logs (level);

-- Enable RLS
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Superadmin can read all logs (cross-tenant)
CREATE POLICY "superadmin_read_all_logs" ON public.logs
  FOR SELECT
  USING (public.has_role(auth.uid(), 'superadmin'));

-- Admins can read their own clinic's logs
CREATE POLICY "admin_read_clinic_logs" ON public.logs
  FOR SELECT
  USING (
    clinic_id = public.get_user_clinic_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin'))
  );

-- Any authenticated user can insert logs (for their own clinic)
CREATE POLICY "authenticated_insert_logs" ON public.logs
  FOR INSERT
  WITH CHECK (
    clinic_id = public.get_user_clinic_id(auth.uid())
    OR public.has_role(auth.uid(), 'superadmin')
  );
