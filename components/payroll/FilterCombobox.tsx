"use client";

import { useId, useState } from "react";

/**
 * Search field of a GET filter form: a select you can also type in, narrowing
 * the options as you type. Free text is still submitted, so a partial name
 * keeps working as a search. Remount it (key) when the URL value changes.
 */
export function FilterCombobox({
  name,
  options,
  defaultValue,
  placeholder,
}: {
  name: string;
  options: string[];
  defaultValue: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();

  const q = value.trim().toUpperCase();
  const matches = q ? options.filter((o) => o.toUpperCase().includes(q)) : options;
  const showList = open && matches.length > 0;

  function pick(option: string) {
    setValue(option);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!showList) return setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + step + matches.length) % matches.length);
    } else if (e.key === "Enter" && showList && active >= 0) {
      // Enter without a highlighted option submits the search as usual.
      e.preventDefault();
      pick(matches[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative mt-1">
      <input
        name={name}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        className="w-full rounded-lg border py-2 pr-8 pl-3 font-normal"
      />
      <span aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-zinc-500">
        ▾
      </span>
      {showList && (
        // preventDefault keeps the input focused so its blur does not close the list first.
        <ul
          id={listId}
          role="listbox"
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-white font-normal shadow-lg"
        >
          {matches.map((option, i) => (
            <li
              key={option}
              role="option"
              aria-selected={i === active}
              onClick={(e) => {
                // The field sits in a <label>: without this the click is
                // forwarded to the input, which would reopen the list.
                e.preventDefault();
                pick(option);
              }}
              className={`cursor-pointer px-3 py-2 text-sm hover:bg-zinc-100 ${i === active ? "bg-zinc-100" : ""}`}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
