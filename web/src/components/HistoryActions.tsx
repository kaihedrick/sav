import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "../lib/api";
import { ConfirmDialog } from "./ConfirmDialog";

export function HistoryActions({ request }: { request: { id: string; lines: { itemId: string; qty: number; itemName?: string }[] } }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [quantities, setQuantities] = useState<string[]>([]);
  const save = useMutation({
    mutationFn: (remove: boolean) => apiJson(`/requests/${request.id}`, remove ? { method: "DELETE" } : {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines: request.lines.map((line, index) => ({ itemId: line.itemId, qty: Number(quantities[index]) })) }),
    }),
    onSuccess: () => {
      setEditing(false);
      setConfirmDelete(false);
      for (const key of ["my-requests", "admin-requests", "community-requests", "inventory"]) void qc.invalidateQueries({ queryKey: [key] });
    },
  });
  const valid = quantities.length === request.lines.length && quantities.every(value => Number.isSafeInteger(Number(value)) && Number(value) > 0);
  return <div className="mt-3">
    {editing ? <form onSubmit={event => { event.preventDefault(); if (valid && !save.isPending) save.mutate(false); }}>
      <div className="space-y-2">{request.lines.map((line, index) => <label key={`${line.itemId}-${index}`} className="flex items-center justify-between gap-3 text-sm">
        <span>{line.itemName ?? `Item ${index + 1}`} quantity</span>
        <input type="number" min="1" step="1" required inputMode="numeric" disabled={save.isPending} value={quantities[index] ?? ""}
          onChange={event => setQuantities(values => values.map((value, i) => i === index ? event.target.value : value))}
          className="min-h-11 w-24 rounded-lg border border-bob-mist bg-white px-2 text-base" />
      </label>)}</div>
      <p className="mt-2 text-xs text-bob-muted">Adding quantity increases On hand. Reducing or deleting an entry needs a manual stock correction by an admin.</p>
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={!valid || save.isPending} className="min-h-11 rounded-full bg-bob-wood px-4 text-sm text-white disabled:opacity-50">{save.isPending ? "Saving…" : "Save"}</button>
        <button type="button" disabled={save.isPending} className="surface-glass-btn min-h-11 px-4 text-sm" onClick={() => { setEditing(false); save.reset(); }}>Cancel</button>
      </div>
    </form> : <div className="flex flex-wrap gap-2">
      <button type="button" disabled={save.isPending} className="surface-glass-btn min-h-11 px-3 text-sm" onClick={() => { setQuantities(request.lines.map(line => String(line.qty))); save.reset(); setEditing(true); }}><i className="fa-solid fa-pen mr-2" aria-hidden />Edit</button>
      <button type="button" disabled={save.isPending} className="min-h-11 rounded-full border border-rose-200 bg-rose-50 px-3 text-sm text-rose-800" onClick={() => { save.reset(); setConfirmDelete(true); }}><i className="fa-solid fa-trash mr-2" aria-hidden />Delete</button>
    </div>}
    {save.error && !confirmDelete ? <p role="alert" className="mt-2 text-sm text-red-700">{save.error.message}</p> : null}
    <ConfirmDialog open={confirmDelete} title="Delete this entry?"
      description="This removes the contribution from history. An admin will need to correct On hand manually."
      busy={save.isPending} error={save.error?.message}
      onCancel={() => { setConfirmDelete(false); save.reset(); }}
      onConfirm={() => { if (!save.isPending) save.mutate(true); }}>
      <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-xl bg-white/70 p-3 text-sm">
        {request.lines.map((line, index) => <li key={`${line.itemId}-${index}`} className="break-words">{line.itemName ?? `Item ${index + 1}`} × {line.qty}</li>)}
      </ul>
    </ConfirmDialog>
  </div>;
}
