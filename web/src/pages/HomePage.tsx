import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "../components/Layout";
import { apiJson, apiFetch } from "../lib/api";
import { useEffect, useMemo, useState } from "react";
import { getIdToken } from "../lib/tokens";
import { isAdminFromToken } from "../lib/sessionJwt";
import {
  categoryAccent,
  inventoryGlassCardClass,
  itemEmoji,
  stockLevelFromOnHand,
  stockStatusClasses,
} from "../lib/inventoryCardStyle";
import { IconButton } from "../components/IconButton";

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

  const [quickOrderItem, setQuickOrderItem] = useState<InvItem | null>(null);
  const [quickQty, setQuickQty] = useState(1);

  useEffect(() => {
    if (quickOrderItem) setQuickQty(1);
  }, [quickOrderItem]);

  useEffect(() => {
    if (!quickOrderItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setQuickOrderItem(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quickOrderItem]);

  const quickCommit = useMutation({
    mutationFn: (payload: { itemId: string; qty: number }) =>
      apiJson("/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: [{ itemId: payload.itemId, qty: payload.qty }],
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      qc.invalidateQueries({ queryKey: ["community-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-requests"] });
      setQuickOrderItem(null);
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
      <section className="mt-6 space-y-3">
        {inv.isLoading && (
          <p className="text-pink-200/90" aria-live="polite">
            <i className="fa-solid fa-spinner fa-spin" aria-hidden />{" "}
            <span className="sr-only">Loading</span>
          </p>
        )}
        {inv.error && (
          <p className="rounded-xl border border-rose-400/40 bg-rose-950/50 px-3 py-2 text-sm text-red-200 backdrop-blur-sm">
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
              role="button"
              tabIndex={0}
              onClick={() => setQuickOrderItem(it)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setQuickOrderItem(it);
                }
              }}
              className={inventoryGlassCardClass(accent)}
            >
              <span
                className="pointer-events-none absolute right-3 top-3 text-pink-300/50"
                aria-hidden
              >
                <i className="fa-solid fa-circle-plus text-lg" />
              </span>
              <div className="flex flex-wrap items-start gap-3">
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
                  <p className={`mt-1 text-sm ${status.textClassDark}`}>
                    {status.label}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-pink-200/65">On hand</dt>
                      <dd
                        className={`font-medium ${level === "out" ? "text-red-400" : level === "low" ? "text-amber-300" : "text-emerald-300"}`}
                      >
                        {it.onHand}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-pink-200/65">Projected</dt>
                      <dd className="font-medium text-pink-300">{it.projected}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {quickOrderItem && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="presentation"
          onClick={() => setQuickOrderItem(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-order-title"
            className="surface-glass-modal w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="quick-order-title"
              className="flex items-center gap-2 text-lg font-semibold text-pink-50"
            >
              <i className="fa-solid fa-hand-holding-heart text-bob-pink" aria-hidden />
              {quickOrderItem.name}
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-pink-100">
                <i className="fa-solid fa-hashtag text-pink-300/70" title="Qty" aria-hidden />
                <span className="sr-only">Quantity</span>
                <input
                  type="number"
                  min={1}
                  autoFocus
                  className="w-24 rounded-xl border border-neutral-200 px-3 py-2.5 text-base text-zinc-950 focus:border-bob-pink focus:outline-none focus:ring-2 focus:ring-pink-200"
                  value={quickQty}
                  onChange={(e) =>
                    setQuickQty(Math.max(1, Number(e.target.value) || 1))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      quickCommit.mutate({
                        itemId: quickOrderItem.id,
                        qty: quickQty,
                      });
                    }
                  }}
                />
              </label>
              <IconButton
                icon="fa-check"
                label={quickCommit.isPending ? "Sending" : "Submit"}
                disabled={quickCommit.isPending || quickQty < 1}
                onClick={() =>
                  quickCommit.mutate({
                    itemId: quickOrderItem.id,
                    qty: quickQty,
                  })
                }
                className="h-11 w-11 rounded-full bg-bob-pink text-white shadow-md transition-colors hover:bg-pink-600 disabled:opacity-50"
              />
              <IconButton
                icon="fa-xmark"
                label="Close"
                onClick={() => setQuickOrderItem(null)}
                className="h-11 w-11 rounded-full border border-pink-400/35 bg-zinc-900/60 text-pink-200/90 backdrop-blur-sm hover:bg-zinc-800/70"
              />
            </div>
            {quickCommit.isError && (
              <p className="mt-3 text-sm text-red-300">
                {(quickCommit.error as Error).message}
              </p>
            )}
          </div>
        </div>
      )}

      <section className="surface-glass mt-10 p-4 md:p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-pink-100">
          <i className="fa-solid fa-pen-to-square" aria-hidden />
          New request
        </h2>
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
                <IconButton
                  icon="fa-trash"
                  label="Remove line"
                  className="h-10 w-10 rounded-lg border border-rose-400/35 bg-rose-950/35 text-rose-200 backdrop-blur-sm hover:bg-rose-900/45"
                  onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                />
              )}
            </div>
          ))}
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium text-pink-300 hover:text-pink-200"
            onClick={() => setLines([...lines, { itemId: "", qty: 1 }])}
          >
            <i className="fa-solid fa-plus" aria-hidden />
            Line
          </button>
        </div>
        <div className="mt-4">
          <IconButton
            icon="fa-paper-plane"
            label={createReq.isPending ? "Sending" : "Submit request"}
            disabled={
              createReq.isPending ||
              lines.every((l) => !l.itemId || l.qty < 1)
            }
            onClick={() => createReq.mutate()}
            className="h-12 w-12 rounded-full border-2 border-pink-400/60 bg-bob-pink text-lg text-white shadow-lg shadow-pink-900/25 transition-colors hover:bg-pink-600 disabled:opacity-50"
          />
        </div>
        {createReq.isError && (
          <p className="mt-2 text-sm text-red-300">
            {(createReq.error as Error).message}
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white drop-shadow-sm">
          <i
            className={`fa-solid ${admin ? "fa-clipboard-list" : "fa-users"}`}
            aria-hidden
          />
          {admin ? "All requests" : "Community"}
        </h2>
        {!admin && community.isLoading && (
          <p className="mt-3 text-pink-200/90" aria-live="polite">
            <i className="fa-solid fa-spinner fa-spin" aria-hidden />
            <span className="sr-only">Loading</span>
          </p>
        )}
        {admin && allForAdmin.isLoading && (
          <p className="mt-3 text-pink-200/90" aria-live="polite">
            <i className="fa-solid fa-spinner fa-spin" aria-hidden />
            <span className="sr-only">Loading</span>
          </p>
        )}
        <ul className="mt-3 space-y-3">
          {othersList.length === 0 && !community.isLoading && !allForAdmin.isLoading && (
            <li className="surface-glass flex items-center gap-2 px-4 py-3 text-sm text-pink-100/90">
              <i className="fa-solid fa-inbox" aria-hidden />
              Empty
            </li>
          )}
          {othersList.map((r) => (
            <li
              key={r.id}
              className="surface-glass p-4"
            >
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-semibold text-pink-50">{r.userName}</span>
                <span className="font-medium text-bob-pink">{r.status}</span>
              </div>
              <p className="mt-0.5 text-xs text-pink-200/70">
                {new Date(r.createdAt).toLocaleString()}
              </p>
              <ul className="mt-2 text-sm text-pink-100/95">
                {r.lines.map((l, i) => (
                  <li key={i}>{formatLine(l)}</li>
                ))}
              </ul>
              {admin && r.status === "pending" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <IconButton
                    icon="fa-xmark"
                    label="Reject"
                    className="h-9 w-9 rounded-full border border-rose-400/40 bg-rose-950/40 text-rose-200 backdrop-blur-sm hover:bg-rose-900/50"
                    onClick={() =>
                      patchStatus.mutate({ id: r.id, status: "rejected" })
                    }
                  />
                  <IconButton
                    icon="fa-check"
                    label="Mark received"
                    className="h-9 w-9 rounded-full bg-bob-pink text-white shadow-sm hover:bg-pink-600"
                    onClick={() =>
                      patchStatus.mutate({ id: r.id, status: "received" })
                    }
                  />
                  <IconButton
                    icon="fa-ban"
                    label="Not brought"
                    className="surface-glass-btn h-9 w-9 border px-0 text-pink-100"
                    onClick={() =>
                      patchStatus.mutate({ id: r.id, status: "not_brought" })
                    }
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white drop-shadow-sm">
          <i className="fa-solid fa-user" aria-hidden />
          Mine
        </h2>
        <ul className="mt-3 space-y-3">
          {(mine.data?.requests ?? []).map((r) => (
            <li
              key={r.id}
              className="surface-glass p-4"
            >
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-medium text-bob-pink">{r.status}</span>
                <span className="text-pink-200/70">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
              <ul className="mt-2 text-sm text-pink-100/95">
                {r.lines.map((l, i) => (
                  <li key={i}>{formatLine(l)}</li>
                ))}
              </ul>
              {r.status === "pending" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <IconButton
                    icon="fa-pen"
                    label="Edit quantity"
                    className="surface-glass-btn h-9 w-9 border px-0 text-pink-100"
                    onClick={async () => {
                      const qty = Number(
                        prompt(
                          "Qty for first line?",
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
                  />
                  <IconButton
                    icon="fa-trash"
                    label="Delete request"
                    className="h-9 w-9 rounded-full border border-rose-400/40 bg-rose-950/40 text-rose-200 backdrop-blur-sm hover:bg-rose-900/50"
                    onClick={async () => {
                      if (!confirm("Delete this request?")) return;
                      await apiFetch(`/requests/${r.id}`, { method: "DELETE" });
                      qc.invalidateQueries({ queryKey: ["my-requests"] });
                      qc.invalidateQueries({ queryKey: ["inventory"] });
                      qc.invalidateQueries({ queryKey: ["community-requests"] });
                      qc.invalidateQueries({ queryKey: ["admin-requests"] });
                    }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </Layout>
  );
}
