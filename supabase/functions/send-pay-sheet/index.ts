// Emails a pay sheet PDF to its driver through a Gmail account.
//
// Secrets (Dashboard > Edge Functions > Secrets, or `supabase secrets set`):
//   GMAIL_USER, GMAIL_APP_PASSWORD (a Google App Password), GMAIL_FROM_NAME (optional).
// Without them it answers not_configured and the app uses the mail app flow.
//
// Port 465 on purpose: Edge Functions cannot open outbound 25 / 587.
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

const MAX_PDF_BYTES = 2 * 1024 * 1024;

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ result: "bad_request" }, 405);

  const { sheetId, pdfBase64 } = await req.json().catch(() => ({}));
  if (typeof sheetId !== "string" || typeof pdfBase64 !== "string" || !isPdf(pdfBase64)) {
    return reply({ result: "bad_request" }, 400);
  }
  if ((pdfBase64.length * 3) / 4 > MAX_PDF_BYTES) return reply({ result: "bad_request" }, 413);

  // Runs as the caller: RLS only lets payroll / admin users read the sheet.
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: sheet } = await supabase
    .from("pay_sheets")
    .select("sheet_number, driver_id, driver_name, pay_date")
    .eq("id", sheetId)
    .maybeSingle();
  if (!sheet) return reply({ result: "forbidden" }, 403);

  // The recipient always comes from the driver record, never from the request.
  const { data: driver } = await supabase.from("drivers").select("email").eq("id", sheet.driver_id).maybeSingle();
  if (!driver?.email) return reply({ result: "no_email" });

  const user = Deno.env.get("GMAIL_USER");
  const pass = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!user || !pass) return reply({ result: "not_configured" });

  const name = sheet.driver_name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
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
        from: { name: Deno.env.get("GMAIL_FROM_NAME") || "ASG Payroll", address: user },
        to: driver.email,
        subject: `ASG Pay Sheet #${sheet.sheet_number} - Pay date ${sheet.pay_date}`,
        text: `Hello ${sheet.driver_name},\n\nYour pay sheet #${sheet.sheet_number} for pay date ${sheet.pay_date} is attached.\n\nASG Operations`,
        attachments: [
          { filename: `PaySheet_${name}_${sheet.pay_date}.pdf`, content: pdfBase64, encoding: "base64", contentType: "application/pdf" },
        ],
      });
  } catch (e) {
    const err = e as { code?: string; responseCode?: number; message?: string };
    console.error("send-pay-sheet", err.code, err.responseCode, err.message);
    const rejected = err.code === "EAUTH" || err.responseCode === 535;
    return reply({ result: rejected ? "invalid_credentials" : "send_failed" });
  }
  return reply({ result: "sent", to: driver.email });
});
