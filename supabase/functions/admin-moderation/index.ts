import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// Business/application errors intentionally return HTTP 200 so the client never
// receives Supabase's generic "Edge Function returned a non-2xx status code".
const out = (_status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: cors });
const normalizeId = (value: string) => value.trim().toLowerCase();
const syntheticEmail = (id: string) => `${id}@managed.kotohaboard.local`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return out(405, { ok: false, error: "Method not allowed" });

  const auth = req.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!auth || !url || !anonKey || !serviceKey) return out(500, { ok: false, error: "Server configuration error" });

  const client = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const adminClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return out(401, { ok: false, error: "Not authenticated" });

  const { data: callerProfile, error: callerError } = await client.from("profiles")
    .select("role, account_status").eq("id", user.id).maybeSingle();
  if (callerError || callerProfile?.role !== "admin" || callerProfile?.account_status !== "active") {
    return out(403, { ok: false, error: "Admin access required" });
  }

  let payload: any;
  try { payload = await req.json(); } catch { return out(400, { ok: false, error: "Invalid JSON" }); }
  const action = String(payload.action ?? "");

  try {
    if (action === "list_users") {
      const { data, error } = await client.rpc("admin_list_users");
      if (error) throw error;
      return out(200, { ok: true, users: data ?? [] });
    }
    if (action === "set_role") {
      const { error } = await client.rpc("admin_set_role", { target_id: String(payload.targetUserId), new_role: String(payload.value) });
      if (error) throw error;
      return out(200, { ok: true });
    }
    if (action === "set_status") {
      const { error } = await client.rpc("admin_set_status", { target_id: String(payload.targetUserId), new_status: String(payload.value) });
      if (error) throw error;
      return out(200, { ok: true });
    }
    if (action === "delete_post") {
      const postId = String(payload.value ?? "");
      if (!postId) return out(400, { ok: false, error: "Post ID is required" });
      const { error } = await adminClient.from("posts").delete().eq("id", postId);
      if (error) throw error;
      return out(200, { ok: true });
    }
    if (action === "delete_comment") {
      const commentId = String(payload.value ?? "");
      if (!commentId) return out(400, { ok: false, error: "Comment ID is required" });
      const { error } = await adminClient.from("comments").delete().eq("id", commentId);
      if (error) throw error;
      return out(200, { ok: true });
    }
    if (action === "list_managed_accounts") {
      const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw error;
      const users = (data.users ?? []).filter((u: any) => u.app_metadata?.kotoha_managed_account === true);
      return out(200, { ok: true, users: users.map((u: any) => ({
        id: u.id,
        managed_id: u.app_metadata?.managed_id,
        display_name: u.user_metadata?.display_name ?? "",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        role: "user",
      })) });
    }
    if (action === "create_managed_account") {
      const managedId = normalizeId(String(payload.managedId ?? ""));
      const password = String(payload.password ?? "");
      const displayName = String(payload.displayName ?? "").trim();
      if (!/^[a-z0-9_-]{3,32}$/.test(managedId)) return out(400, { ok: false, error: "ユーザーIDは英数字・_・-の3〜32文字で設定してください。" });
      if (password.length < 8) return out(400, { ok: false, error: "パスワードは8文字以上にしてください。" });
      if (displayName.length < 1 || displayName.length > 32) return out(400, { ok: false, error: "表示名は1〜32文字で入力してください。" });

      const { data: existing, error: existingError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (existingError) throw existingError;
      const duplicate = (existing.users ?? []).some((u: any) => u.app_metadata?.kotoha_managed_account === true && u.app_metadata?.managed_id === managedId);
      if (duplicate) return out(409, { ok: false, error: "そのユーザーIDはすでに使用されています。別のIDを設定してください。" });

      const { data, error } = await adminClient.auth.admin.createUser({
        email: syntheticEmail(managedId),
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName, created_by_admin: true, managed_id: managedId },
        app_metadata: { kotoha_managed_account: true, managed_id: managedId, created_by_admin: user.id },
      });
      if (error || !data.user) throw error ?? new Error("Account creation failed");

      const { error: profileError } = await adminClient.rpc("admin_insert_managed_profile", {
        p_user_id: data.user.id,
        p_display_name: displayName,
      });
      if (profileError) {
        await adminClient.auth.admin.deleteUser(data.user.id);
        throw profileError;
      }
      return out(200, { ok: true, user: { id: data.user.id, managed_id: managedId, display_name: displayName, role: "user" } });
    }
    if (action === "delete_managed_account") {
      const targetId = String(payload.targetUserId ?? "");
      if (!targetId) return out(400, { ok: false, error: "対象アカウントが指定されていません。" });
      if (targetId === user.id) return out(400, { ok: false, error: "自分自身の管理者アカウントは削除できません。" });
      const { data: targetData, error: targetError } = await adminClient.auth.admin.getUserById(targetId);
      if (targetError || !targetData.user) throw targetError ?? new Error("User not found");
      if (targetData.user.app_metadata?.kotoha_managed_account !== true) return out(400, { ok: false, error: "管理者が発行したアカウントのみ削除できます。" });
      const { error } = await adminClient.auth.admin.deleteUser(targetId);
      if (error) throw error;
      return out(200, { ok: true });
    }
    return out(400, { ok: false, error: "Unknown action" });
  } catch (error) {
    return out(400, { ok: false, error: error instanceof Error ? error.message : "Admin operation failed" });
  }
});
