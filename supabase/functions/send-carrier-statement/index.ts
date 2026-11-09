// Emails a CTAL weekly statement PDF to its carrier through a Gmail account.
//
// Same secrets as send-pay-sheet (Dashboard > Edge Functions > Secrets):
//   GMAIL_USER, GMAIL_APP_PASSWORD (a Google App Password), CTAL_FROM_NAME (optional).
// Without them it answers not_configured and the app uses the mail app flow.
//
// Port 465 on purpose: Edge Functions cannot open outbound 25 / 587.
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

const MAX_PDF_BYTES = 3 * 1024 * 1024;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Known outcomes are 200 so the browser client can read `result`.
const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function isPdf(base64: string): boolean {
  try {
    return atob(base64.slice(0, 8)).startsWith("%PDF");
  } catch {
    return false;
  }
}

const us = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ result: "bad_request" }, 405);

  const { weekId, carrierId, pdfBase64 } = await req.json().catch(() => ({}));
  if (typeof weekId !== "string" || typeof carrierId !== "string" || typeof pdfBase64 !== "string" || !isPdf(pdfBase64)) {
    return reply({ result: "bad_request" }, 400);
  }
  if ((pdfBase64.length * 3) / 4 > MAX_PDF_BYTES) return reply({ result: "bad_request" }, 413);

  // Runs as the caller: RLS only lets the admin read CTAL data.
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const [{ data: week }, { data: carrier }] = await Promise.all([
    supabase.from("ctal_weeks").select("week_start, pay_date").eq("id", weekId).maybeSingle(),
    // The recipient always comes from the carrier record, never from the request.
    supabase.from("ctal_carriers").select("name, email").eq("id", carrierId).maybeSingle(),
  ]);
  if (!week || !carrier) return reply({ result: "forbidden" }, 403);
  if (!carrier.email) return reply({ result: "no_email" });

  const user = Deno.env.get("GMAIL_USER");
  const pass = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!user || !pass) return reply({ result: "not_configured" });

  const name = carrier.name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
  try {
    await nodemailer
      .createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user, pass: pass.replace(/\s/g, "") },
        connectionTimeout: 15_000,
      })
      .sendMail({
        from: { name: Deno.env.get("CTAL_FROM_NAME") || "CTAL", address: user },
        to: carrier.email,
        subject: `CTAL statement - week of ${us(week.week_start)} - pay date ${us(week.pay_date)}`,
        text: `Hello ${carrier.name},\n\nYour statement for the week of ${us(week.week_start)} is attached. Pay date: ${us(week.pay_date)}.\n\nCTAL`,
        attachments: [
          { filename: `CTAL_Statement_${name}_${week.week_start}.pdf`, content: pdfBase64, encoding: "base64", contentType: "application/pdf" },
        ],
      });
  } catch (e) {
    const err = e as { code?: string; responseCode?: number; message?: string };
    console.error("send-carrier-statement", err.code, err.responseCode, err.message);
    const rejected = err.code === "EAUTH" || err.responseCode === 535;
    return reply({ result: rejected ? "invalid_credentials" : "send_failed" });
  }

  await supabase
    .from("ctal_statements")
    .upsert({ week_id: weekId, carrier_id: carrierId, emailed_at: new Date().toISOString(), emailed_to: carrier.email }, { onConflict: "week_id,carrier_id" });
  return reply({ result: "sent", to: carrier.email });
});
