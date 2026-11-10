# CTAL tutorial videos

The videos on `/ctal/help` are recorded on the real app by a script: a visible
cursor does each step, a caption names it, an intro card lists what the video
covers, and an English narration explains each step. Re-record a video whenever
its screen changes.

## What is here

| File | What it does |
|---|---|
| `scenarios.mjs` | One entry per video: title, steps (captions and chapters), narration and the clicks |
| `voice/` | The narration lines already spoken, one mp3 per line (named by a hash of its text) |
| `lib.mjs` | Cursor, typing pace, captions, intro / closing / PDF cards |
| `record.mjs` | Speaks the lines, records, trims, mixes the voice in, compresses and writes the list the page reads |

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

Needs `ffmpeg` (with libx264 and libmp3lame), `pdftoppm` (poppler-utils) and a Playwright install with its Chromium.
Playwright is not a dependency of this app; point `TUT_PLAYWRIGHT_FROM` at a folder
that has it in `node_modules` (default: `../manual`). Other settings: `TUT_BASE`
(app URL), `TUT_TMP` (raw recordings), `TUT_CRF` (quality, lower is sharper and heavier).

## Narration

Each video has a `voice` block in `scenarios.mjs`: one line for the intro card and
one per step. A step never ends before its line does, so the picture and the voice
stay together; write lines about as long as the step takes.

The voice is Kokoro `am_michael` (American, male), generated on the machine by the
HyperFrames CLI: free and offline. It needs a Python with `kokoro-onnx` and `soundfile`:

```bash
python3 -m venv ~/.venvs/kokoro && ~/.venvs/kokoro/bin/pip install kokoro-onnx soundfile
export HYPERFRAMES_PYTHON=~/.venvs/kokoro/bin/python
```

Lines are cached in `voice/`, so only new or changed text is spoken again.
`TUT_VOICE_ID` picks another Kokoro voice (`npx hyperframes tts --list`);
`TUT_VOICE=off` records without sound.

The email step answers as the email function does when it sends, so the video shows
the result even when Gmail is not connected on the recording machine.
