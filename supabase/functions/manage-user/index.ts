import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allow only the configured origin (set ALLOWED_ORIGIN in Supabase Edge Function secrets)
const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "";

function corsHeaders(origin: string | null) {
  const allow = allowedOrigin && origin === allowedOrigin ? origin : allowedOrigin;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Authenticate caller ───────────────────────────────────────────────────
    // Use getUser() to cryptographically verify the JWT with the Auth server.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: callerUser }, error: callerAuthError } = await userClient.auth.getUser();
    if (callerAuthError || !callerUser) {
      return json({ error: "Invalid or expired authorization token" }, 401);
    }

    const callerId = callerUser.id;

    // ── Fetch caller roles (service role bypasses RLS) ────────────────────────
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);

    const roles = (roleData ?? []).map((r: any) => r.role as string);
    const isSuperadmin = roles.includes("superadmin");
    const isAdmin = roles.includes("admin");

    if (!isSuperadmin && !isAdmin) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Caller's clinic (needed for admin-scoped operations)
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("clinic_id")
      .eq("user_id", callerId)
      .maybeSingle();

    const callerClinicId: string | null = callerProfile?.clinic_id ?? null;

    // Admins must always have a clinic — guard against broken state.
    if (isAdmin && !isSuperadmin && !callerClinicId) {
      return json({ error: "Admin account is not associated with any clinic. Contact a superadmin." }, 403);
    }

    const { action, ...payload } = await req.json();

    // ── create_clinic (superadmin only) ───────────────────────────────────────
    if (action === "create_clinic") {
      if (!isSuperadmin) return json({ error: "Only superadmin can create clinics" }, 403);

      const { name, address, phone, license_expiry, plan_type } = payload;
      const { data, error } = await supabase
        .from("clinics")
        .insert({
          name,
          address,
          phone,
          license_expiry: license_expiry || null,
          plan_type: plan_type || "basic",
        })
        .select()
        .single();

      if (error) throw error;
      return json(data);
    }

    // ── update_clinic (superadmin only) ───────────────────────────────────────
    if (action === "update_clinic") {
      if (!isSuperadmin) return json({ error: "Only superadmin can update clinics" }, 403);

      const { id, name, address, phone, license_expiry, plan_type } = payload;
      const { data, error } = await supabase
        .from("clinics")
        .update({ name, address, phone, license_expiry: license_expiry || null, plan_type })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return json(data);
    }

    // ── list_clinics (superadmin only) ────────────────────────────────────────
    if (action === "list_clinics") {
      if (!isSuperadmin) return json({ error: "Only superadmin can list all clinics" }, 403);

      const { data, error } = await supabase
        .from("clinics")
        .select("*")
        .order("name");

      if (error) throw error;
      return json(data);
    }

    // ── create_user ───────────────────────────────────────────────────────────
    if (action === "create_user") {
      const { email, password, name, clinic_id, role } = payload;

      if (role === "superadmin") {
        return json({ error: "Cannot create superadmin users via this endpoint" }, 403);
      }

      if (isAdmin && !isSuperadmin) {
        if (role === "admin") {
          return json({ error: "Admins can only create doctor and reception users" }, 403);
        }
        if (clinic_id !== callerClinicId) {
          return json({ error: "Admins can only create users in their own clinic" }, 403);
        }
      }

      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (authError) throw authError;

      const userId = authData.user.id;

      const { error: profileError } = await supabase
        .from("profiles")
        .insert({ user_id: userId, name, email, clinic_id });

      if (profileError) {
        await supabase.auth.admin.deleteUser(userId).catch(() => { });
        throw profileError;
      }

      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });

      if (roleError) {
        await supabase.auth.admin.deleteUser(userId).catch(() => { });
        throw roleError;
      }

      return json({ success: true, user_id: userId });
    }

    // ── list_users ────────────────────────────────────────────────────────────
    if (action === "list_users") {
      const { clinic_id } = payload;

      let query = supabase.from("profiles").select("*").order("name");

      if (isAdmin && !isSuperadmin) {
        query = query.eq("clinic_id", callerClinicId);
      } else if (clinic_id) {
        query = query.eq("clinic_id", clinic_id);
      }

      const { data: profilesData, error: profilesError } = await query;
      if (profilesError) throw profilesError;

      const userIds = (profilesData ?? []).map((p: any) => p.user_id as string);
      const { data: rolesData } = userIds.length > 0
        ? await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds)
        : { data: [] };

      const result = (profilesData ?? []).map((p: any) => ({
        ...p,
        user_roles: (rolesData ?? []).filter((r: any) => r.user_id === p.user_id),
      }));

      return json(result);
    }

    // ── delete_user ───────────────────────────────────────────────────────────
    if (action === "delete_user") {
      const { user_id } = payload;
      if (!user_id) return json({ error: "user_id is required" }, 400);
      if (user_id === callerId) return json({ error: "Cannot delete your own account" }, 400);

      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("clinic_id")
        .eq("user_id", user_id)
        .maybeSingle();

      if (!targetProfile) return json({ error: "User not found" }, 404);

      if (isAdmin && !isSuperadmin) {
        if (targetProfile.clinic_id !== callerClinicId) {
          return json({ error: "Cannot delete users from another clinic" }, 403);
        }
        const { data: targetRoles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user_id);

        const targetRoleNames = (targetRoles ?? []).map((r: any) => r.role as string);
        if (targetRoleNames.includes("admin") || targetRoleNames.includes("superadmin")) {
          return json({ error: "Cannot delete admin users" }, 403);
        }
      }

      const { error: deleteError } = await supabase.auth.admin.deleteUser(user_id);
      if (deleteError) throw deleteError;

      return json({ success: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err: any) {
    console.error("[manage-user] unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Internal error" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
