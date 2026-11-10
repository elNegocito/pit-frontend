// Records the CTAL tutorial videos on the real app and compresses them.
//
//   node scripts/ctal-tutorials/record.mjs            all the videos
//   node scripts/ctal-tutorials/record.mjs statements  only that one (keeps the others)
//
// Needs the app running against a LOCAL Supabase loaded with
// supabase/dev/ctal-tutorial-data.sql (see README.md in this folder).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { actor, introCard, outroCard, overlayScript, sleep, VIEW } from "./lib.mjs";
import { SCENARIOS } from "./scenarios.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const BASE = process.env.TUT_BASE ?? "http://localhost:3111";
const TMP = process.env.TUT_TMP ?? resolve(root, ".tutorials-tmp");
const OUT = resolve(root, "public/ctal-help");
const MANIFEST = resolve(root, "lib/ctal/tutorials.json");
const DB = process.env.TUT_DB_CONTAINER ?? "supabase_db_pit-frontend";
// Playwright is not a dependency of this app: borrow it from wherever it is installed.
const { chromium } = createRequire(process.env.TUT_PLAYWRIGHT_FROM ?? resolve(root, "../manual") + "/")("playwright");

// Narration. Each line is synthesized once and kept in ./voice (committed), so
// recording a video again only speaks the lines whose text changed.
// Voice: Kokoro "am_michael" (American, male), generated on this machine by the
// HyperFrames CLI: free, no account.
const VOICE_DIR = resolve(here, "voice");
const VOICE_ID = process.env.TUT_VOICE_ID ?? "am_michael";
const VOICE_ON = process.env.TUT_VOICE !== "off";
const seconds = (file) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString());

function speak(text) {
  mkdirSync(VOICE_DIR, { recursive: true });
  const file = `${VOICE_DIR}/${createHash("sha1").update(`${VOICE_ID}|${text}`).digest("hex").slice(0, 16)}.mp3`;
  if (!existsSync(file)) {
    const wav = `${TMP}/line.wav`;
    execFileSync("npx", ["-y", "hyperframes", "tts", text, "-o", wav, "--voice", VOICE_ID], { stdio: ["ignore", "ignore", "inherit"] });
    // Trim the silence around the line, then keep it small: speech needs no more than this.
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error", "-i", wav,
      "-af", "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse",
      "-ac", "1", "-c:a", "libmp3lame", "-b:a", "64k", file,
    ]);
  }
  return { file, seconds: seconds(file) };
}

const only = process.argv.slice(2);
const todo = SCENARIOS.filter((s) => only.length === 0 || only.includes(s.slug));
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });

const psql = (sql) => execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1"], { input: sql }).toString();

const browser = await chromium.launch({ executablePath: process.env.TUT_CHROME || undefined });

// Sign in once, outside the recordings.
const login = await browser.newContext({ viewport: VIEW });
{
  const p = await login.newPage();
  await p.goto(`${BASE}/login`);
  await p.fill('input[type="email"]', process.env.TUT_EMAIL ?? "admin@asgoperations.com");
  await p.fill('input[type="password"]', process.env.TUT_PASSWORD ?? "password123");
  await p.click('button[type="submit"]');
  await p.waitForURL("**/dashboard");
}
const storageState = await login.storageState();

// Sample paperwork to upload in the documents video.
const files = { insurance: `${TMP}/Insurance_Certificate_2027.pdf`, cdl: `${TMP}/CDL_Victor.jpg` };
{
  const p = await login.newPage();
  const sheet = (title, lines) =>
    `<body style="margin:0;font-family:system-ui,sans-serif;background:#fff"><div style="padding:56px 64px"><p style="letter-spacing:.2em;color:#666;margin:0">SAMPLE DOCUMENT</p><h1 style="font-size:34px;margin:8px 0 28px">${title}</h1>${lines
      .map(([k, v]) => `<p style="font-size:18px;margin:10px 0;border-bottom:1px solid #ddd;padding-bottom:10px"><b style="display:inline-block;width:220px">${k}</b>${v}</p>`)
      .join("")}</div></body>`;
  await p.setContent(
    sheet("Certificate of Liability Insurance", [
      ["Insured", "Three Forks Carriers"],
      ["Policy number", "TFC-000-2027"],
      ["Coverage", "Auto liability, $1,000,000"],
      ["Effective", "11/10/2026"],
      ["Expires", "11/10/2027"],
    ]),
  );
  await p.pdf({ path: files.insurance, format: "Letter" });
  await p.setViewportSize({ width: 860, height: 540 });
  await p.setContent(
    `<body style="margin:0;background:#dfe7ee;font-family:system-ui,sans-serif"><div style="margin:40px;padding:36px;background:#fff;border-radius:18px;height:388px;box-sizing:border-box;border:2px solid #9db3c6"><p style="letter-spacing:.2em;color:#666;margin:0">SAMPLE, NOT A REAL LICENSE</p><h1 style="margin:10px 0 24px;font-size:34px">Commercial Driver License</h1><p style="font-size:22px;margin:8px 0"><b>Name</b> &nbsp; Victor Sample</p><p style="font-size:22px;margin:8px 0"><b>Class</b> &nbsp; A</p><p style="font-size:22px;margin:8px 0"><b>Expires</b> &nbsp; 08/2029</p></div></body>`,
  );
  await p.screenshot({ path: files.cdl, type: "jpeg", quality: 85 });
}
await login.close();

const emails = Object.fromEntries(
  psql("select id || '|' || coalesce(email, '') from ctal_carriers")
    .trim()
    .split("\n")
    .map((l) => l.split("|")),
);

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : [];

for (const sc of todo) {
  const index = SCENARIOS.indexOf(sc) + 1;
  const next = SCENARIOS[index]?.title ?? null;
  console.log(`\n[${index}/${SCENARIOS.length}] ${sc.slug}`);
  const dir = `${TMP}/${sc.slug}`;
  rmSync(dir, { recursive: true, force: true });

  const intro = VOICE_ON ? speak(sc.voice.intro) : null;
  const lines = VOICE_ON ? sc.voice.steps.map(speak) : [];
  if (VOICE_ON) console.log(`  narration ${(intro.seconds + lines.reduce((t, l) => t + l.seconds, 0)).toFixed(1)} s`);

  const ctx = await browser.newContext({ viewport: VIEW, storageState, acceptDownloads: true, recordVideo: { dir, size: VIEW } });
  await ctx.addInitScript(overlayScript(introCard(index, SCENARIOS.length, sc.title, sc.steps)));
  // Gmail is not connected on the recording machine: answer as the email function does when it sends.
  await ctx.route("**/functions/v1/send-carrier-statement", async (route) => {
    const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "content-type": "application/json" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 200, headers, body: "ok" });
    await sleep(900);
    const { carrierId } = route.request().postDataJSON();
    await route.fulfill({ status: 200, headers, body: JSON.stringify(emails[carrierId] ? { result: "sent", to: emails[carrierId] } : { result: "no_email" }) });
  });

  const page = await ctx.newPage();
  const born = Date.now();
  page.on("dialog", (d) => d.accept());
  const marks = [];
  let trim = 0;
  const a = actor(page, marks, () => (Date.now() - born) / 1000 - trim, lines.map((l) => l.seconds));

  await page.goto(BASE + sc.start, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#tut-card");
  // Everything before the intro card is blank loading time: cut it.
  trim = (Date.now() - born) / 1000 + 0.15;
  await page.waitForLoadState("networkidle").catch(() => {});
  // The intro card stays long enough to be read, and until its narration ends.
  const INTRO_VOICE_AT = 0.7;
  await sleep(Math.max(3200 + sc.steps.length * 420, intro ? (INTRO_VOICE_AT + intro.seconds + 0.5) * 1000 : 0));
  await page.evaluate(() => window.__tut.hideCard());
  await sleep(500);

  try {
    await sc.run(a, sc.steps, { files, tmp: dir });
  } catch (e) {
    await page.screenshot({ path: `${TMP}/${sc.slug}-error.png` });
    await ctx.close();
    throw e;
  }
  await a.finishLine();
  await sleep(600);
  await page.evaluate(() => window.__tut.caption(""));
  await page.evaluate((h) => window.__tut.card(h), outroCard(next));
  await sleep(2600);
  const length = (Date.now() - born) / 1000 - trim;
  await ctx.close();
  const raw = await page.video().path();

  // H.264 at a constant quality: screen recordings are mostly still, so this stays small.
  // The narration lines are laid at the second their step starts, then levelled as one track.
  const mp4 = `${OUT}/${sc.slug}.mp4`;
  const clips = VOICE_ON ? [{ ...intro, at: INTRO_VOICE_AT }, ...lines.map((l, i) => ({ ...l, at: marks[i].voiceAt }))] : [];
  const video = ["-vf", "fps=25,format=yuv420p", "-c:v", "libx264", "-preset", "veryslow", "-crf", process.env.TUT_CRF ?? "27", "-profile:v", "high", "-g", "75"];
  const audio = VOICE_ON
    ? [
        "-filter_complex",
        clips.map((c, i) => `[${i + 1}:a]adelay=${Math.round(c.at * 1000)}:all=1[a${i}]`).join(";") +
          `;${clips.map((_, i) => `[a${i}]`).join("")}amix=inputs=${clips.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100,apad[voice]`,
        "-map", "0:v", "-map", "[voice]", "-c:a", "aac", "-b:a", "64k", "-ac", "1",
      ]
    : ["-an"];
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-ss", trim.toFixed(2), "-i", raw, ...clips.flatMap((c) => ["-i", c.file]),
    ...video, ...audio, "-t", length.toFixed(2), "-movflags", "+faststart", mp4,
  ]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", "2.6", "-i", mp4, "-frames:v", "1", "-vf", "scale=1280:-2", "-q:v", "5", `${OUT}/${sc.slug}.jpg`]);
  const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4]).toString());

  const entry = {
    slug: sc.slug,
    title: sc.title,
    summary: sc.summary,
    href: sc.href,
    hrefLabel: sc.hrefLabel,
    duration: Math.round(duration),
    chapters: marks.map((m) => ({ at: Math.max(0, Math.round(m.at * 10) / 10), label: m.label })),
  };
  const at = manifest.findIndex((m) => m.slug === sc.slug);
  if (at >= 0) manifest[at] = entry;
  else manifest.push(entry);
  manifest.sort((x, y) => SCENARIOS.findIndex((s) => s.slug === x.slug) - SCENARIOS.findIndex((s) => s.slug === y.slug));
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`  ${duration.toFixed(1)} s, ${(readFileSync(mp4).length / 1024 / 1024).toFixed(2)} MB`);
}

await browser.close();
