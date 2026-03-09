import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Not authenticated");

    // Get caller roles
    const { data: callerRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const roles = (callerRoles || []).map((r: any) => r.role);
    const isSuperadmin = roles.includes("superadmin");
    const isAdmin = roles.includes("admin");

    if (!isSuperadmin && !isAdmin) throw new Error("Unauthorized");

    // Get caller's clinic_id (for admin scoping)
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("clinic_id")
      .eq("user_id", caller.id)
      .single();

    const callerClinicId = callerProfile?.clinic_id;

    const { action, ...payload } = await req.json();

    // ── SuperAdmin-only actions ──────────────────────────────────
    if (action === "create_clinic") {
      if (!isSuperadmin) throw new Error("Unauthorized: superadmin only");
      const { name, address, phone, license_expiry, plan_type } = payload;
      const { data, error } = await supabase
        .from("clinics")
        .insert({ name, address, phone, license_expiry, plan_type: plan_type || "basic" })
        .select()
        .single();
      if (error) throw error;
      return json(data);
    }

    if (action === "update_clinic") {
      if (!isSuperadmin) throw new Error("Unauthorized: superadmin only");
      const { id, name, address, phone, license_expiry, plan_type } = payload;
      const { data, error } = await supabase
        .from("clinics")
        .update({ name, address, phone, license_expiry, plan_type })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return json(data);
    }

    if (action === "list_clinics") {
      if (!isSuperadmin) throw new Error("Unauthorized: superadmin only");
      const { data, error } = await supabase.from("clinics").select("*").order("name");
      if (error) throw error;
      return json(data);
    }

    // ── Create user (superadmin or admin) ────────────────────────
    if (action === "create_user") {
      const { email, password, name, clinic_id, role } = payload;

      // Admin can only create doctor/reception in their own clinic
      if (isAdmin && !isSuperadmin) {
        if (role === "superadmin" || role === "admin") {
          throw new Error("Admins can only create doctor and reception users");
        }
        if (clinic_id !== callerClinicId) {
          throw new Error("Admins can only create users in their own clinic");
        }
      }

      // SuperAdmin can create admin users; only they should create admins
      if (role === "superadmin") {
        throw new Error("Cannot create superadmin users");
      }

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (authError) throw authError;

      const userId = authData.user.id;

      const { error: profileError } = await supabase
        .from("profiles")
        .insert({ user_id: userId, name, email, clinic_id });
      if (profileError) throw profileError;

      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });
      if (roleError) throw roleError;

      return json({ id: userId, email, name, role, clinic_id });
    }

    // ── List users (superadmin sees all, admin sees own clinic) ──
    if (action === "list_users") {
      const { clinic_id } = payload;
      const query = supabase.from("profiles").select("*, user_roles(role)").order("name");

      if (isAdmin && !isSuperadmin) {
        // Admin can only see their own clinic users
        query.eq("clinic_id", callerClinicId);
      } else if (clinic_id) {
        query.eq("clinic_id", clinic_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return json(data);
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
