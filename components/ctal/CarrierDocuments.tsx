"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addCarrierDocument, deleteCarrierDocument } from "@/lib/ctal/actions";
import { fileSize } from "@/lib/ctal/compute";
import { createClient } from "@/lib/supabase/client";
import { DOC_KIND_LABEL, DOC_KINDS, DOC_MIME, DOCS_BUCKET, MAX_DOC_BYTES, type CarrierDocument, type DocKind } from "@/lib/ctal/types";
import { btn, btnPrimary, input } from "@/lib/ctal/ui";
import { formatTicketDate } from "@/lib/timezone";

/** A first guess from the file name; the owner can change it before uploading. */
function guessKind(name: string): DocKind {
  const n = name.toLowerCase();
  if (/insur|coi|liab|acord/.test(n)) return "insurance";
  if (/contract|agreement/.test(n)) return "contract";
  if (/cdl|licen/.test(n)) return "cdl";
  if (/w-?9/.test(n)) return "w9";
  return "other";
}

interface Queued {
  key: string;
  file: File;
  kind: DocKind;
  expiresOn: string;
  state: "ready" | "uploading" | "done" | "error";
  error?: string;
}

export function CarrierDocuments({ carrierId, documents, today }: { carrierId: string; documents: CarrierDocument[]; today: string }) {
  const router = useRouter();
  const [queue, setQueue] = useState<Queued[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ doc: CarrierDocument; url: string } | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  function add(files: FileList | File[]) {
    setMessage(null);
    const next: Queued[] = [];
    for (const file of files) {
      const type = file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "");
      const error = !DOC_MIME.includes(type) ? "Only PDF files and photos (JPG, PNG, WEBP, HEIC)." : file.size > MAX_DOC_BYTES ? "Larger than 20 MB." : undefined;
      next.push({ key: crypto.randomUUID(), file, kind: guessKind(file.name), expiresOn: "", state: error ? "error" : "ready", error });
    }
    setQueue((q) => [...q, ...next]);
  }

  const patch = (key: string, p: Partial<Queued>) => setQueue((q) => q.map((i) => (i.key === key ? { ...i, ...p } : i)));

  async function upload() {
    setBusy(true);
    const supabase = createClient();
    let failed = 0;
    for (const item of queue.filter((i) => i.state === "ready")) {
      patch(item.key, { state: "uploading" });
      const safe = item.file.name.normalize("NFD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "_").slice(-80) || "file";
      const path = `${carrierId}/${crypto.randomUUID()}-${safe}`;
      const mime = item.file.type || "application/pdf";
      const { error } = await supabase.storage.from(DOCS_BUCKET).upload(path, item.file, { contentType: mime, upsert: false });
      const saveError = error
        ? "The upload failed. Check the connection and try again."
        : await addCarrierDocument({ carrierId, kind: item.kind, label: "", storagePath: path, fileName: item.file.name, mime, size: item.file.size, expiresOn: item.expiresOn });
      if (saveError) failed += 1;
      patch(item.key, saveError ? { state: "error", error: saveError } : { state: "done" });
    }
    setBusy(false);
    setQueue((q) => q.filter((i) => i.state !== "done"));
    if (failed === 0) setMessage("Documents saved.");
    router.refresh();
  }

  async function open(doc: CarrierDocument) {
    const { data, error } = await createClient().storage.from(DOCS_BUCKET).createSignedUrl(doc.storage_path, 300);
    if (error || !data) return setMessage("The file could not be opened. Try again.");
    setPreview({ doc, url: data.signedUrl });
  }

  async function remove(doc: CarrierDocument) {
    if (!confirm(`Delete "${doc.file_name}"? The file is removed for good.`)) return;
    const err = await deleteCarrierDocument(doc.id);
    setMessage(err ?? "Document deleted.");
    router.refresh();
  }

  const ready = queue.filter((i) => i.state === "ready").length;

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
        className={`rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm ${over ? "border-pine-500 bg-pine-50" : "border-rule bg-paper"}`}
      >
        <p className="text-zinc-700">Drop the insurance, contract, CDL or any other file here</p>
        <p className="mt-1 text-xs text-zinc-500">PDF or photo, up to 20 MB each</p>
        <button type="button" onClick={() => picker.current?.click()} className={`${btn} mt-3`}>
          Choose files
        </button>
        <input ref={picker} type="file" multiple hidden accept={[...DOC_MIME, ".pdf", ".heic"].join(",")} onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }} />
      </div>

      {queue.length > 0 && (
        <div className="space-y-2">
          {queue.map((i) => (
            <div key={i.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-rule bg-white px-3 py-2 text-sm">
              <span className="min-w-40 flex-1 truncate font-medium">{i.file.name}</span>
              <span className="text-xs text-zinc-500">{fileSize(i.file.size)}</span>
              {i.state === "error" ? (
                <span className="text-xs text-red-700">{i.error}</span>
              ) : i.state === "uploading" ? (
                <span className="text-xs text-pine-700">Uploading…</span>
              ) : (
                <>
                  <select aria-label={`Type of ${i.file.name}`} value={i.kind} onChange={(e) => patch(i.key, { kind: e.target.value as DocKind })} className={`${input} w-32 py-1`}>
                    {DOC_KINDS.map((k) => (
                      <option key={k} value={k}>{DOC_KIND_LABEL[k]}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-zinc-600">
                    Expires
                    <input type="date" value={i.expiresOn} onChange={(e) => patch(i.key, { expiresOn: e.target.value })} className={`${input} w-36 py-1`} />
                  </label>
                </>
              )}
              <button type="button" aria-label={`Remove ${i.file.name} from the list`} onClick={() => setQueue((q) => q.filter((x) => x.key !== i.key))} disabled={i.state === "uploading"} className="rounded px-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-700">
                ✕
              </button>
            </div>
          ))}
          {ready > 0 && (
            <button type="button" onClick={upload} disabled={busy} className={btnPrimary}>
              {busy ? "Uploading…" : `Upload ${ready} file${ready === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      )}

      {message && <p role="status" className="text-sm text-pine-700">{message}</p>}

      {documents.length === 0 ? (
        <p className="text-sm text-zinc-500">No documents saved for this carrier yet.</p>
      ) : (
        <ul className="divide-y divide-rule rounded-lg border border-rule bg-white">
          {documents.map((doc) => {
            const expired = doc.expires_on !== null && doc.expires_on < today;
            return (
              <li key={doc.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                <span className="w-20 shrink-0 rounded bg-pine-100 px-1.5 py-0.5 text-center text-xs font-medium text-pine-900">{DOC_KIND_LABEL[doc.kind]}</span>
                <button type="button" onClick={() => open(doc)} className="min-w-40 flex-1 truncate text-left font-medium text-pine-900 hover:underline">
                  {doc.file_name}
                </button>
                {doc.expires_on && (
                  <span className={`text-xs tabular-nums ${expired ? "font-medium text-red-700" : "text-zinc-600"}`}>
                    {expired ? "Expired" : "Expires"} {formatTicketDate(doc.expires_on)}
                  </span>
                )}
                <span className="text-xs text-zinc-500 tabular-nums">
                  {fileSize(doc.size_bytes)}, added {formatTicketDate(doc.uploaded_at.slice(0, 10))}
                </span>
                <button type="button" onClick={() => remove(doc)} className="text-xs text-red-700 hover:underline">
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {preview && (
        <div role="dialog" aria-modal="true" aria-label={preview.doc.file_name} className="fixed inset-0 z-40 flex justify-end bg-pine-950/40" onClick={() => setPreview(null)} onKeyDown={(e) => e.key === "Escape" && setPreview(null)}>
          <div className="flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-rule px-4 py-2.5">
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{preview.doc.file_name}</p>
              <a href={preview.url} target="_blank" rel="noopener noreferrer" className={btn}>Open in a new tab</a>
              <button type="button" autoFocus onClick={() => setPreview(null)} className={btn}>Close</button>
            </div>
            <div className="min-h-0 flex-1 bg-zinc-100">
              {preview.doc.mime === "application/pdf" ? (
                <iframe src={preview.url} title={preview.doc.file_name} className="h-full w-full" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- private, short-lived signed URL
                <img src={preview.url} alt={preview.doc.file_name} className="mx-auto max-h-full max-w-full object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
