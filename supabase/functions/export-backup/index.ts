import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allow only the configured origin (set ALLOWED_ORIGIN in Supabase Edge Function secrets)
const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "";

function headers(origin: string | null) {
  const allow = allowedOrigin && origin === allowedOrigin ? origin : allowedOrigin;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = headers(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify user via getUser() — cryptographic verification against the Auth server
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } }, auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: headers });
    }

    // Check role - only admins and superadmins can export
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    const roleNames = (roles || []).map((r: { role: string }) => r.role);
    if (!roleNames.includes('admin') && !roleNames.includes('superadmin')) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: headers });
    }

    // Get user's clinic
    const { data: profile } = await supabaseAdmin.from('profiles').select('clinic_id').eq('user_id', user.id).single();
    if (!profile) {
      return new Response(JSON.stringify({ error: 'No clinic found' }), { status: 404, headers: headers });
    }

    const clinicId = profile.clinic_id;

    // Export all clinic data
    const [patients, appointments, visits, treatmentPlans, treatments] = await Promise.all([
      supabaseAdmin.from('patients').select('*').eq('clinic_id', clinicId),
      supabaseAdmin.from('appointments').select('*').eq('clinic_id', clinicId),
      supabaseAdmin.from('visits').select('*').eq('clinic_id', clinicId),
      supabaseAdmin.from('treatment_plans').select('*, visits!inner(clinic_id)').eq('visits.clinic_id', clinicId),
      supabaseAdmin.from('treatments').select('*').eq('clinic_id', clinicId),
    ]);

    // Scope payments strictly to this clinic's treatment plans (payments has no clinic_id column)
    const tpIds = (treatmentPlans.data || []).map((tp: { id: string }) => tp.id);
    const payments = tpIds.length > 0
      ? await supabaseAdmin.from('payments').select('*').in('treatment_plan_id', tpIds)
      : { data: [] };

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
        ...headers,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="clinic-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: headers });
  }
});
