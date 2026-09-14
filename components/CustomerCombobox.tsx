"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}

/**
 * Customer field: text input with live suggestions from the registry.
 * Typing a brand-new name is allowed — the server upserts it on save.
 * An exact (case-insensitive) match snaps to the canonical stored name so
 * totals never split on casing ("ACME" vs "Acme").
 */
export function CustomerCombobox({ value, onChange, invalid }: Props) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [exactMatch, setExactMatch] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const q = value.trim();
      if (q.length === 0) {
        setOptions([]);
        setExactMatch(null);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from("customers")
        .select("name")
        .ilike("name", `%${q.replace(/[%_\\]/g, "")}%`)
        .order("name")
        .limit(8);
      const names = (data ?? []).map((r) => r.name);
      setOptions(names);
      const exact =
        names.find((n) => n.toUpperCase() === q.replace(/\s+/g, " ").toUpperCase()) ?? null;
      setExactMatch(exact);
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value]);

  const isNew = value.trim().length > 0 && !exactMatch && options.length === 0;

  return (
    <div ref={boxRef} className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Type to search or create…"
        autoComplete="off"
        className={`w-full rounded-lg border px-3 py-2 text-base ${invalid ? "border-red-500" : ""}`}
      />
      {open && options.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border bg-white shadow-lg">
          {options.map((name) => (
            <li key={name}>
              <button
                type="button"
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-base hover:bg-zinc-100"
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {exactMatch && (
        <p className="mt-1 text-xs text-zinc-500">Matched: {exactMatch}</p>
      )}
      {isNew && (
        <p className="mt-1 text-xs text-amber-700">
          New customer — it will be created on save.
        </p>
      )}
    </div>
  );
}
