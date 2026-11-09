"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ComboOption {
  value: string;
  label: string;
  /** Shown to the right of the label (pay term, city...). */
  hint?: string;
  /** Extra text the option can be found by (carrier number, USDOT...). */
  search?: string;
  /** Marks options that need attention (expired insurance). */
  warn?: boolean;
}

/** Lowercase without accents, so "aleman" finds "ALEMÁN". Keeps the length of precomposed text. */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Best matches first: starts with, then a word starts with, then contains. */
export function rank(options: ComboOption[], query: string, limit = 50): ComboOption[] {
  const q = fold(query.trim());
  if (!q) return options.slice(0, limit);
  const scored: [number, ComboOption][] = [];
  for (const o of options) {
    const l = fold(o.label);
    const at = l.indexOf(q);
    const score = at === 0 ? 0 : at > 0 && /[\s/#-]/.test(l[at - 1]) ? 1 : at > 0 ? 2 : o.search && fold(o.search).includes(q) ? 3 : -1;
    if (score >= 0) scored.push([score, o]);
  }
  return scored.sort((a, b) => a[0] - b[0]).slice(0, limit).map(([, o]) => o);
}

export function Highlight({ text, query }: { text: string; query: string }) {
  const q = fold(query.trim());
  const at = q ? fold(text).indexOf(q) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-amber-200/70 text-inherit">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

/**
 * Text field that suggests matches as you type. `onChange` gets the text and
 * the picked option (null while the text is free typing). The list is drawn
 * in a portal so it is never clipped by a scrolling table.
 */
export function Combobox({
  value,
  options,
  onChange,
  onCreate,
  placeholder,
  className,
  invalid,
  name,
  ariaLabel,
  title,
  dataCell,
  emptyText = "No matches",
}: {
  value: string;
  options: ComboOption[];
  onChange: (text: string, option: ComboOption | null) => void;
  /** Offers "Add «text»" when nothing matches exactly. */
  onCreate?: (text: string) => void;
  placeholder?: string;
  className?: string;
  invalid?: boolean;
  name?: string;
  ariaLabel?: string;
  title?: string;
  /** data-row / data-col of a grid cell (keyboard navigation). */
  dataCell?: { row: number; col: number };
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Typing filters; just focusing shows everything.
  const [typed, setTyped] = useState(false);
  const [box, setBox] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const listId = useId();

  const query = typed ? value : "";
  const matches = open ? rank(options, query) : [];
  const exact = options.some((o) => fold(o.label) === fold(value.trim()));
  const canCreate = Boolean(onCreate) && typed && value.trim().length > 0 && !exact;
  const count = matches.length + (canCreate ? 1 : 0);

  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const place = () => {
      const r = ref.current!.getBoundingClientRect();
      const up = window.innerHeight - r.bottom < 260 && r.top > 260;
      setBox({ left: r.left, top: up ? r.top : r.bottom, width: Math.max(r.width, 240), up });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, listId]);

  function close() {
    setOpen(false);
    setTyped(false);
    setActive(0);
  }

  function pick(i: number) {
    if (i < matches.length) onChange(matches[i].label, matches[i]);
    else if (canCreate) onCreate!(value.trim());
    close();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      if (!open) return setOpen(true);
      if (count > 0) setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + count) % count);
    } else if (e.key === "Enter" && open && typed && count > 0) {
      // Enter confirms the highlighted suggestion (a second Enter moves down the grid).
      e.preventDefault();
      e.stopPropagation();
      pick(active);
    } else if (e.key === "Escape" && open) {
      e.stopPropagation();
      close();
    } else if (e.key === "Tab" && open && typed && matches.length > 0 && !exact) {
      // Tab takes the best suggestion and moves on, like a spreadsheet autocomplete.
      pick(Math.min(active, matches.length - 1));
    }
  }

  return (
    <>
      <input
        ref={ref}
        name={name}
        value={value}
        onChange={(e) => {
          const text = e.target.value;
          const hit = options.find((o) => fold(o.label) === fold(text.trim())) ?? null;
          onChange(text, hit);
          setTyped(true);
          setOpen(true);
          setActive(0);
        }}
        onFocus={(e) => {
          setOpen(true);
          e.target.select();
        }}
        onBlur={close}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-label={ariaLabel}
        title={title}
        aria-expanded={open && count > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        aria-activedescendant={open && count > 0 ? `${listId}-${active}` : undefined}
        data-row={dataCell?.row}
        data-col={dataCell?.col}
        className={className}
      />
      {open &&
        box &&
        createPortal(
          <ul
            id={listId}
            role="listbox"
            // Keeps the input focused, so its blur does not close the list before the click lands.
            onMouseDown={(e) => e.preventDefault()}
            style={{ left: box.left, width: box.width, ...(box.up ? { bottom: window.innerHeight - box.top + 4 } : { top: box.top + 4 }) }}
            className="fixed z-50 max-h-64 overflow-auto rounded-lg border border-rule bg-white py-1 font-sans text-sm shadow-xl shadow-pine-950/10"
          >
            {matches.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(i)}
                className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1.5 ${i === active ? "bg-pine-100" : ""}`}
              >
                <span className="truncate">
                  <Highlight text={o.label} query={query} />
                </span>
                {o.hint && <span className={`shrink-0 text-xs ${o.warn ? "font-medium text-red-700" : "text-zinc-500"}`}>{o.hint}</span>}
              </li>
            ))}
            {canCreate && (
              <li
                id={`${listId}-${matches.length}`}
                role="option"
                aria-selected={active === matches.length}
                onMouseEnter={() => setActive(matches.length)}
                onClick={() => pick(matches.length)}
                className={`cursor-pointer border-t border-rule px-3 py-1.5 text-pine-900 ${active === matches.length ? "bg-pine-100" : ""}`}
              >
                Add “{value.trim()}”
              </li>
            )}
            {count === 0 && <li className="px-3 py-1.5 text-zinc-500">{emptyText}</li>}
          </ul>,
          document.body,
        )}
    </>
  );
}
