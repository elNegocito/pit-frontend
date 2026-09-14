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

- `/login` — both users. Operator lands on `/entry`, admin on `/dashboard`.
- `/entry` — write-only ticket form (date locked to America/Chicago day, live gross preview).
- `/dashboard` — admin ledger: sort by clicking headers, filter by truck/ticket/customer/material/payment/COD method/date, export filtered view to CSV or PDF.
- `/materials` — admin CRUD of materials + prices (future tickets only, history frozen).
- `/customers` — admin rename + merge duplicates.

## 5. Business rules (ported from Excel)

- `COD → gross = tons × material price`; `ACCOUNT → gross = 0` (billed outside).
- Gross is computed by a DB trigger and frozen; price edits never rewrite history.
- Ticket numbers unique (case/space-insensitive); customers unique (case/space-insensitive, auto-created on typing, mergeable by admin).

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
