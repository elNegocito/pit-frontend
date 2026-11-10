# CTAL tutorial videos

The videos on `/ctal/help` are recorded on the real app by a script: a visible
cursor does each step, a caption names it, and an intro card lists what the
video covers. No voice. Re-record a video whenever its screen changes.

## What is here

| File | What it does |
|---|---|
| `scenarios.mjs` | One entry per video: title, steps (captions and chapters) and the clicks |
| `lib.mjs` | Cursor, typing pace, captions, intro / closing / PDF cards |
| `record.mjs` | Records, trims, compresses to H.264 and writes the list the page reads |

Output: `public/ctal-help/<slug>.mp4` + `.jpg` (poster) and `lib/ctal/tutorials.json`.

## Recording

The data on screen must be made up: the repo and everything in `public/` are public.

```bash
pnpm supabase start
docker exec -i supabase_db_pit-frontend psql -U postgres -d postgres < supabase/dev/ctal-tutorial-data.sql
pnpm build && PORT=3111 pnpm start &

# all the videos, or only the ones named
node scripts/ctal-tutorials/record.mjs
node scripts/ctal-tutorials/record.mjs statements
```

Load the demo data again before each run: the videos add carriers, a week and documents.

Needs `ffmpeg`, `pdftoppm` (poppler-utils) and a Playwright install with its Chromium.
Playwright is not a dependency of this app; point `TUT_PLAYWRIGHT_FROM` at a folder
that has it in `node_modules` (default: `../manual`). Other settings: `TUT_BASE`
(app URL), `TUT_TMP` (raw recordings), `TUT_CRF` (quality, lower is sharper and heavier).

The email step answers as the email function does when it sends, so the video shows
the result even when Gmail is not connected on the recording machine.
