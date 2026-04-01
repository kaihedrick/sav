import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "../components/Layout";
import { apiJson, apiFetch } from "../lib/api";
import { useMemo, useState } from "react";
import { getIdToken } from "../lib/tokens";
import { isAdminFromToken } from "../lib/sessionJwt";
import {
  categoryAccent,
  itemEmoji,
  stockLevelFromOnHand,
  stockStatusClasses,
} from "../lib/inventoryCardStyle";

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

type AdminRequestRow = RequestRow & { userId: string };

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

  const liveSheet = useQuery({
    queryKey: ["inventory-sheet"],
    queryFn: () => apiJson<{ url: string | null }>("/inventory/sheet"),
  });

  const mine = useQuery({
    queryKey: ["my-requests"],
    queryFn: () => apiJson<{ requests: RequestRow[] }>("/my-requests"),
  });

  const community = useQuery({
    queryKey: ["community-requests"],
    queryFn: () => apiJson<{ requests: RequestRow[] }>("/community-requests"),
    enabled: !admin,
  });

  const allForAdmin = useQuery({
    queryKey: ["admin-requests"],
    queryFn: () => apiJson<{ requests: AdminRequestRow[] }>("/admin/requests"),
    enabled: admin,
  });

  const patchStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "pending" | "rejected" | "received" | "not_brought";
    }) => {
      const res = await apiFetch(`/admin/requests/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-requests"] });
      qc.invalidateQueries({ queryKey: ["community-requests"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["my-requests"] });
    },
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
      qc.invalidateQueries({ queryKey: ["community-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-requests"] });
      setLines([{ itemId: "", qty: 1 }]);
    },
  });

  const items = inv.data?.items ?? [];

  function formatLine(l: { itemId: string; qty: number }) {
    const name = items.find((i) => i.id === l.itemId)?.name;
    return `${name ?? `${l.itemId.slice(0, 8)}…`} × ${l.qty}`;
  }

  const othersList: RequestRow[] = admin
    ? (allForAdmin.data?.requests ?? [])
    : (community.data?.requests ?? []);

  return (
    <Layout isAdmin={admin}>
      <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-md md:text-3xl">
        What we need
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-pink-100/90">
        Items are ordered by urgency. Pending commitments count toward projected
        totals until Savannah rejects them. Cards are tinted by category; stock
        status uses on-hand quantity only.
      </p>
      {liveSheet.data?.url ? (
        <p className="mt-2">
          <a
            href={liveSheet.data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-white underline decoration-pink-300 underline-offset-2 hover:text-pink-100"
          >
            Open the shared inventory (Google Sheet)
          </a>
        </p>
      ) : null}

      <section className="mt-6 space-y-3">
        {inv.isLoading && (
          <p className="text-sm text-pink-200/90">Loading…</p>
        )}
        {inv.error && (
          <p className="rounded-xl border border-pink-200 bg-pink-50/90 px-3 py-2 text-sm text-bob-rose">
            {(inv.error as Error).message}
          </p>
        )}
        {items.map((it) => {
          const accent = categoryAccent(it.category || "General");
          const level = stockLevelFromOnHand(it.onHand);
          const status = stockStatusClasses(level);
          const emoji = itemEmoji(it.name, it.category);
          return (
            <article
              key={it.id}
              className={`rounded-2xl border border-pink-200/50 border-l-4 ${accent.borderL} ${accent.panelBg} p-4 shadow-sm shadow-pink-900/5 ring-1 ${accent.ring}`}
            >
              <div className="flex flex-wrap items-start gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/90 text-2xl shadow-sm"
                  aria-hidden
                >
                  {emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-semibold text-bob-ink">{it.name}</h2>
                    {(it.category || "").trim() ? (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${accent.pill}`}
                      >
                        {it.category}
                      </span>
                    ) : null}
                  </div>
                  <p className={`mt-1 text-sm ${status.textClass}`}>
                    {status.label}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-bob-muted">On hand</dt>
                      <dd
                        className={`font-medium ${level === "out" ? "text-red-600" : level === "low" ? "text-amber-600" : "text-emerald-700"}`}
                      >
                        {it.onHand}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-bob-muted">Projected</dt>
                      <dd className="font-medium text-bob-pink">{it.projected}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="mt-10 rounded-2xl border border-pink-200/80 bg-white/95 p-4 shadow-sm shadow-pink-900/5 md:p-6">
        <h2 className="text-lg font-semibold text-bob-pink">
          My commitment (new request)
        </h2>
        <p className="mt-1 text-sm text-bob-muted">
          Add one or more items and quantities you plan to bring.
        </p>
        <div className="mt-4 space-y-3">
          {lines.map((row, idx) => (
            <div
              key={idx}
              className="flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <select
                className="flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-base text-zinc-950 [color-scheme:light] focus:border-bob-pink focus:outline-none focus:ring-2 focus:ring-pink-200 [&>option]:bg-white [&>option]:text-zinc-900"
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
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-zinc-950 focus:border-bob-pink focus:outline-none focus:ring-2 focus:ring-pink-200 sm:w-24"
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
                  className="text-sm font-medium text-bob-rose underline decoration-pink-300 underline-offset-2"
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
          className="mt-4 w-full rounded-full border-2 border-pink-400/60 bg-bob-pink py-3 font-semibold text-white shadow-lg shadow-pink-900/25 transition-colors hover:bg-pink-600 disabled:opacity-50 md:w-auto md:px-10"
        >
          Submit request
        </button>
        {createReq.isError && (
          <p className="mt-2 text-sm text-bob-rose">
            {(createReq.error as Error).message}
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-white drop-shadow-sm">
          {admin ? "All contributor requests" : "What others are bringing"}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-pink-100/85">
          {admin
            ? "Manage status for any request (same actions as the inbox). Pending rows affect projected inventory."
            : "Volunteers who signed up before you. Names are the first and last name each person saved on first sign-in."}
        </p>
        {!admin && community.isLoading && (
          <p className="mt-3 text-sm text-pink-200/90">Loading…</p>
        )}
        {admin && allForAdmin.isLoading && (
          <p className="mt-3 text-sm text-pink-200/90">Loading…</p>
        )}
        <ul className="mt-3 space-y-3">
          {othersList.length === 0 && !community.isLoading && !allForAdmin.isLoading && (
            <li className="rounded-2xl border border-pink-200/40 bg-black/20 px-4 py-3 text-sm text-pink-100/90 backdrop-blur-sm">
              {admin
                ? "No requests in the system yet."
                : "No one else has posted a commitment yet."}
            </li>
          )}
          {othersList.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-pink-200/70 bg-white/90 p-4 shadow-sm shadow-pink-900/5"
            >
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-semibold text-bob-ink">{r.userName}</span>
                <span className="font-medium text-bob-pink">{r.status}</span>
              </div>
              <p className="mt-0.5 text-xs text-bob-muted">
                {new Date(r.createdAt).toLocaleString()}
              </p>
              <ul className="mt-2 text-sm text-bob-ink">
                {r.lines.map((l, i) => (
                  <li key={i}>{formatLine(l)}</li>
                ))}
              </ul>
              {admin && r.status === "pending" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-pink-300/80 bg-pink-50 px-3 py-1.5 text-xs font-medium text-bob-rose"
                    onClick={() =>
                      patchStatus.mutate({ id: r.id, status: "rejected" })
                    }
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-bob-pink px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-pink-600"
                    onClick={() =>
                      patchStatus.mutate({ id: r.id, status: "received" })
                    }
                  >
                    Mark received
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-bob-ink hover:bg-pink-50"
                    onClick={() =>
                      patchStatus.mutate({ id: r.id, status: "not_brought" })
                    }
                  >
                    Not brought
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-white drop-shadow-sm">
          My requests
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-pink-100/85">
          Edit or delete only your own pending commitments.
        </p>
        <ul className="mt-3 space-y-3">
          {(mine.data?.requests ?? []).map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-pink-200/70 bg-white/90 p-4 shadow-sm shadow-pink-900/5"
            >
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-medium text-bob-pink">{r.status}</span>
                <span className="text-bob-muted">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
              <ul className="mt-2 text-sm text-bob-ink">
                {r.lines.map((l, i) => (
                  <li key={i}>{formatLine(l)}</li>
                ))}
              </ul>
              {r.status === "pending" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-bob-ink hover:bg-pink-50"
                    onClick={async () => {
                      const qty = Number(
                        prompt(
                          "New total qty for first line?",
                          String(r.lines[0]?.qty ?? 1),
                        ),
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
                      qc.invalidateQueries({ queryKey: ["community-requests"] });
                      qc.invalidateQueries({ queryKey: ["admin-requests"] });
                    }}
                  >
                    Quick edit qty
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-pink-300/80 bg-pink-50 px-3 py-1 text-xs font-medium text-bob-rose"
                    onClick={async () => {
                      if (!confirm("Delete this request?")) return;
                      await apiFetch(`/requests/${r.id}`, { method: "DELETE" });
                      qc.invalidateQueries({ queryKey: ["my-requests"] });
                      qc.invalidateQueries({ queryKey: ["inventory"] });
                      qc.invalidateQueries({ queryKey: ["community-requests"] });
                      qc.invalidateQueries({ queryKey: ["admin-requests"] });
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
