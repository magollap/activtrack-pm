import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ROLES = ["governor", "delegate", "reporter"];

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed." });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: caller, error: callerError } = await admin.auth.getUser(token);
    if (callerError || !caller.user) return reply(401, { error: "Please sign in again." });

    const { data: me } = await admin
      .from("profiles")
      .select("role, disabled")
      .eq("id", caller.user.id)
      .maybeSingle();
    if (!me || me.disabled || me.role !== "governor") {
      return reply(403, { error: "Only governors can create accounts." });
    }

    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const role = typeof body?.role === "string" ? body.role : "";

    if (name.length < 1 || name.length > 80) return reply(400, { error: "Enter a name up to 80 characters." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return reply(400, { error: "Enter a valid email address." });
    }
    if (password.length < 8 || password.length > 128) {
      return reply(400, { error: "Passwords must be 8 to 128 characters." });
    }
    if (!ROLES.includes(role)) return reply(400, { error: "Choose a role." });

    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
      app_metadata: { workday_role: role },
    });
    if (error || !created.user) {
      const exists = /already/i.test(error?.message ?? "");
      return reply(exists ? 409 : 400, {
        error: exists ? "An account with this email already exists." : "Could not create the account.",
      });
    }

    return reply(200, { id: created.user.id });
  } catch {
    return reply(500, { error: "Could not create the account." });
  }
});
