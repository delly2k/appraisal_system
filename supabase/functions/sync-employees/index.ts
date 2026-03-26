import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const APP_URL = Deno.env.get("APP_URL") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

serve(async () => {
  if (!APP_URL || !CRON_SECRET) {
    return new Response(
      JSON.stringify({ error: "APP_URL and CRON_SECRET are required" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const res = await fetch(`${APP_URL.replace(/\/$/, "")}/api/sync/employees`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": CRON_SECRET,
    },
  });

  const payload = await res.json().catch(() => ({ ok: false, error: "Invalid JSON response" }));
  return new Response(JSON.stringify(payload), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
});
