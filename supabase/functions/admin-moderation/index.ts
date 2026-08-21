import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "Missing Authorization header" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!supabaseUrl || !publishableKey || !serviceKey) return json(500, { error: "Server configuration error" });

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json(401, { error: "Not authenticated" });

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: actor, error: actorError } = await adminClient
    .from("profiles")
    .select("id, role, account_status")
    .eq("id", user.id)
    .single();

  if (actorError || actor?.role !== "admin" || actor.account_status !== "active") {
    return json(403, { error: "Admin access required" });
  }

  let payload: { action?: string; targetUserId?: string; value?: string | number | boolean };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const targetUserId = String(payload.targetUserId ?? "");
  if (payload.action !== "list_users" && !targetUserId) {
    return json(400, { error: "targetUserId is required" });
  }
  if (targetUserId === user.id && ["set_status", "set_role"].includes(payload.action ?? "")) {
    return json(400, { error: "You cannot change your own admin account this way" });
  }

  switch (payload.action) {
    case "list_users": {
      const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) return json(400, { error: error.message });
      const ids = data.users.map((u) => u.id);
      const { data: profiles, error: profileError } = await adminClient
        .from("profiles")
        .select("id, display_name, role, account_status, created_at")
        .in("id", ids);
      if (profileError) return json(400, { error: profileError.message });
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return json(200, {
        users: data.users.map((u) => ({
          id: u.id,
          email: u.email ?? "",
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          banned_until: u.banned_until,
          ...(byId.get(u.id) ?? { display_name: "名無しさん", role: "user", account_status: "active" }),
        })),
      });
    }
    case "set_role": {
      const role = payload.value === "admin" ? "admin" : "user";
      const { error } = await adminClient.from("profiles").update({ role }).eq("id", targetUserId);
      if (error) return json(400, { error: error.message });
      return json(200, { ok: true, role });
    }
    case "set_status": {
      const allowed = ["active", "comment_restricted", "post_restricted", "banned"];
      const status = String(payload.value ?? "");
      if (!allowed.includes(status)) return json(400, { error: "Invalid account status" });
      const { error } = await adminClient.from("profiles").update({ account_status: status }).eq("id", targetUserId);
      if (error) return json(400, { error: error.message });
      const { error: authError } = await adminClient.auth.admin.updateUserById(targetUserId, {
        ban_duration: status === "banned" ? "876000h" : "none",
      });
      if (authError) return json(400, { error: authError.message });
      return json(200, { ok: true, account_status: status });
    }
    case "delete_post": {
      const postId = String(payload.value ?? "");
      const { error } = await adminClient.from("posts").delete().eq("id", postId);
      if (error) return json(400, { error: error.message });
      return json(200, { ok: true });
    }
    case "delete_comment": {
      const commentId = String(payload.value ?? "");
      const { error } = await adminClient.from("comments").delete().eq("id", commentId);
      if (error) return json(400, { error: error.message });
      return json(200, { ok: true });
    }
    default:
      return json(400, { error: "Unknown action" });
  }
});
