import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "../components/Layout";
import { apiJson, apiFetch } from "../lib/api";
import { useState } from "react";
import { Link } from "react-router-dom";

type InvItem = {
  id: string;
  name: string;
  category: string;
  targetQty: number;
  onHand: number;
  projected: number;
};

export function AdminDashboard() {
  const qc = useQueryClient();
  const inv = useQuery({
    queryKey: ["inventory"],
    queryFn: () => apiJson<{ items: InvItem[] }>("/inventory"),
  });

  const [name, setName] = useState("");
  const [targetQty, setTargetQty] = useState(0);
  const [category, setCategory] = useState("");

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

  const setStock = async (itemId: string, quantity: number) => {
    await apiFetch(`/items/${itemId}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    qc.invalidateQueries({ queryKey: ["inventory"] });
  };

  const items = inv.data?.items ?? [];

  return (
    <Layout isAdmin>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Admin — catalog & stock</h1>
        <Link
          to="/admin/requests"
          className="rounded-full bg-bob-pink px-4 py-2 text-center text-sm font-semibold text-white"
        >
          Open request inbox
        </Link>
      </div>

      <section className="rounded-2xl border border-pink-100 bg-white/95 p-4 shadow-sm md:p-6">
        <h2 className="font-semibold text-bob-blue">Add item</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-xl border px-3 py-2"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="rounded-xl border px-3 py-2"
            placeholder="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <input
            type="number"
            className="rounded-xl border px-3 py-2"
            placeholder="Target qty"
            value={targetQty}
            onChange={(e) => setTargetQty(Number(e.target.value))}
          />
          <button
            type="button"
            disabled={!name || createItem.isPending}
            onClick={() => createItem.mutate()}
            className="rounded-full bg-bob-mint py-2 font-semibold disabled:opacity-50"
          >
            Save item
          </button>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Inventory</h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="text-sm text-bob-pink underline"
              onClick={() =>
                apiJson("/admin/seed", { method: "POST" }).then(() =>
                  qc.invalidateQueries({ queryKey: ["inventory"] }),
                )
              }
            >
              Seed sample items
            </button>
            <button
              type="button"
              className="text-sm text-bob-blue underline"
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
        <div className="space-y-3">
          {items.map((it) => (
            <div
              key={it.id}
              className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-white/90 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{it.name}</p>
                <p className="text-xs text-gray-500">
                  target {it.targetQty} · on hand {it.onHand} · projected{" "}
                  {it.projected}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                Set on-hand
                <input
                  type="number"
                  min={0}
                  defaultValue={it.onHand}
                  className="w-24 rounded border px-2 py-1"
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
    <section className="mt-10 rounded-2xl border border-teal-100 bg-white/95 p-4">
      <h2 className="font-semibold text-teal-800">Post-event: consume stock</h2>
      <p className="text-sm text-gray-600">
        Decrease on-hand after packing bags (per item).
      </p>
      <div className="mt-3 space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <select
              className="flex-1 rounded-lg border px-2 py-2"
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
              className="w-24 rounded border px-2 py-2"
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
          className="mt-2 block w-full rounded-full bg-teal-600 py-2 font-semibold text-white disabled:opacity-50 sm:w-auto sm:px-6"
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
