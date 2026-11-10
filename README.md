# ASG Operations — PIT #2

Web app replacing the "PIT #2" Excel book: ticket entry form (operator) + filterable ledger with CSV/PDF export (admin). Next.js 16 + Supabase (Postgres + Auth), deployed on Vercel free tier.

## 1. Supabase setup (one time)

1. Create a project at supabase.com. Disable public signup: Authentication > Sign In / Providers > Email > Confirm email OFF is fine, but turn **"Allow new users to sign up" OFF** (users are fixed: admin + operator).
2. Create the two Auth users (Authentication > Users > Create user) and note their emails.
3. Put those emails in `supabase/seed.sql` (`admin_email` / `operator_email`).
4. Link + push the schema:
   ```bash
   supabase link --project-ref <ref>
   supabase db push        # applies supabase/migrations/* + seed (materials, price list, profiles)
   ```
   Price list seeded: CUSHION SAND 8.80 / SCREENED TOP SOIL 18.00 / SELECT FILL 7.00 ($/ton).
5. Copy `Project Settings > API` values: `Project URL` and `anon public` key.

## 2. Environment variables (local + Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Local: copy `.env.example` to `.env.local`. Vercel: Project > Settings > Environment Variables (same two keys, all environments).

## 3. Run / deploy

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # production check
```

Deploy: import the repo in Vercel, set the 2 env vars, Deploy. No other config needed.

## 4. Roles & routes

- `/login` — all users. Operator lands on `/entry`, admin on `/dashboard`, payroll on `/payroll`.
- `/entry` — write-only ticket form (date locked to America/Chicago day, live gross preview).
- `/dashboard` — admin ledger: sort by clicking headers, filter by truck/ticket/customer/material/payment/COD method/date, export filtered view to CSV or PDF.
- `/materials` — admin CRUD of materials + prices (future tickets only, history frozen).
- `/customers` — admin rename + merge duplicates.
- `/trucks` — admin truck registry (truck # + gross tons) used for Gross / Tare / Net on printed tickets.
- `/job-orders` — admin project orders (one per customer), printed as "Order" on tickets.
- `/payroll` — **driver payroll** (role `payroll`, also admin): weekly pay sheets per driver from the Excel "PAYROLL MODELOS". Search by driver / pay date / day worked / who prepared it; `/payroll/new` (pick driver → template for Flat bed / Mixer / Aggregate fills in, live total; truck # per load with "Apply to all loads"); `/payroll/[id]` print, PDF, WhatsApp / email / share, copy for next week, void, change history; `/payroll/drivers` driver registry. Payroll users never see tickets; the operator never sees payroll.

- `/ctal` — **CTAL, admin only**: everything about the contract carriers in one place (replaces the Google Sheet "CTAL CARRIER REGIST" and the weekly Excel "CTAL <week>.xlsx"). See "CTAL rules" below.

- `/leaderboard` — **public, no login** (link for drivers): aggregate drivers ranked by loads hauled (then tons), monthly board that starts over on the 1st + yearly totals with loads per month. Data from `public_driver_production()` (migration 010), which exposes only first name + last initial, loads and tons; pay sheets stay private. Not indexed by search engines.

### Payroll rules (migration 008)

- Pay = revenue × driver % (flat bed, aggregate) + total yards × extra per yard (mixer) + hours × $/h (+ OT hours × OT rate over 40 h, mixer) + extras − deductions. Defaults per model in `lib/payroll/models.ts` (flat bed 35% · $20, mixer $0.25/yard · $28 · OT $42, aggregate 32% · $20; "Aggregate" is stored as `trucking`); rates are copied onto each sheet, so changing defaults never rewrites old sheets.
- Each load has its own truck # (a driver may use another truck when theirs breaks); mixer loads are date / truck / ticket / yards, with the yards totalled (migration 009).
- Totals are computed and frozen by a DB trigger (`compute_pay_sheet`); `lib/payroll/compute.ts` mirrors it for the live preview.
- Every sheet stores who created it and who last edited it; `pay_sheet_events` keeps the full history (row-level: "Load 5: revenue $250 → $260").
- Two payroll users editing the same sheet: the second save is refused with a "reload" message (no silent overwrite). A second sheet for the same driver + pay date asks for confirmation.
- Sheets are voided, not deleted (DELETE is admin-only).

### CTAL rules (migration 012)

Routes: `/ctal` (search + current week + insurance to follow up), `/ctal/carriers` (registry, `/new`, `/[id]` with documents, `/import` to paste the Google Sheet), `/ctal/customers` (rules of each job), `/ctal/weeks` and `/ctal/weeks/[id]` (Log) with `/statements`, `/billing`, `/profit`.

- A week runs Sunday to Saturday and is paid the Friday after (`week_start + 12`, editable). Every week is kept.
- Log row: `carrier amount = qty × carrier rate` and `broker amount = qty × broker rate` for **TON / HR**; for **YDS / LOAD** the rate counts once (`rate × 1`).
- Fee, always negative, one or the other: **quick pay** `-(carrier amount × 3.5%)`, or **broker fee** `-(carrier amount × 8%)` for the customers set that way. Carriers with pay term `28` start with 0% quick pay.
- **FSC $**: nothing, a % of the carrier amount (changes week to week), or a fixed amount per load.
- Statement (per carrier) = carrier amount + broker fee + quick pay fee + FSC. Billing (ASG / Ready Mix / Excavation, set on the customer) = broker amount + FSC. Broker profit = |broker − carrier| + fees, plus FSC.
- Picking a customer fills the row from `ctal_customers` (unit, rates, fee, FSC); every row stays editable and keeps its own values, so editing a customer never rewrites past weeks.
- Amounts are computed and frozen by the `compute_ctal_load` trigger; `lib/ctal/compute.ts` mirrors it for the live totals. The log saves by itself.
- Carrier documents (insurance, contract, CDL… PDF or photos, 20 MB each) live in the private Storage bucket `ctal-docs`; they are opened through short-lived signed links. Tickets are **not** stored: only a link to the owner's own server (per carrier, and per statement).
- Statements: print, PDF, or email through the `send-carrier-statement` Edge Function (same Gmail secrets as `send-pay-sheet`; without them the app downloads the PDF and opens the mail app). Deploy it with `supabase functions deploy send-carrier-statement`.
- All CTAL tables and the bucket are admin-only by RLS; operator and payroll users are redirected to their own home.
- The name printed on the PDFs is in `lib/ctal/config.ts`.
- `/ctal/help` has the tutorial videos (one per part of CTAL, no voice). They are recorded on the real app by `scripts/ctal-tutorials` with made-up data; see its README to record them again after a screen changes.

Local development (Supabase in Docker, test users, printing checklist): see [LOCAL-DEV.md](LOCAL-DEV.md).

## 5. Business rules (ported from Excel)

- `COD → gross = tons × material price`; `ACCOUNT → gross = 0` (billed outside).
- Gross is computed by a DB trigger and frozen; price edits never rewrite history.
- Ticket numbers are generated by the database (sequence, 5+ digits, continues after the highest existing one); customers unique (case/space-insensitive, auto-created on typing, mergeable by admin).

## PDF docs

- PDF 1 [PDF 1 explanation](../docs/1-Analisis-Funcional-Excel-PIT2.pdf)
- PDF 2 [PDF 2 details for implementation](../docs/2-Analisis-Opciones-Implementacion.pdf)

## Tecs

- Supabase for database
- Frontend with envs to conect with Supabase, Next.js like framework for the frontend

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Pay sheet emails (Gmail)

The Email button on a pay sheet sends the PDF to the driver's email automatically when the `send-pay-sheet` Edge Function is deployed and has valid Gmail secrets. Otherwise it keeps working as before (downloads the PDF and opens the mail app).

1. On the Gmail account, turn on 2-Step Verification and create an **App Password** (Google Account > Security > App passwords).
2. In Supabase, go to Edge Functions > Secrets and add `GMAIL_USER` (the address), `GMAIL_APP_PASSWORD`, and optionally `GMAIL_FROM_NAME` (default "ASG Payroll"). With the CLI: `supabase secrets set GMAIL_USER=... GMAIL_APP_PASSWORD=...`. Changes apply right away, with no redeploy.
3. Deploy once: `pnpm supabase functions deploy send-pay-sheet --project-ref <ref>`.
