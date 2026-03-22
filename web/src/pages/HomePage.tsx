import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "../components/Layout";
import { apiJson, apiFetch } from "../lib/api";
import { useMemo, useState } from "react";
import { getIdToken } from "../lib/tokens";
import { isAdminFromToken } from "../lib/sessionJwt";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL ?? "";

type InvItem = {
  id: string;
  name: string;
  category: string;
  targetQty: number;
  onHand: number;
  projected: number;
  priorityScore: number;
};

type RequestRow = {
  id: string;
  userName: string;
  status: string;
  lines: { itemId: string; qty: number }[];
  createdAt: string;
};

export function HomePage() {
  const qc = useQueryClient();
  const admin = useMemo(() => {
    const t = getIdToken();
    if (!t) return false;
    return isAdminFromToken(t, ADMIN_EMAIL || undefined);
  }, []);

  const inv = useQuery({
    queryKey: ["inventory"],
    queryFn: () => apiJson<{ items: InvItem[] }>("/inventory"),
  });

  const mine = useQuery({
    queryKey: ["my-requests"],
    queryFn: () => apiJson<{ requests: RequestRow[] }>("/my-requests"),
  });

  const [lines, setLines] = useState<{ itemId: string; qty: number }[]>([
    { itemId: "", qty: 1 },
  ]);

  const createReq = useMutation({
    mutationFn: () =>
      apiJson("/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: lines.filter((l) => l.itemId && l.qty > 0),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      setLines([{ itemId: "", qty: 1 }]);
    },
  });

  const items = inv.data?.items ?? [];

  return (
    <Layout isAdmin={admin}>
      <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
        What we need
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Higher on the list = more urgent. Pending commitments count toward
        projected totals until Savannah rejects them.
      </p>

      <section className="mt-6 space-y-3">
        {inv.isLoading && <p className="text-gray-500">Loading…</p>}
        {inv.error && (
          <p className="text-red-600">{(inv.error as Error).message}</p>
        )}
        {items.map((it) => (
          <article
            key={it.id}
            className="rounded-2xl border border-pink-100 bg-white/95 p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold text-gray-900">{it.name}</h2>
              {it.category && (
                <span className="text-xs text-bob-blue">{it.category}</span>
              )}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              <div>
                <dt className="text-gray-500">Target</dt>
                <dd className="font-medium">{it.targetQty}</dd>
              </div>
              <div>
                <dt className="text-gray-500">On hand</dt>
                <dd className="font-medium">{it.onHand}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Projected</dt>
                <dd className="font-medium text-bob-pink">{it.projected}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Gap</dt>
                <dd className="font-medium">
                  {Math.max(0, it.targetQty - it.onHand - it.projected)}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </section>

      <section className="mt-10 rounded-2xl border border-teal-100 bg-white/95 p-4 shadow-sm md:p-6">
        <h2 className="text-lg font-semibold text-bob-blue">
          My commitment (new request)
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Add one or more items and quantities you plan to bring.
        </p>
        <div className="mt-4 space-y-3">
          {lines.map((row, idx) => (
            <div
              key={idx}
              className="flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <select
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-base"
                value={row.itemId}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...next[idx], itemId: e.target.value };
                  setLines(next);
                }}
              >
                <option value="">Select item…</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 sm:w-24"
                value={row.qty}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = {
                    ...next[idx],
                    qty: Math.max(1, Number(e.target.value) || 1),
                  };
                  setLines(next);
                }}
              />
              {lines.length > 1 && (
                <button
                  type="button"
                  className="text-sm text-red-600"
                  onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="text-sm font-medium text-bob-pink"
            onClick={() => setLines([...lines, { itemId: "", qty: 1 }])}
          >
            + Add another line
          </button>
        </div>
        <button
          type="button"
          disabled={
            createReq.isPending ||
            lines.every((l) => !l.itemId || l.qty < 1)
          }
          onClick={() => createReq.mutate()}
          className="mt-4 w-full rounded-full bg-bob-mint py-3 font-semibold text-gray-900 hover:bg-teal-200 disabled:opacity-50 md:w-auto md:px-10"
        >
          Submit request
        </button>
        {createReq.isError && (
          <p className="mt-2 text-sm text-red-600">
            {(createReq.error as Error).message}
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">My requests</h2>
        <ul className="mt-3 space-y-3">
          {(mine.data?.requests ?? []).map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-gray-100 bg-white/90 p-4"
            >
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-medium">{r.status}</span>
                <span className="text-gray-500">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
              <ul className="mt-2 text-sm text-gray-700">
                {r.lines.map((l, i) => (
                  <li key={i}>
                    {l.itemId.slice(0, 8)}… × {l.qty}
                  </li>
                ))}
              </ul>
              {r.status === "pending" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-full bg-gray-100 px-3 py-1 text-xs"
                    onClick={async () => {
                      const qty = Number(
                        prompt("New total qty for first line?", String(r.lines[0]?.qty ?? 1)),
                      );
                      if (!Number.isFinite(qty)) return;
                      await apiFetch(`/requests/${r.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          lines: r.lines.map((l, j) =>
                            j === 0 ? { ...l, qty } : l,
                          ),
                        }),
                      });
                      qc.invalidateQueries({ queryKey: ["my-requests"] });
                      qc.invalidateQueries({ queryKey: ["inventory"] });
                    }}
                  >
                    Quick edit qty
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-red-50 px-3 py-1 text-xs text-red-700"
                    onClick={async () => {
                      if (!confirm("Delete this request?")) return;
                      await apiFetch(`/requests/${r.id}`, { method: "DELETE" });
                      qc.invalidateQueries({ queryKey: ["my-requests"] });
                      qc.invalidateQueries({ queryKey: ["inventory"] });
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </Layout>
  );
}
