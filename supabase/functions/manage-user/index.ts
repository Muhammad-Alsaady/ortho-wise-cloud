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

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return json({ error: "Missing authorization header" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");

    const { data: userData, error: authError } =
      await supabase.auth.getUser(token);

    if (authError || !userData.user) {
      return json({ error: "Not authenticated" }, 401);
    }

    const caller = userData.user;

    // Get caller role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const roles = (roleData || []).map((r: any) => r.role);

    const isSuperadmin = roles.includes("superadmin");
    const isAdmin = roles.includes("admin");

    if (!isSuperadmin && !isAdmin) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { action, ...payload } = await req.json();

    // SUPERADMIN: create clinic
    if (action === "create_clinic") {
      if (!isSuperadmin) {
        return json({ error: "Only superadmin can create clinics" }, 401);
      }

      const { name, address, phone } = payload;

      const { data, error } = await supabase
        .from("clinics")
        .insert({ name, address, phone })
        .select()
        .single();

      if (error) throw error;

      return json(data);
    }

    // CREATE USER
    if (action === "create_user") {
      const { email, password, name, clinic_id, role } = payload;

      if (!isSuperadmin && role === "admin") {
        return json({ error: "Only superadmin can create admin users" }, 401);
      }

      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (authError) throw authError;

      const userId = authData.user.id;

      await supabase.from("profiles").insert({
        user_id: userId,
        name,
        email,
        clinic_id,
      });

      await supabase.from("user_roles").insert({
        user_id: userId,
        role,
      });

      return json({ success: true, user_id: userId });
    }

    if (action === "list_users") {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("name");

      if (error) throw error;

      return json(data);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
