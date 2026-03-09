import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify user
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!,
      { global: { headers: { Authorization: authHeader } }, auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    // Check role - only admins and superadmins can export
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    const roleNames = (roles || []).map((r: { role: string }) => r.role);
    if (!roleNames.includes('admin') && !roleNames.includes('superadmin')) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    // Get user's clinic
    const { data: profile } = await supabaseAdmin.from('profiles').select('clinic_id').eq('user_id', user.id).single();
    if (!profile) {
      return new Response(JSON.stringify({ error: 'No clinic found' }), { status: 404, headers: corsHeaders });
    }

    const clinicId = profile.clinic_id;

    // Export all clinic data
    const [patients, appointments, visits, treatmentPlans, payments, treatments] = await Promise.all([
      supabaseAdmin.from('patients').select('*').eq('clinic_id', clinicId),
      supabaseAdmin.from('appointments').select('*').eq('clinic_id', clinicId),
      supabaseAdmin.from('visits').select('*').eq('clinic_id', clinicId),
      supabaseAdmin.from('treatment_plans').select('*, visits!inner(clinic_id)').eq('visits.clinic_id', clinicId),
      supabaseAdmin.from('payments').select('*, treatment_plans!inner(visit_id, visits!inner(clinic_id))'),
      supabaseAdmin.from('treatments').select('*').eq('clinic_id', clinicId),
    ]);

    const backup = {
      exported_at: new Date().toISOString(),
      clinic_id: clinicId,
      data: {
        patients: patients.data || [],
        appointments: appointments.data || [],
        visits: visits.data || [],
        treatment_plans: treatmentPlans.data || [],
        payments: payments.data || [],
        treatments: treatments.data || [],
      },
    };

    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="clinic-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
