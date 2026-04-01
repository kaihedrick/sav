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
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CherryBlossomCardBg } from "../components/CherryBlossomCardBg";
import {
  categoryAccent,
  inventoryGlassCardClass,
  itemEmoji,
  stockLevelFromOnHand,
  stockStatusClasses,
} from "../lib/inventoryCardStyle";

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

export function AdminDashboard() {
  const qc = useQueryClient();
  const inv = useQuery({
    queryKey: ["inventory"],
    queryFn: () => apiJson<{ items: InvItem[] }>("/inventory"),
  });

  const liveSheet = useQuery({
    queryKey: ["inventory-sheet"],
    queryFn: () => apiJson<{ url: string | null }>("/inventory/sheet"),
  });

  const [name, setName] = useState("");
  const [targetQty, setTargetQty] = useState(0);
  const [category, setCategory] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const createItem = useMutation({
    mutationFn: () =>
      apiJson("/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, targetQty }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setName("");
      setCategory("");
      setTargetQty(0);
    },
  });

  const syncGoogleSheet = useMutation({
    mutationFn: () =>
      apiJson<{ ok: boolean; rowCount: number }>(
        "/admin/inventory/sync-google-sheet",
        { method: "POST" },
      ),
    onSuccess: (data) => {
      setImportMsg(`Sheet updated · ${data.rowCount} rows`);
      setImportErr(null);
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Sync failed";
      setImportErr(msg);
      setImportMsg(null);
    },
  });

  const importExcel = useMutation({
    mutationFn: (items: ParsedInventoryRow[]) =>
      apiJson<{ created: number; updated: number; total: number }>(
        "/admin/items/import",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        },
      ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setImportMsg(
        `Import · ${data.created} new, ${data.updated} updated (${data.total} rows)`,
      );
      setImportErr(null);
      if (excelInputRef.current) excelInputRef.current.value = "";
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
    await apiFetch(`/items/${itemId}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    qc.invalidateQueries({ queryKey: ["inventory"] });
  };

  const patchItem = async (itemId: string, patch: { targetQty: number }) => {
    await apiJson(`/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    qc.invalidateQueries({ queryKey: ["inventory"] });
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
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white drop-shadow-md">
          <i className="fa-solid fa-screwdriver-wrench text-pink-200/90" aria-hidden />
          Admin — catalog & stock
        </h1>
        <Link
          to="/admin/requests"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-bob-pink px-4 py-2 text-center text-sm font-semibold text-white shadow-md shadow-pink-900/15 transition-colors hover:bg-pink-600"
        >
          <i className="fa-solid fa-inbox" aria-hidden />
          Open request inbox
        </Link>
      </div>

      <section className="surface-glass relative isolate overflow-hidden p-4 md:p-6">
        <CherryBlossomCardBg density="panel" />
        <div className="relative z-10">
        <h2 className="flex items-center gap-2 font-semibold text-pink-100">
          <i className="fa-solid fa-plus text-pink-300/90" aria-hidden />
          Add item
        </h2>
        <p className="mt-2 max-w-2xl text-xs text-pink-200/85">
          <strong className="font-medium text-pink-50">Target</strong> is how many
          units you want for this item in the drive. The public list sorts by how
          far below that goal you still are (using on-hand stock and pending
          requests).
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-bob-ink placeholder:text-bob-muted focus:border-bob-pink focus:outline-none focus:ring-2 focus:ring-pink-200"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-bob-ink placeholder:text-bob-muted focus:border-bob-pink focus:outline-none focus:ring-2 focus:ring-pink-200"
            placeholder="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <input
            type="number"
            min={0}
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-bob-ink placeholder:text-bob-muted focus:border-bob-pink focus:outline-none focus:ring-2 focus:ring-pink-200"
            placeholder="Target (goal units)"
            value={targetQty}
            onChange={(e) => setTargetQty(Number(e.target.value))}
          />
          <button
            type="button"
            disabled={!name || createItem.isPending}
            onClick={() => createItem.mutate()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-bob-ink py-2 font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
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
          <h2 className="flex items-center gap-2 font-semibold tracking-tight text-white drop-shadow-sm">
            <i className="fa-solid fa-boxes-stacked text-pink-200/90" aria-hidden />
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
              <>
                <a
                  href={liveSheet.data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="surface-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium"
                >
                  <i className="fa-solid fa-up-right-from-square text-xs" aria-hidden />
                  Open live sheet
                </a>
                <button
                  type="button"
                  disabled={syncGoogleSheet.isPending}
                  className="surface-glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                  onClick={() => syncGoogleSheet.mutate()}
                >
                  <i
                    className={`fa-solid ${syncGoogleSheet.isPending ? "fa-spinner fa-spin" : "fa-cloud-arrow-up"} text-xs`}
                    aria-hidden
                  />
                  {syncGoogleSheet.isPending
                    ? "Syncing…"
                    : "Push to Google Sheet"}
                </button>
              </>
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
        {copyMsg && (
          <p className="mb-2 text-sm text-pink-100">{copyMsg}</p>
        )}
        {importMsg && (
          <p className="mb-2 text-sm text-pink-100">{importMsg}</p>
        )}
        {importErr && (
          <p className="mb-2 text-sm text-red-300">{importErr}</p>
        )}
        <div className="space-y-3">
          {items.map((it) => (
            <AdminInventoryCard
              key={it.id}
              it={it}
              onCommitStock={(id, q) => void setStock(id, q)}
              onCommitTarget={(id, t) => void patchItem(id, { targetQty: t })}
            />
          ))}
        </div>
      </section>
    </Layout>
  );
}

function AdminInventoryCard({
  it,
  onCommitStock,
  onCommitTarget,
}: {
  it: InvItem;
  onCommitStock: (id: string, q: number) => void;
  onCommitTarget: (id: string, t: number) => void;
}) {
  const stockInputRef = useRef<HTMLInputElement>(null);
  const accent = categoryAccent(it.category || "General");
  const level = stockLevelFromOnHand(it.onHand);
  const status = stockStatusClasses(level);
  const emoji = itemEmoji(it.name, it.category);

  const focusStock = () => stockInputRef.current?.focus();

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`${it.name}, edit target or on-hand quantity`}
      onClick={focusStock}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          focusStock();
        }
      }}
      className={inventoryGlassCardClass(accent)}
    >
      <CherryBlossomCardBg />
      <span
        className="pointer-events-none absolute right-3 top-3 z-10 text-pink-300/50"
        aria-hidden
      >
        <i className="fa-solid fa-pen-to-square text-lg" />
      </span>
      <div className="relative z-10 flex flex-wrap items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-2xl shadow-sm"
          aria-hidden
        >
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-pink-50">{it.name}</h2>
            {(it.category || "").trim() ? (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${accent.pillGlass}`}
              >
                {it.category}
              </span>
            ) : null}
          </div>
          {it.price != null && Number.isFinite(it.price) ? (
            <p className="mt-0.5 text-xs text-pink-200/75">
              <i className="fa-solid fa-tag mr-1 opacity-70" aria-hidden />
              ${it.price}
            </p>
          ) : null}
          <p className={`mt-1 text-sm ${status.textClassDark}`}>{status.label}</p>
          <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-pink-200/65">
                <span className="inline-flex items-center gap-1">
                  <i
                    className="fa-solid fa-bullseye text-[0.7rem] opacity-70"
                    aria-hidden
                  />
                  Target
                </span>
              </dt>
              <dd className="mt-0.5">
                <input
                  type="number"
                  min={0}
                  step={1}
                  key={`${it.id}-tgt-${it.targetQty}`}
                  defaultValue={it.targetQty}
                  className="w-full min-w-0 max-w-[7rem] rounded-lg border border-white/20 bg-black/25 px-2 py-1 font-medium text-pink-50 shadow-sm backdrop-blur-sm focus:border-bob-pink focus:outline-none focus:ring-2 focus:ring-pink-400/40"
                  aria-label={`Target goal for ${it.name}`}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    if (raw === "") {
                      e.target.value = String(it.targetQty);
                      return;
                    }
                    const t = Math.floor(Number(raw));
                    if (!Number.isFinite(t) || t < 0) {
                      e.target.value = String(it.targetQty);
                      return;
                    }
                    if (t !== it.targetQty) onCommitTarget(it.id, t);
                  }}
                />
              </dd>
            </div>
            <div>
              <dt className="text-pink-200/65">
                <span className="inline-flex items-center gap-1">
                  <i
                    className="fa-solid fa-warehouse text-[0.7rem] opacity-70"
                    aria-hidden
                  />
                  On hand
                </span>
              </dt>
              <dd className="mt-0.5">
                <input
                  ref={stockInputRef}
                  type="number"
                  min={0}
                  step={1}
                  key={`${it.id}-${it.onHand}`}
                  defaultValue={it.onHand}
                  className={`w-full min-w-0 max-w-[7rem] rounded-lg border border-white/20 bg-black/25 px-2 py-1 font-medium shadow-sm backdrop-blur-sm focus:border-bob-pink focus:outline-none focus:ring-2 focus:ring-pink-400/40 ${
                    level === "out"
                      ? "text-red-400"
                      : level === "low"
                        ? "text-amber-300"
                        : "text-emerald-300"
                  }`}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    if (raw === "") {
                      e.target.value = String(it.onHand);
                      return;
                    }
                    const q = Math.floor(Number(raw));
                    if (!Number.isFinite(q) || q < 0) {
                      e.target.value = String(it.onHand);
                      return;
                    }
                    if (q !== it.onHand) onCommitStock(it.id, q);
                  }}
                />
              </dd>
            </div>
            <div>
              <dt className="text-pink-200/65">
                <span className="inline-flex items-center gap-1">
                  <i
                    className="fa-solid fa-chart-line text-[0.7rem] opacity-70"
                    aria-hidden
                  />
                  Projected
                </span>
              </dt>
              <dd className="mt-0.5 font-medium text-pink-300">{it.projected}</dd>
            </div>
          </dl>
        </div>
      </div>
    </article>
  );
}
