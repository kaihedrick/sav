import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "../components/Layout";
import { apiJson, apiFetch } from "../lib/api";
import {
  parseInventoryExcel,
  type ParsedInventoryRow,
} from "../lib/parseInventoryExcel";
import {
  buildInventoryXlsxBuffer,
  inventoryToTsv,
  type InventoryExportRow,
} from "../lib/inventoryExcel";
import { saveInventoryExportTemplate } from "../lib/inventoryExportTemplateStorage";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import {
  categoryAccent,
  inventoryGlassCardClass,
  itemEmoji,
  stockLevelFromOnHand,
  stockStatusClasses,
} from "../lib/inventoryCardStyle";

function onUnsignedIntInputChange(
  set: (v: string) => void,
): (e: ChangeEvent<HTMLInputElement>) => void {
  return (e) => {
    const v = e.target.value;
    if (v === "" || /^\d*$/.test(v)) set(v);
  };
}

type InvItem = {
  id: string;
  name: string;
  category: string;
  targetQty: number;
  price?: number;
  notes?: string;
  onHand: number;
  projected: number;
};

type SheetSyncBody = {
  googleSheetSync?: "ok" | "skipped" | "error";
  googleSheetSyncError?: string;
};

function sheetSyncAlert(data: SheetSyncBody): string | null {
  if (data.googleSheetSync === "error" && data.googleSheetSyncError?.trim()) {
    return data.googleSheetSyncError;
  }
  return null;
}

export function AdminDashboard() {
  const qc = useQueryClient();

  const inv = useQuery({
    queryKey: ["inventory"],
    queryFn: () => apiJson<{ items: InvItem[] }>("/inventory"),
  });

  const liveSheet = useQuery({
    queryKey: ["inventory-sheet"],
    queryFn: () =>
      apiJson<{ url: string | null; syncEnabled: boolean }>("/inventory/sheet"),
  });

  const [name, setName] = useState("");
  const [targetQtyInput, setTargetQtyInput] = useState("0");
  const [category, setCategory] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [sheetSyncPending, setSheetSyncPending] = useState(false);
  const [editItem, setEditItem] = useState<InvItem | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  /** Full sheet rewrite (same as POST /admin/inventory/sync-google-sheet). Backs up inline API sync. */
  async function pushLiveGoogleSheet(): Promise<{ rowCount: number } | undefined> {
    try {
      const res = await apiJson<{ ok: boolean; rowCount: number }>(
        "/admin/inventory/sync-google-sheet",
        { method: "POST" },
      );
      setImportErr(null);
      await qc.invalidateQueries({ queryKey: ["inventory-sheet"] });
      return { rowCount: res.rowCount };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      setImportErr(`Google Sheet sync: ${msg}`);
      return undefined;
    }
  }

  async function manualSyncGoogleSheet() {
    setImportMsg(null);
    setSheetSyncPending(true);
    try {
      const r = await pushLiveGoogleSheet();
      if (r) {
        setImportMsg(`Google Sheet synced (${r.rowCount} rows).`);
      }
    } finally {
      setSheetSyncPending(false);
    }
  }

  const createItem = useMutation({
    mutationFn: () => {
      const raw = targetQtyInput.trim();
      const targetQty =
        raw === "" ? 0 : Math.max(0, Math.floor(Number(raw)));
      return apiJson("/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, targetQty }),
      });
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setName("");
      setCategory("");
      setTargetQtyInput("0");
      await pushLiveGoogleSheet();
    },
  });

  const importExcel = useMutation({
    mutationFn: (items: ParsedInventoryRow[]) =>
      apiJson<{
        created: number;
        updated: number;
        total: number;
        replaceAll?: boolean;
        deletedBefore?: number;
      }>(
        "/admin/items/import",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items, replaceAll: true }),
        },
      ),
    onSuccess: async (data) => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      const syncErr = sheetSyncAlert(data as SheetSyncBody);
      if (syncErr) {
        setImportErr(`Saved inventory, but Google Sheet sync failed: ${syncErr}`);
        setImportMsg(null);
      } else {
        setImportMsg(
          data.replaceAll
            ? `Import · Catalog replaced (${data.deletedBefore ?? 0} previous items removed, ${data.created} imported)`
            : `Import · ${data.created} new, ${data.updated} updated (${data.total} rows)`,
        );
        setImportErr(null);
      }
      if (excelInputRef.current) excelInputRef.current.value = "";
      await pushLiveGoogleSheet();
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Import failed";
      const hint =
        /admin only/i.test(msg)
          ? " The API rejected admin: your signed-in Google email must be listed in Lambda ADMIN_EMAIL (comma-separated allowed), same list as VITE_ADMIN_EMAIL in web/.env — then sam deploy. If your JWT still says contributor, sign out and sign in once."
          : "";
      setImportErr(msg + hint);
      setImportMsg(null);
    },
  });

  const setStock = async (itemId: string, quantity: number) => {
    const res = await apiFetch(`/items/${itemId}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    const body = (await res.json().catch(() => ({}))) as SheetSyncBody & {
      error?: string;
    };
    if (!res.ok) {
      setImportErr(body.error ?? `HTTP ${res.status}`);
      setImportMsg(null);
      return;
    }
    const syncErr = sheetSyncAlert(body);
    if (syncErr) {
      setImportErr(`Google Sheet did not update: ${syncErr}`);
      setImportMsg(null);
    } else {
      setImportErr(null);
    }
    await qc.invalidateQueries({ queryKey: ["inventory"] });
    await qc.invalidateQueries({ queryKey: ["inventory-sheet"] });
  };

  const patchItem = async (
    itemId: string,
    patch: { name?: string; category?: string; targetQty?: number },
  ) => {
    const body = await apiJson<Record<string, unknown> & SheetSyncBody>(
      `/items/${itemId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      },
    );
    const syncErr = sheetSyncAlert(body);
    if (syncErr) {
      setImportErr(`Google Sheet did not update: ${syncErr}`);
      setImportMsg(null);
    } else {
      setImportErr(null);
    }
    await qc.invalidateQueries({ queryKey: ["inventory"] });
    await qc.invalidateQueries({ queryKey: ["inventory-sheet"] });
  };

  /** @returns true if the item was deleted */
  const removeItem = async (itemId: string, name: string): Promise<boolean> => {
    if (
      !window.confirm(
        `Delete “${name}” from the catalog? This cannot be undone.`,
      )
    ) {
      return false;
    }
    const res = await apiFetch(`/items/${itemId}`, { method: "DELETE" });
    const body = (await res.json().catch(() => ({}))) as SheetSyncBody & {
      error?: string;
    };
    if (!res.ok) {
      setImportErr(body.error ?? `HTTP ${res.status}`);
      setImportMsg(null);
      return false;
    }
    const syncErr = sheetSyncAlert(body);
    if (syncErr) {
      setImportErr(`Item removed, but Google Sheet did not update: ${syncErr}`);
      setImportMsg(null);
    } else {
      setImportErr(null);
    }
    await qc.invalidateQueries({ queryKey: ["inventory"] });
    await qc.invalidateQueries({ queryKey: ["inventory-sheet"] });
    await pushLiveGoogleSheet();
    return true;
  };

  const items = inv.data?.items ?? [];

  const exportRows: InventoryExportRow[] = items.map((it) => ({
    id: it.id,
    name: it.name,
    category: it.category,
    price: it.price,
    targetQty: it.targetQty,
    onHand: it.onHand,
    projected: it.projected,
    notes: it.notes,
  }));

  async function downloadExcel() {
    const buf = await buildInventoryXlsxBuffer(exportRows);
    const copy = new Uint8Array(buf.length);
    copy.set(buf);
    const blob = new Blob([copy], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = "Bags of Blessings.xlsx";
    a.click();
    URL.revokeObjectURL(u);
  }

  async function copyInventoryTsv() {
    setCopyMsg(null);
    try {
      await navigator.clipboard.writeText(inventoryToTsv(exportRows));
      setCopyMsg("Copied table (tab-separated) — paste into Excel or Sheets.");
    } catch {
      setCopyMsg("Could not copy — try Export Excel instead.");
    }
    setTimeout(() => setCopyMsg(null), 4000);
  }

  return (
    <Layout isAdmin>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-bob-ink">
          <i className="fa-solid fa-screwdriver-wrench text-bob-gold" aria-hidden />
          Admin — catalog & stock
        </h1>
        <Link
          to="/admin/requests"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-bob-gold px-4 py-2 text-center text-sm font-semibold text-white shadow-md shadow-bob-wood/15 transition-colors hover:bg-bob-gold-dark"
        >
          <i className="fa-solid fa-inbox" aria-hidden />
          Open request inbox
        </Link>
      </div>

      {liveSheet.data?.url != null && liveSheet.data.syncEnabled === false ? (
        <div
          className="mb-6 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-sm"
          role="alert"
        >
          <p className="font-medium text-amber-900">
            Automatic Google Sheet sync is off
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
            The API needs both spreadsheet ID and the service account secret (
            <code className="rounded bg-white/80 px-1 font-mono text-[0.8rem]">
              GoogleSheetsSecretArn
            </code>{" "}
            or{" "}
            <code className="rounded bg-white/80 px-1 font-mono text-[0.8rem]">
              GoogleSheetsSecretName
            </code>
            ). Redeploy SAM, then share the sheet with the service account email as Editor.
          </p>
        </div>
      ) : null}

      <section className="surface-glass relative isolate overflow-hidden p-4 md:p-6">
        <div className="relative z-10">
        <h2 className="section-title flex items-center gap-2 text-base md:text-lg">
          <i className="fa-solid fa-plus text-bob-gold" aria-hidden />
          Add item
        </h2>
        <p className="mt-2 max-w-2xl text-xs text-bob-muted">
          <strong className="font-medium text-bob-ink">Target</strong> is how many
          units you want for this item in the drive. The public list sorts by how
          far below that goal you still are (using on-hand stock and pending
          requests).
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-bob-ink placeholder:text-bob-muted focus:border-bob-gold focus:outline-none focus:ring-2 focus:ring-bob-gold/25"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-bob-ink placeholder:text-bob-muted focus:border-bob-gold focus:outline-none focus:ring-2 focus:ring-bob-gold/25"
            placeholder="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-bob-ink placeholder:text-bob-muted focus:border-bob-gold focus:outline-none focus:ring-2 focus:ring-bob-gold/25"
            placeholder="Target (goal units)"
            value={targetQtyInput}
            onChange={onUnsignedIntInputChange(setTargetQtyInput)}
          />
          <button
            type="button"
            disabled={!name || createItem.isPending}
            onClick={() => createItem.mutate()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-bob-wood py-2 font-semibold text-white transition-colors hover:bg-bob-ink disabled:opacity-50"
          >
            <i
              className={`fa-solid ${createItem.isPending ? "fa-spinner fa-spin" : "fa-floppy-disk"}`}
              aria-hidden
            />
            Save item
          </button>
        </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title flex items-center gap-2 text-base tracking-tight md:text-lg">
            <i className="fa-solid fa-boxes-stacked text-bob-gold" aria-hidden />
            Inventory
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setImportMsg(null);
                setImportErr(null);
                try {
                  const ab = await f.arrayBuffer();
                  const items = await parseInventoryExcel(ab);
                  if (items.length === 0) {
                    setImportErr(
                      "No rows found. Use a header row with at least a Name column.",
                    );
                    return;
                  }
                  if (items.length > 500) {
                    setImportErr("Maximum 500 rows per import.");
                    return;
                  }
                  await saveInventoryExportTemplate(ab.slice(0));
                  importExcel.mutate(items);
                } catch (err) {
                  setImportErr(
                    err instanceof Error ? err.message : "Could not read file",
                  );
                }
              }}
            />
            <button
              type="button"
              disabled={importExcel.isPending}
              className="surface-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              onClick={() => excelInputRef.current?.click()}
            >
              <i
                className={`fa-solid ${importExcel.isPending ? "fa-spinner fa-spin" : "fa-file-import"} text-xs`}
                aria-hidden
              />
              {importExcel.isPending ? "Importing…" : "Import Excel"}
            </button>
            {liveSheet.data?.url ? (
              <a
                href={liveSheet.data.url}
                target="_blank"
                rel="noopener noreferrer"
                className="surface-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium"
              >
                <i className="fa-solid fa-up-right-from-square text-xs" aria-hidden />
                Open live sheet
              </a>
            ) : null}
            {liveSheet.data && liveSheet.data.syncEnabled !== false ? (
              <button
                type="button"
                disabled={sheetSyncPending || importExcel.isPending || liveSheet.isLoading}
                className="surface-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                title="Push current inventory to the live Google Sheet"
                onClick={() => void manualSyncGoogleSheet()}
              >
                <i
                  className={`fa-solid ${sheetSyncPending ? "fa-spinner fa-spin" : "fa-arrows-rotate"} text-xs`}
                  aria-hidden
                />
                {sheetSyncPending ? "Syncing…" : "Sync sheet"}
              </button>
            ) : null}
            <button
              type="button"
              className="surface-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium"
              onClick={() => void downloadExcel()}
            >
              <i className="fa-solid fa-file-export text-xs" aria-hidden />
              Export Excel
            </button>
            <button
              type="button"
              className="surface-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium"
              onClick={() => void copyInventoryTsv()}
            >
              <i className="fa-solid fa-copy text-xs" aria-hidden />
              Copy table
            </button>
          </div>
        </div>
        {liveSheet.data?.url && liveSheet.data.syncEnabled !== false ? (
          <p className="mb-2 text-xs text-bob-muted">
            The shared Google Sheet is updated automatically on every change: stock,
            targets, new items, Excel import, and request updates (no extra step).
          </p>
        ) : null}
        <p className="mb-2 text-xs text-bob-muted">
          Import Excel replaces the entire catalog: every existing item is removed, then
          rows from your file are added (use Export Excel or your Google Sheet export).
        </p>
        {copyMsg && (
          <p className="mb-2 text-sm text-bob-muted">{copyMsg}</p>
        )}
        {importMsg && (
          <p className="mb-2 text-sm text-bob-muted">{importMsg}</p>
        )}
        {importErr && (
          <p className="mb-2 text-sm text-red-700">{importErr}</p>
        )}
        <div className="space-y-3">
          {items.map((it) => (
            <AdminInventoryCard key={it.id} it={it} onEdit={setEditItem} />
          ))}
        </div>
      </section>

      <InventoryEditModal
        item={editItem}
        onClose={() => setEditItem(null)}
        patchItem={patchItem}
        setStock={setStock}
        removeItem={removeItem}
        pushLiveGoogleSheet={pushLiveGoogleSheet}
      />
    </Layout>
  );
}

function InventoryEditModal({
  item,
  onClose,
  patchItem,
  setStock,
  removeItem,
  pushLiveGoogleSheet,
}: {
  item: InvItem | null;
  onClose: () => void;
  patchItem: (
    id: string,
    p: { name?: string; category?: string; targetQty?: number },
  ) => Promise<void>;
  setStock: (id: string, q: number) => Promise<void>;
  removeItem: (id: string, name: string) => Promise<boolean>;
  pushLiveGoogleSheet: () => Promise<{ rowCount: number } | undefined>;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [targetQtyInput, setTargetQtyInput] = useState("0");
  const [onHandInput, setOnHandInput] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setCategory(item.category ?? "");
    setTargetQtyInput(String(item.targetQty));
    setOnHandInput(String(item.onHand));
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;

  async function handleSave() {
    if (!item) return;
    const it = item;
    const n = name.trim();
    if (!n) return;
    const tRaw = targetQtyInput.trim();
    const qRaw = onHandInput.trim();
    const t = tRaw === "" ? 0 : Math.floor(Number(tRaw));
    const q = qRaw === "" ? 0 : Math.floor(Number(qRaw));
    if (!Number.isFinite(t) || t < 0 || !Number.isFinite(q) || q < 0) return;
    const cat = category.trim();
    const stockChanged = q !== it.onHand;
    const metaChanged =
      n !== it.name ||
      cat !== (it.category ?? "").trim() ||
      t !== it.targetQty;
    if (!stockChanged && !metaChanged) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      if (stockChanged) await setStock(it.id, q);
      if (metaChanged) {
        const patch: { name?: string; category?: string; targetQty?: number } =
          {};
        if (n !== it.name) patch.name = n;
        if (cat !== (it.category ?? "").trim()) patch.category = cat;
        if (t !== it.targetQty) patch.targetQty = t;
        if (Object.keys(patch).length > 0) {
          await patchItem(it.id, patch);
        }
      }
      await pushLiveGoogleSheet();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-edit-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-bob-ink/40 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-bob-mist bg-bob-cream p-5 shadow-2xl shadow-bob-wood/20">
        <div className="mb-4 flex items-start justify-between gap-2">
          <h2
            id="inventory-edit-title"
            className="text-lg font-semibold text-bob-ink"
          >
            Edit item
          </h2>
          <button
            type="button"
            className="rounded-full p-2 text-bob-muted hover:bg-bob-mist/80 hover:text-bob-ink"
            aria-label="Close"
            onClick={onClose}
          >
            <i className="fa-solid fa-xmark text-lg" aria-hidden />
          </button>
        </div>

        <div className="grid gap-3">
          <label className="block text-sm">
            <span className="text-bob-muted">Name</span>
            <input
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-bob-ink focus:border-bob-gold focus:outline-none focus:ring-2 focus:ring-bob-gold/25"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="block text-sm">
            <span className="text-bob-muted">Category</span>
            <input
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-bob-ink focus:border-bob-gold focus:outline-none focus:ring-2 focus:ring-bob-gold/25"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-bob-muted">Target</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-bob-ink focus:border-bob-gold focus:outline-none focus:ring-2 focus:ring-bob-gold/25"
                value={targetQtyInput}
                onChange={onUnsignedIntInputChange(setTargetQtyInput)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-bob-muted">On hand</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-bob-ink focus:border-bob-gold focus:outline-none focus:ring-2 focus:ring-bob-gold/25"
                value={onHandInput}
                onChange={onUnsignedIntInputChange(setOnHandInput)}
              />
            </label>
          </div>
          <p className="text-xs text-bob-muted">
            Projected (from requests):{" "}
            <span className="font-medium text-bob-magenta">{item.projected}</span>{" "}
            — read-only here
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            className="order-3 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50 sm:order-1 sm:mr-auto"
            disabled={saving}
            onClick={() =>
              void removeItem(item.id, item.name).then((did) => {
                if (did) onClose();
              })
            }
          >
            Remove from catalog…
          </button>
          <button
            type="button"
            className="order-2 rounded-full border border-bob-mist px-4 py-2 text-sm font-medium text-bob-ink hover:bg-white"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !name.trim()}
            className="order-1 inline-flex items-center justify-center gap-2 rounded-full bg-bob-wood px-5 py-2 text-sm font-semibold text-white hover:bg-bob-ink disabled:opacity-50 sm:order-3"
            onClick={() => void handleSave()}
          >
            {saving ? (
              <i className="fa-solid fa-spinner fa-spin" aria-hidden />
            ) : (
              <i className="fa-solid fa-check" aria-hidden />
            )}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminInventoryCard({
  it,
  onEdit,
}: {
  it: InvItem;
  onEdit: (item: InvItem) => void;
}) {
  const accent = categoryAccent(it.category || "General");
  const level = stockLevelFromOnHand(it.onHand);
  const status = stockStatusClasses(level);
  const emoji = itemEmoji(it.name, it.category);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`${it.name}, open editor`}
      onClick={() => onEdit(it)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(it);
        }
      }}
      className={inventoryGlassCardClass(accent)}
    >
      <button
        type="button"
        className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-bob-gold/80 transition-colors hover:bg-white/80 hover:text-bob-gold"
        aria-label={`Edit ${it.name}`}
        title="Edit"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(it);
        }}
      >
        <i className="fa-solid fa-pen-to-square text-lg" aria-hidden />
      </button>
      <div className="relative z-10 flex flex-wrap items-start gap-3 pr-10">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-bob-mist bg-white/80 text-2xl shadow-sm"
          aria-hidden
        >
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-bob-ink">{it.name}</h2>
            {(it.category || "").trim() ? (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${accent.pillGlass}`}
              >
                {it.category}
              </span>
            ) : null}
          </div>
          {it.price != null && Number.isFinite(it.price) ? (
            <p className="mt-0.5 text-xs text-bob-muted">
              <i className="fa-solid fa-tag mr-1 opacity-70" aria-hidden />
              ${it.price}
            </p>
          ) : null}
          <p className={`mt-1 text-sm ${status.textClassOnCard}`}>{status.label}</p>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-bob-muted">
                <span className="inline-flex items-center gap-1">
                  <i
                    className="fa-solid fa-bullseye text-[0.7rem] opacity-70"
                    aria-hidden
                  />
                  Target
                </span>
              </dt>
              <dd className="font-medium text-bob-ink">{it.targetQty}</dd>
            </div>
            <div>
              <dt className="text-bob-muted">
                <span className="inline-flex items-center gap-1">
                  <i
                    className="fa-solid fa-warehouse text-[0.7rem] opacity-70"
                    aria-hidden
                  />
                  On hand
                </span>
              </dt>
              <dd
                className={`font-medium ${
                  level === "out"
                    ? "text-red-700"
                    : level === "low"
                      ? "text-amber-700"
                      : "text-emerald-800"
                }`}
              >
                {it.onHand}
              </dd>
            </div>
            <div>
              <dt className="text-bob-muted">
                <span className="inline-flex items-center gap-1">
                  <i
                    className="fa-solid fa-chart-line text-[0.7rem] opacity-70"
                    aria-hidden
                  />
                  Projected
                </span>
              </dt>
              <dd className="font-medium text-bob-magenta">{it.projected}</dd>
            </div>
          </dl>
        </div>
      </div>
    </article>
  );
}
