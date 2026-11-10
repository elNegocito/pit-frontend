import manifest from "./tutorials.json";

/** One tutorial video. The list is written by scripts/ctal-tutorials (do not edit by hand). */
export interface Tutorial {
  slug: string;
  title: string;
  summary: string;
  /** Screen of the app the video is about. */
  href: string;
  hrefLabel: string;
  /** Seconds. */
  duration: number;
  /** Steps shown in the video, with the second each one starts at. */
  chapters: { at: number; label: string }[];
}

export const TUTORIALS = manifest as Tutorial[];

export const videoSrc = (slug: string) => `/ctal-help/${slug}.mp4`;
export const posterSrc = (slug: string) => `/ctal-help/${slug}.jpg`;

/** 75 -> "1:15" */
export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
