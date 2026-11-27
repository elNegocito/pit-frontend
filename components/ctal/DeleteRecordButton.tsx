"use client";

import { useState, useTransition } from "react";
import { deleteCarrier, deleteWeek } from "@/lib/ctal/actions";
import { btnDanger } from "@/lib/ctal/ui";

export function DeleteRecordButton({ kind, id, message }: { kind: "week" | "carrier"; id: string; message: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <button
        type="button"
        className={btnDanger}
        disabled={pending}
        onClick={() => {
          if (!window.confirm(message)) return;
          setError(null);
          start(async () => setError(await (kind === "week" ? deleteWeek(id) : deleteCarrier(id))));
        }}
      >
        {pending ? "Deleting…" : `Delete ${kind}`}
      </button>
      {error && <p role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}
