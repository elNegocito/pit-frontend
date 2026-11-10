// Recording helpers for the CTAL tutorial videos: a visible cursor that moves
// like a hand does, typing at a human pace, intro / closing cards, the caption
// shown while each step plays, and pacing each step to its narration. See README.md in this folder.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const VIEW = { width: 1600, height: 900 };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * Runs in every document before the app's own code. Draws the cursor (the
 * browser's is not part of a recording), the caption and the full-screen cards.
 * State lives in sessionStorage so it survives full page loads.
 */
export function overlayScript(introHtml) {
  const css = `
    #tut-cursor{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;width:28px;height:28px;margin:-3px 0 0 -5px;
      filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));transition:opacity .2s}
    #tut-ring{position:fixed;left:0;top:0;z-index:2147483646;pointer-events:none;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;
      border:3px solid #f59e0b;opacity:0}
    #tut-ring.go{animation:tut-ring .45s ease-out}
    @keyframes tut-ring{from{opacity:.9;scale:.35}to{opacity:0;scale:1.15}}
    #tut-caption{position:fixed;top:9px;left:50%;translate:-50% 0;z-index:2147483645;pointer-events:none;max-width:660px;
      padding:7px 18px;border-radius:999px;background:#fff;color:#0f2e26;font:600 15px/1.3 var(--font-geist-sans),system-ui,sans-serif;
      box-shadow:0 2px 10px rgba(0,0,0,.25);white-space:nowrap;opacity:0;transition:opacity .25s}
    #tut-caption.on{opacity:1}
    #tut-card{position:fixed;inset:0;z-index:2147483647;background:#143d32;color:#fff;display:flex;align-items:center;justify-content:center;
      font-family:var(--font-geist-sans),system-ui,sans-serif;transition:opacity .45s}
    #tut-card.off{opacity:0}
    #tut-card .box{width:1040px}
    #tut-card .kicker{font-size:20px;color:#c9ddd3;margin:0 0 14px}
    #tut-card h1{font-size:64px;line-height:1.05;letter-spacing:-.02em;font-weight:650;margin:0 0 34px}
    #tut-card ol{margin:0;padding:0;list-style:none;display:grid;gap:12px}
    #tut-card li{font-size:25px;color:#e2ede7;display:flex;gap:16px;align-items:baseline;opacity:0;animation:tut-in .5s ease-out forwards}
    #tut-card li b{font-weight:600;color:#3d8a72;font-variant-numeric:tabular-nums;width:26px}
    #tut-card p.next{font-size:30px;color:#e2ede7;margin:0}
    #tut-card img{max-height:760px;max-width:1300px;border-radius:6px;box-shadow:0 20px 60px rgba(0,0,0,.45);background:#fff}
    #tut-card .cap{font-size:22px;color:#c9ddd3;margin:0 0 18px;text-align:center}
    @keyframes tut-in{from{opacity:0;translate:0 10px}to{opacity:1;translate:0 0}}
    html.tut-hold body>*:not(#tut-card){visibility:hidden}
  `;
  return `(() => {
    if (window.top !== window || location.protocol === "about:") return;
    const SS = sessionStorage;
    const INTRO = ${JSON.stringify(introHtml)};
    const style = document.createElement("style");
    style.textContent = ${JSON.stringify(css)};
    const el = (id, html) => { const d = document.createElement("div"); d.id = id; if (html) d.innerHTML = html; return d; };
    const cursor = el("tut-cursor", '<svg viewBox="0 0 28 28" width="28" height="28"><path d="M5 3l0 19 5-4.6 3.2 7.4 3.4-1.5-3.2-7.3 6.9-.4z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>');
    const ring = el("tut-ring");
    const caption = el("tut-caption");
    let card = null;
    const place = (x, y) => { cursor.style.translate = x + "px " + y + "px"; ring.style.translate = x + "px " + y + "px"; };
    const [x0, y0] = (SS.getItem("tut-pos") || "800,470").split(",").map(Number);
    place(x0, y0);
    const showCard = (html) => {
      card?.remove();
      card = el("tut-card", html);
      cursor.style.opacity = "0";
      caption.classList.remove("on");
      document.body.appendChild(card);
    };
    window.__tut = {
      card: showCard,
      hideCard: () => new Promise((done) => {
        SS.setItem("tut-intro-done", "1");
        document.documentElement.classList.remove("tut-hold");
        cursor.style.opacity = "1";
        if (!card) return done();
        card.classList.add("off");
        setTimeout(() => { card?.remove(); card = null; done(); }, 480);
      }),
      caption: (text) => {
        SS.setItem("tut-caption", text);
        caption.classList.remove("on");
        setTimeout(() => { caption.textContent = text; if (text) caption.classList.add("on"); }, text ? 180 : 0);
      },
    };
    const mount = () => {
      if (!document.body) return false;
      for (const n of [style, ring, caption, cursor]) if (!n.isConnected) (n === style ? document.head : document.body).appendChild(n);
      return true;
    };
    const first = () => {
      if (!mount()) return false;
      const text = SS.getItem("tut-caption");
      if (text) { caption.textContent = text; caption.classList.add("on"); }
      if (INTRO && !SS.getItem("tut-intro-done")) { document.documentElement.classList.add("tut-hold"); showCard(INTRO); }
      return true;
    };
    if (!first()) { const mo = new MutationObserver(() => { if (first()) mo.disconnect(); }); mo.observe(document, { childList: true, subtree: true }); }
    // The app may re-render the body: put the overlay back if it was dropped.
    setInterval(mount, 250);
    addEventListener("mousemove", (e) => { place(e.clientX, e.clientY); SS.setItem("tut-pos", e.clientX + "," + e.clientY); }, true);
    addEventListener("mousedown", () => { ring.classList.remove("go"); void ring.offsetWidth; ring.classList.add("go"); }, true);
  })();`;
}

export function introCard(index, total, title, steps) {
  return `<div class="box"><p class="kicker">CTAL tutorials, video ${index} of ${total}</p><h1>${esc(title)}</h1><ol>${steps
    .map((s, i) => `<li style="animation-delay:${0.35 + i * 0.16}s"><b>${i + 1}</b><span>${esc(s)}</span></li>`)
    .join("")}</ol></div>`;
}

export const outroCard = (next) =>
  `<div class="box"><p class="kicker">${next ? "Next video" : "End of the tutorials"}</p><h1>${esc(next ?? "You are ready to run the week in CTAL")}</h1></div>`;

/** First page of a PDF as a picture card ("this is what gets printed"). */
export function pdfCard(pdfPath, captionText) {
  const base = pdfPath.replace(/\.pdf$/, "");
  execFileSync("pdftoppm", ["-png", "-r", "96", "-f", "1", "-l", "1", "-singlefile", pdfPath, base]);
  const png = readFileSync(`${base}.png`).toString("base64");
  return `<div><p class="cap">${esc(captionText)}</p><img src="data:image/png;base64,${png}" alt=""></div>`;
}

/** Everything a scenario needs to act on the page the way a person would. */
export function actor(page, marks, clock, lineSeconds = []) {
  let mx = 800;
  let my = 470;
  // When the narration of the current step ends (video seconds).
  let lineEnd = 0;

  async function moveTo(x, y) {
    const dist = Math.hypot(x - mx, y - my);
    if (dist < 2) return;
    const duration = Math.min(1050, 260 + dist * 0.85);
    const steps = Math.max(8, Math.round(duration / 16));
    // A slight arc instead of a ruler-straight line.
    const bend = Math.min(60, dist * 0.12) * (Math.random() < 0.5 ? -1 : 1);
    const cx = (mx + x) / 2 + (-(y - my) / (dist || 1)) * bend;
    const cy = (my + y) / 2 + ((x - mx) / (dist || 1)) * bend;
    const sx = mx;
    const sy = my;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // ease in-out
      const px = (1 - e) * (1 - e) * sx + 2 * (1 - e) * e * cx + e * e * x;
      const py = (1 - e) * (1 - e) * sy + 2 * (1 - e) * e * cy + e * e * y;
      await page.mouse.move(px, py);
      await sleep(14);
    }
    mx = x;
    my = y;
  }

  const loc = (target) => (typeof target === "string" ? page.locator(target).first() : target);

  async function point(target, { dx = 0.5, dy = 0.5 } = {}) {
    const l = loc(target);
    await l.waitFor({ state: "visible", timeout: 15000 });
    await l.scrollIntoViewIfNeeded();
    const b = await l.boundingBox();
    if (!b) throw new Error("not visible: " + target);
    await moveTo(b.x + b.width * dx + rand(-2, 2), b.y + b.height * dy + rand(-1.5, 1.5));
  }

  const a = {
    page,
    sleep,
    /** A new step: shown as the caption and listed as a chapter of the video. */
    async step(label, pause = 900) {
      await a.finishLine();
      const at = clock();
      // The voice starts a beat after the caption changes.
      marks.push({ at, label, voiceAt: at + 0.35 });
      lineEnd = at + 0.35 + (lineSeconds[marks.length - 1] ?? 0);
      await page.evaluate((t) => window.__tut.caption(t), label);
      await sleep(pause);
    },
    /** Hold the screen until the narration of the current step is over. */
    async finishLine() {
      const wait = lineEnd + 0.45 - clock();
      if (wait > 0) await sleep(wait * 1000);
    },
    /** Rest the cursor on something to draw the eye to it. */
    async look(target, ms = 900, opts) {
      await point(target, opts);
      await sleep(ms);
    },
    async click(target, opts) {
      await point(target, opts);
      await sleep(rand(140, 260));
      await page.mouse.down();
      await sleep(rand(55, 95));
      await page.mouse.up();
      await sleep(rand(260, 420));
    },
    async type(text, { fast = false } = {}) {
      for (const ch of text) {
        await page.keyboard.type(ch);
        await sleep(fast ? rand(28, 60) : rand(65, 135));
      }
      await sleep(260);
    },
    async key(k, pause = 380) {
      await page.keyboard.press(k);
      await sleep(pause);
    },
    /** Click a field, clear what it has, type the new value. */
    async fill(target, text, opts) {
      await a.click(target, opts);
      await page.keyboard.press("Control+A");
      await a.type(text, opts);
    },
    /** A date field: click its month part, then type the digits (MMDDYYYY). */
    async date(target, digits) {
      const l = loc(target);
      await l.scrollIntoViewIfNeeded();
      const b = await l.boundingBox();
      await moveTo(b.x + 22, b.y + b.height / 2);
      await sleep(200);
      await page.mouse.down();
      await sleep(70);
      await page.mouse.up();
      await sleep(300);
      await a.type(digits);
    },
    /** A native <select>: its list is drawn by the system, outside the recording. */
    async choose(target, value) {
      await point(target);
      await sleep(220);
      await loc(target).selectOption(value);
      await sleep(500);
    },
    async scrollBy(dy, ms = 700) {
      const n = Math.max(6, Math.round(ms / 16));
      for (let i = 0; i < n; i++) {
        await page.mouse.wheel(0, dy / n);
        await sleep(16);
      }
      await sleep(250);
    },
    async card(html, ms) {
      await page.evaluate((h) => window.__tut.card(h), html);
      await sleep(ms);
      await page.evaluate(() => window.__tut.hideCard());
    },
    async settle(ms = 500) {
      await page.waitForLoadState("networkidle").catch(() => {});
      await sleep(ms);
    },
  };
  return a;
}
