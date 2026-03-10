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
      const query = supabase.from("profiles").select("*").order("name");

      if (isAdmin && !isSuperadmin) {
        query.eq("clinic_id", callerClinicId);
      } else if (clinic_id) {
        query.eq("clinic_id", clinic_id);
      }

      const { data: profilesData, error: profilesError } = await query;
      if (profilesError) throw profilesError;

      // Fetch roles for all users
      const userIds = (profilesData || []).map((p: any) => p.user_id);
      const { data: rolesData } = userIds.length > 0
        ? await supabase.from("user_roles").select("user_id, role").in("user_id", userIds)
        : { data: [] };

      // Merge roles into profiles
      const result = (profilesData || []).map((p: any) => ({
        ...p,
        user_roles: (rolesData || []).filter((r: any) => r.user_id === p.user_id),
      }));

      return json(result);
    }

    // ── Delete/deactivate user ───────────────────────────────────
    if (action === "delete_user") {
      const { user_id } = payload;
      if (!user_id) throw new Error("user_id is required");

      // Get target user's profile to check clinic
      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("clinic_id")
        .eq("user_id", user_id)
        .single();

      if (!targetProfile) throw new Error("User not found");

      // Admin can only delete users in their own clinic
      if (isAdmin && !isSuperadmin) {
        if (targetProfile.clinic_id !== callerClinicId) {
          throw new Error("Cannot delete users from another clinic");
        }
        // Check target is not admin/superadmin
        const { data: targetRoles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user_id);
        const targetRoleNames = (targetRoles || []).map((r: any) => r.role);
        if (targetRoleNames.includes("admin") || targetRoleNames.includes("superadmin")) {
          throw new Error("Cannot delete admin users");
        }
      }

      // Cannot delete yourself
      if (user_id === caller.id) {
        throw new Error("Cannot delete your own account");
      }

      // Delete from auth (cascades to profiles and user_roles via FK)
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user_id);
      if (deleteError) throw deleteError;

      return json({ success: true });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
