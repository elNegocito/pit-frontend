"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { clock, posterSrc, videoSrc, type Tutorial } from "@/lib/ctal/tutorials";
import { btn, card } from "@/lib/ctal/ui";

const KEY = "ctal-tutorials-watched";
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
const readWatched = () => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};
function markWatched(slug: string) {
  try {
    const set = new Set(readWatched().split(",").filter(Boolean)).add(slug);
    localStorage.setItem(KEY, [...set].join(","));
  } catch {
    // Private browsing: the checkmarks just do not stick.
  }
  listeners.forEach((fn) => fn());
}

export function TutorialPlayer({ tutorials, initial }: { tutorials: Tutorial[]; initial?: string }) {
  const [slug, setSlug] = useState(tutorials.some((t) => t.slug === initial) ? initial! : tutorials[0].slug);
  const [time, setTime] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const autoplay = useRef(false);
  const watched = new Set(useSyncExternalStore(subscribe, readWatched, () => "").split(",").filter(Boolean));

  const index = tutorials.findIndex((t) => t.slug === slug);
  const current = tutorials[index];
  const next = tutorials[index + 1];
  const chapter = current.chapters.findLast((c) => time >= c.at - 0.2);

  // Picking a video from the list starts it; the first one waits for a press on play.
  useEffect(() => {
    if (autoplay.current) void video.current?.play().catch(() => {});
  }, [slug]);

  function open(s: string) {
    autoplay.current = true;
    setTime(0);
    setSlug(s);
    history.replaceState(null, "", `?v=${s}`);
  }

  function seek(at: number) {
    const v = video.current;
    if (!v) return;
    v.currentTime = at;
    void v.play().catch(() => {});
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <div className="overflow-hidden rounded-xl border border-pine-950 bg-pine-950">
          <video
            key={slug}
            ref={video}
            src={videoSrc(slug)}
            poster={posterSrc(slug)}
            controls
            playsInline
            preload="metadata"
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onEnded={() => markWatched(slug)}
            className="aspect-video w-full"
          >
            Your browser cannot play this video.
          </video>
        </div>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold tracking-tight">{current.title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-600">{current.summary}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={current.href} className={btn}>
              {current.hrefLabel}
            </Link>
            {next && (
              <button type="button" onClick={() => open(next.slug)} className={btn}>
                Next: {next.title}
              </button>
            )}
          </div>
        </div>

        <section className={`${card} mt-4 p-4`} aria-labelledby="steps-h">
          <h3 id="steps-h" className="text-sm font-semibold">
            In this video
          </h3>
          <ol className="mt-2 grid gap-x-6 sm:grid-cols-2">
            {current.chapters.map((c) => (
              <li key={c.at}>
                <button
                  type="button"
                  onClick={() => seek(c.at)}
                  aria-current={chapter === c ? "step" : undefined}
                  className={`flex w-full items-baseline gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-pine-50 ${chapter === c ? "bg-pine-100 font-medium text-pine-950" : "text-zinc-700"}`}
                >
                  <span className="w-9 shrink-0 text-xs text-zinc-500 tabular-nums">{clock(c.at)}</span>
                  {c.label}
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <nav aria-label="All tutorials" className={`${card} self-start overflow-hidden`}>
        <ol>
          {tutorials.map((t, i) => (
            <li key={t.slug} className="border-b border-rule last:border-0">
              <button
                type="button"
                onClick={() => open(t.slug)}
                aria-current={t.slug === slug ? "true" : undefined}
                className={`flex w-full items-center gap-3 p-2.5 text-left ${t.slug === slug ? "bg-pine-100" : "hover:bg-pine-50"}`}
              >
                <span className="relative block w-28 shrink-0 overflow-hidden rounded-md border border-rule bg-pine-950">
                  {/* eslint-disable-next-line @next/next/no-img-element -- small static poster, no optimizer needed */}
                  <img src={posterSrc(t.slug)} alt="" loading="lazy" className="aspect-video w-full object-cover" />
                  <span className="absolute right-1 bottom-1 rounded bg-pine-950/85 px-1 text-[11px] font-medium text-white tabular-nums">{clock(t.duration)}</span>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm leading-snug font-medium">
                    {i + 1}. {t.title}
                  </span>
                  <span className={`text-xs ${watched.has(t.slug) ? "text-pine-700" : "text-zinc-500"}`}>{watched.has(t.slug) ? "Watched" : `${t.chapters.length} steps`}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
