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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is superadmin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Not authenticated");

    const { data: roleCheck } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "superadmin")
      .single();
    if (!roleCheck) throw new Error("Unauthorized: superadmin only");

    const { action, ...payload } = await req.json();

    if (action === "create_clinic") {
      const { name, address, phone, license_expiry, plan_type } = payload;
      const { data, error } = await supabase
        .from("clinics")
        .insert({ name, address, phone, license_expiry, plan_type: plan_type || "basic" })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update_clinic") {
      const { id, name, address, phone, license_expiry, plan_type } = payload;
      const { data, error } = await supabase
        .from("clinics")
        .update({ name, address, phone, license_expiry, plan_type })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "create_user") {
      const { email, password, name, clinic_id, role } = payload;

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (authError) throw authError;

      const userId = authData.user.id;

      // Create profile
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({ user_id: userId, name, email, clinic_id });
      if (profileError) throw profileError;

      // Create role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });
      if (roleError) throw roleError;

      return new Response(JSON.stringify({ id: userId, email, name, role }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_clinics") {
      const { data, error } = await supabase.from("clinics").select("*").order("name");
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "list_users") {
      const { clinic_id } = payload;
      const query = supabase.from("profiles").select("*, user_roles(role)").order("name");
      if (clinic_id) query.eq("clinic_id", clinic_id);
      const { data, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
