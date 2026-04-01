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
      setImportMsg(
        `Live Google Sheet updated (${data.rowCount} rows). Contributors can refresh the shared link to see changes.`,
      );
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
        `Import done: ${data.created} created, ${data.updated} updated (${data.total} rows). Projected column in the file is ignored — it always comes from live requests.`,
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
        <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-md">
          Admin — catalog & stock
        </h1>
        <Link
          to="/admin/requests"
          className="rounded-full bg-bob-pink px-4 py-2 text-center text-sm font-semibold text-white shadow-md shadow-pink-900/15 transition-colors hover:bg-pink-600"
        >
          Open request inbox
        </Link>
      </div>

      <section className="rounded-2xl border border-pink-200/80 bg-white/95 p-4 shadow-sm shadow-pink-900/5 md:p-6">
        <h2 className="font-semibold text-bob-pink">Add item</h2>
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
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-bob-ink placeholder:text-bob-muted focus:border-bob-pink focus:outline-none focus:ring-2 focus:ring-pink-200"
            placeholder="Target qty"
            value={targetQty}
            onChange={(e) => setTargetQty(Number(e.target.value))}
          />
          <button
            type="button"
            disabled={!name || createItem.isPending}
            onClick={() => createItem.mutate()}
            className="rounded-full bg-bob-ink py-2 font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
          >
            Save item
          </button>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold tracking-tight text-white drop-shadow-sm">
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
              className="rounded-full border border-pink-300/80 bg-white px-3 py-1.5 text-sm font-medium text-bob-ink hover:bg-pink-50 disabled:opacity-50"
              onClick={() => excelInputRef.current?.click()}
            >
              {importExcel.isPending ? "Importing…" : "Import Excel"}
            </button>
            <button
              type="button"
              className="text-sm font-medium text-bob-pink underline decoration-pink-300 underline-offset-2"
              onClick={() =>
                apiJson("/admin/seed", { method: "POST" }).then(() =>
                  qc.invalidateQueries({ queryKey: ["inventory"] }),
                )
              }
            >
              Seed sample items
            </button>
            {liveSheet.data?.url ? (
              <>
                <a
                  href={liveSheet.data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-pink-300/80 bg-white px-3 py-1.5 text-sm font-medium text-bob-ink hover:bg-pink-50"
                >
                  Open live sheet
                </a>
                <button
                  type="button"
                  disabled={syncGoogleSheet.isPending}
                  className="rounded-full border border-pink-300/80 bg-white px-3 py-1.5 text-sm font-medium text-bob-ink hover:bg-pink-50 disabled:opacity-50"
                  onClick={() => syncGoogleSheet.mutate()}
                >
                  {syncGoogleSheet.isPending
                    ? "Syncing…"
                    : "Push to Google Sheet"}
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="rounded-full border border-pink-300/80 bg-white px-3 py-1.5 text-sm font-medium text-bob-ink hover:bg-pink-50"
              onClick={() => void downloadExcel()}
            >
              Export Excel
            </button>
            <button
              type="button"
              className="rounded-full border border-pink-300/80 bg-white px-3 py-1.5 text-sm font-medium text-bob-ink hover:bg-pink-50"
              onClick={() => void copyInventoryTsv()}
            >
              Copy table
            </button>
            <button
              type="button"
              className="text-sm font-medium text-bob-pink underline decoration-pink-300 underline-offset-2"
              onClick={async () => {
              const res = await apiFetch("/export.csv");
              const blob = await res.blob();
              const u = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = u;
              a.download = "inventory.csv";
              a.click();
              URL.revokeObjectURL(u);
            }}
            >
              Download CSV
            </button>
          </div>
        </div>
        <p className="mb-2 max-w-xl text-xs text-pink-100/85">
          Workbook <strong>Inventory Tracker</strong>:{" "}
          <strong>Item name</strong>, <strong>Type</strong>, <strong>Price</strong>,{" "}
          <strong>Stock</strong> (on-hand), <strong>Status</strong> (ignored on import),{" "}
          <strong>Notes</strong>. Plus <strong>Item ID</strong> (for updates),{" "}
          <strong>Target</strong> (catalog goal),           <strong>Projected</strong> (export only —
          ignored on import). Up to 500 rows per import.{" "}
          <strong>Export Excel</strong> reuses the styling of your last successful import
          (stored in this browser); otherwise it downloads a matching pink-themed sheet.
          When the API is configured with a Google Sheet, <strong>Open live sheet</strong> and{" "}
          <strong>Push to Google Sheet</strong> keep everyone on one shared document (row 1 =
          headers; data columns A–I: Item ID, Item name, Type, Price, Stock, Status, Notes,
          Target, Projected).
        </p>
        {copyMsg && (
          <p className="mb-2 text-sm text-pink-100">{copyMsg}</p>
        )}
        {importMsg && (
          <p className="mb-2 text-sm text-pink-100">{importMsg}</p>
        )}
        {importErr && (
          <p className="mb-2 text-sm text-bob-rose">{importErr}</p>
        )}
        <div className="space-y-3">
          {items.map((it) => (
            <div
              key={it.id}
              className="flex flex-col gap-2 rounded-xl border border-pink-200/70 bg-white/90 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-bob-ink">{it.name}</p>
                <p className="text-xs text-bob-muted">
                  target {it.targetQty}
                  {it.price != null && Number.isFinite(it.price)
                    ? ` · price ${it.price}`
                    : ""}{" "}
                  · on hand {it.onHand} · projected{" "}
                  <span className="text-bob-pink">{it.projected}</span>
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-bob-ink">
                Set on-hand
                <input
                  type="number"
                  min={0}
                  defaultValue={it.onHand}
                  className="w-24 rounded-lg border border-neutral-200 px-2 py-1 text-bob-ink focus:border-bob-pink focus:outline-none focus:ring-2 focus:ring-pink-200"
                  onBlur={(e) => {
                    const q = Number(e.target.value);
                    if (Number.isFinite(q) && q >= 0) setStock(it.id, q);
                  }}
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      <ConsumeStockSection items={items} />
    </Layout>
  );
}

function ConsumeStockSection({ items }: { items: InvItem[] }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<{ itemId: string; quantity: number }[]>([
    { itemId: "", quantity: 1 },
  ]);

  return (
    <section className="mt-10 rounded-2xl border border-pink-200/80 bg-white/95 p-4 shadow-sm shadow-pink-900/5">
      <h2 className="font-semibold text-bob-pink">Post-event: consume stock</h2>
      <p className="text-sm text-bob-muted">
        Decrease on-hand after packing bags (per item).
      </p>
      <div className="mt-3 space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <select
              className="flex-1 rounded-lg border border-neutral-200 bg-white px-2 py-2 text-bob-ink focus:border-bob-pink focus:outline-none focus:ring-2 focus:ring-pink-200"
              value={r.itemId}
              onChange={(e) => {
                const n = [...rows];
                n[i] = { ...n[i], itemId: e.target.value };
                setRows(n);
              }}
            >
              <option value="">Item…</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              className="w-24 rounded-lg border border-neutral-200 px-2 py-2 text-bob-ink focus:border-bob-pink focus:outline-none focus:ring-2 focus:ring-pink-200"
              value={r.quantity}
              onChange={(e) => {
                const n = [...rows];
                n[i] = { ...n[i], quantity: Number(e.target.value) || 1 };
                setRows(n);
              }}
            />
          </div>
        ))}
        <button
          type="button"
          className="text-sm text-bob-pink"
          onClick={() => setRows([...rows, { itemId: "", quantity: 1 }])}
        >
          + Row
        </button>
        <button
          type="button"
          className="mt-2 block w-full rounded-full bg-bob-ink py-2 font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-50 sm:w-auto sm:px-6"
          disabled={rows.some((x) => !x.itemId)}
          onClick={async () => {
            await apiJson("/admin/stock/consume", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                items: rows.filter((x) => x.itemId),
              }),
            });
            setRows([{ itemId: "", quantity: 1 }]);
            qc.invalidateQueries({ queryKey: ["inventory"] });
          }}
        >
          Apply consumption
        </button>
      </div>
    </section>
  );
}
