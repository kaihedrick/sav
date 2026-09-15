import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function ConfirmDialog({ open, title, description, children, busy, error, onCancel, onConfirm }: {
  open: boolean;
  title: string;
  description: string;
  children?: ReactNode;
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    cancelButton.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={busy}
      onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto overscroll-contain rounded-2xl border border-bob-mist bg-bob-cream p-5 text-bob-ink shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-800"><i className="fa-solid fa-trash" aria-hidden /></div>
      <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
      <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-bob-muted">{description}</p>
      {children}
      {error ? <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button ref={cancelButton} type="button" disabled={busy} onClick={onCancel} className="surface-glass-btn min-h-11 px-3 text-sm font-semibold disabled:opacity-50">Cancel</button>
        <button type="button" disabled={busy} onClick={onConfirm} className="min-h-11 rounded-full bg-rose-700 px-3 text-sm font-semibold text-white hover:bg-rose-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 disabled:opacity-60">
          {busy ? "Deleting…" : "Delete entry"}
        </button>
      </div>
    </dialog>, document.body,
  );
}
