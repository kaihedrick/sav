import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "../components/Layout";
import { apiJson, apiFetch } from "../lib/api";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getIdToken } from "../lib/tokens";
import { isAdminFromToken } from "../lib/sessionJwt";
import {
  categoryAccent,
  inventoryGlassCardClass,
  stockLevelFromOnHand,
  stockStatusClasses,
} from "../lib/inventoryCardStyle";
import { IconButton } from "../components/IconButton";
import { InventoryBrowser } from "../components/InventoryBrowser";
import { ItemThumb } from "../components/ItemThumb";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL ?? "";

type InvItem = {
  id: string;
  name: string;
  category: string;
  targetQty: number;
  onHand: number;
  projected: number;
  priorityScore: number;
  imageUrl?: string;
  hidden?: boolean;
};

type RequestRow = {
  id: string;
  userName: string;
  status: string;
  lines: { itemId: string; qty: number; itemName?: string }[];
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
      status: "pending" | "received" | "not_brought";
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

  const [quickOrderItem, setQuickOrderItem] = useState<InvItem | null>(null);
  const [quickQty, setQuickQty] = useState(1);
  const [mineTab, setMineTab] = useState<"pending" | "history">("pending");

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

  useEffect(() => {
    if (!quickOrderItem) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
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
  const needsItems = useMemo(
    () => (admin ? items : items.filter((it) => !it.hidden)),
    [admin, items],
  );
  const itemNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of items) m.set(it.id, it.name);
    return m;
  }, [items]);

  function formatLine(l: { itemId: string; qty: number; itemName?: string }) {
    const name =
      l.itemName ?? itemNameById.get(l.itemId) ?? "Unknown item";
    return `${name} × ${l.qty}`;
  }

  const othersList: RequestRow[] = (
    admin
      ? (allForAdmin.data?.requests ?? [])
      : (community.data?.requests ?? [])
  ).filter((r) => r.status !== "rejected");

  const mineRequests = mine.data?.requests ?? [];
  const pendingMine = mineRequests.filter((r) => r.status === "pending");
  const historyMine = mineRequests.filter(
    (r) => r.status === "received" || r.status === "not_brought",
  );
  const receivedCount = mineRequests.filter((r) => r.status === "received").length;

  return (
    <Layout isAdmin={admin}>
      <h1 className="text-2xl font-bold tracking-tight text-bob-ink md:text-3xl">
        What we need
      </h1>
      <section className="mt-6">
        {inv.isLoading && (
          <p className="text-bob-muted" aria-live="polite">
            <i className="fa-solid fa-spinner fa-spin" aria-hidden />{" "}
            <span className="sr-only">Loading</span>
          </p>
        )}
        {inv.error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {(inv.error as Error).message}
          </p>
        )}
        {!inv.isLoading && !inv.error ? (
        <InventoryBrowser
          items={needsItems}
          renderItem={(it) => {
            const accent = categoryAccent(it.category || "General");
            const level = stockLevelFromOnHand(it.onHand);
            const status = stockStatusClasses(level);
            return (
              <article
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
                  className="pointer-events-none absolute right-3 top-3 z-10 text-bob-gold/50"
                  aria-hidden
                >
                  <i className="fa-solid fa-circle-plus text-lg" />
                </span>
                <div className="relative z-10 flex flex-wrap items-start gap-3">
                  <ItemThumb
                    name={it.name}
                    category={it.category}
                    imageUrl={it.imageUrl}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-semibold text-bob-ink">{it.name}</h2>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.pillClass}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    {(it.category || "").trim() ? (
                      <p className="mt-0.5 text-xs text-bob-muted">{it.category}</p>
                    ) : null}
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-bob-muted">On hand</dt>
                        <dd
                          className={`font-medium ${level === "out" ? "text-red-700" : level === "low" ? "text-amber-700" : "text-emerald-800"}`}
                        >
                          {it.onHand}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-bob-muted">Projected</dt>
                        <dd className="font-medium text-bob-magenta">{it.projected}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </article>
            );
          }}
        />
        ) : null}
      </section>

      {quickOrderItem &&
        createPortal(
          <div
            className="modal-backdrop"
            role="presentation"
            onClick={() => setQuickOrderItem(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="quick-order-title"
              className="quick-order-dialog max-w-sm overflow-hidden p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative">
                <ItemThumb
                  name={quickOrderItem.name}
                  category={quickOrderItem.category}
                  imageUrl={quickOrderItem.imageUrl}
                  className="h-56 w-full rounded-none border-0 shadow-none sm:h-64"
                  emojiClassName="text-6xl"
                />
                <IconButton
                  icon="fa-xmark"
                  label="Close"
                  onClick={() => setQuickOrderItem(null)}
                  className="absolute right-3 top-3 h-10 w-10 rounded-full border border-bob-mist/80 bg-bob-cream/90 text-bob-muted shadow-sm backdrop-blur-sm hover:bg-white"
                />
              </div>
              <div className="p-5">
                <h2
                  id="quick-order-title"
                  className="text-xl font-semibold text-bob-ink"
                >
                  {quickOrderItem.name}
                </h2>
                {(quickOrderItem.category || "").trim() ? (
                  <p className="mt-1 text-sm text-bob-muted">
                    {quickOrderItem.category}
                  </p>
                ) : null}
                <div className="mt-5 flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    autoFocus
                    aria-label="Quantity"
                    className="w-24 rounded-xl border border-neutral-200 px-3 py-2.5 text-base text-bob-ink focus:border-bob-gold focus:outline-none focus:ring-2 focus:ring-bob-gold/30"
                    value={quickQty < 1 ? "" : quickQty}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") {
                        setQuickQty(0);
                        return;
                      }
                      const n = Number(v);
                      if (!Number.isFinite(n)) return;
                      setQuickQty(n);
                    }}
                    onBlur={() => {
                      if (quickQty < 1) setQuickQty(1);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (quickQty < 1 || quickCommit.isPending) return;
                        quickCommit.mutate({
                          itemId: quickOrderItem.id,
                          qty: quickQty,
                        });
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={quickCommit.isPending || quickQty < 1}
                    onClick={() =>
                      quickCommit.mutate({
                        itemId: quickOrderItem.id,
                        qty: quickQty,
                      })
                    }
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-bob-gold px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-bob-gold-dark disabled:opacity-50"
                  >
                    <i
                      className={`fa-solid ${quickCommit.isPending ? "fa-spinner fa-spin" : "fa-check"}`}
                      aria-hidden
                    />
                    {quickCommit.isPending ? "Sending…" : "Commit"}
                  </button>
                </div>
                {quickCommit.isError && (
                  <p className="mt-3 text-sm text-red-700">
                    {(quickCommit.error as Error).message}
                  </p>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      <section className="mt-10">
        <h2 className="section-title flex items-center gap-2 text-lg tracking-tight">
          <i className="fa-solid fa-user" aria-hidden />
          My requests
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
              <i className="fa-solid fa-clock" aria-hidden />
              Pending
            </p>
            <p className="mt-1 text-xl font-semibold text-bob-ink">
              {pendingMine.length}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-800">
              <i className="fa-solid fa-check" aria-hidden />
              Received
            </p>
            <p className="mt-1 text-xl font-semibold text-bob-ink">
              {receivedCount}
            </p>
          </div>
        </div>
        <div
          className="mt-4 flex gap-1 rounded-full border border-bob-mist/80 bg-white/70 p-1"
          role="tablist"
          aria-label="My requests"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mineTab === "pending"}
            className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium ${
              mineTab === "pending"
                ? "bg-bob-wood text-white shadow-sm"
                : "text-bob-muted hover:bg-bob-mist/60 hover:text-bob-ink"
            }`}
            onClick={() => setMineTab("pending")}
          >
            Pending
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mineTab === "history"}
            className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium ${
              mineTab === "history"
                ? "bg-bob-wood text-white shadow-sm"
                : "text-bob-muted hover:bg-bob-mist/60 hover:text-bob-ink"
            }`}
            onClick={() => setMineTab("history")}
          >
            History
          </button>
        </div>
        <ul className="mt-3 space-y-3">
          {(mineTab === "pending" ? pendingMine : historyMine).length === 0 && (
            <li className="surface-glass flex items-center gap-2 px-4 py-3 text-sm text-bob-muted">
              <i className="fa-solid fa-inbox" aria-hidden />
              Empty
            </li>
          )}
          {(mineTab === "pending" ? pendingMine : historyMine).map((r) => (
            <li key={r.id} className="surface-glass p-4">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    r.status === "received"
                      ? "bg-emerald-50 text-emerald-800"
                      : r.status === "not_brought"
                        ? "bg-amber-50 text-amber-800"
                        : "bg-bob-mist/80 text-bob-ink"
                  }`}
                >
                  {r.status === "received"
                    ? "Received"
                    : r.status === "not_brought"
                      ? "Not brought"
                      : "Pending"}
                </span>
                <span className="text-bob-muted">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
              <ul className="mt-2 text-sm text-bob-ink/95">
                {r.lines.map((l, i) => (
                  <li key={i}>{formatLine(l)}</li>
                ))}
              </ul>
              {r.status === "pending" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <IconButton
                    icon="fa-pen"
                    label="Edit quantity"
                    className="surface-glass-btn h-9 w-9 border px-0 text-bob-ink"
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
                    className="h-9 w-9 rounded-full border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
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

      <section className="mt-10">
        <h2 className="section-title flex items-center gap-2 text-lg tracking-tight">
          <i
            className={`fa-solid ${admin ? "fa-clipboard-list" : "fa-users"}`}
            aria-hidden
          />
          {admin ? "All requests" : "Community"}
        </h2>
        {!admin && community.isLoading && (
          <p className="mt-3 text-bob-muted" aria-live="polite">
            <i className="fa-solid fa-spinner fa-spin" aria-hidden />
            <span className="sr-only">Loading</span>
          </p>
        )}
        {admin && allForAdmin.isLoading && (
          <p className="mt-3 text-bob-muted" aria-live="polite">
            <i className="fa-solid fa-spinner fa-spin" aria-hidden />
            <span className="sr-only">Loading</span>
          </p>
        )}
        <ul className="mt-3 space-y-3">
          {othersList.length === 0 && !community.isLoading && !allForAdmin.isLoading && (
            <li className="surface-glass flex items-center gap-2 px-4 py-3 text-sm text-bob-muted">
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
                <span className="font-semibold text-bob-ink">{r.userName}</span>
                <span className="font-medium text-bob-magenta">{r.status}</span>
              </div>
              <p className="mt-0.5 text-xs text-bob-muted">
                {new Date(r.createdAt).toLocaleString()}
              </p>
              <ul className="mt-2 text-sm text-bob-ink/95">
                {r.lines.map((l, i) => (
                  <li key={i}>{formatLine(l)}</li>
                ))}
              </ul>
              {admin && r.status === "pending" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <IconButton
                    icon="fa-check"
                    label="Mark received"
                    className="h-9 w-9 rounded-full bg-bob-gold text-white shadow-sm hover:bg-bob-gold-dark"
                    onClick={() =>
                      patchStatus.mutate({ id: r.id, status: "received" })
                    }
                  />
                  <IconButton
                    icon="fa-ban"
                    label="Not brought"
                    className="surface-glass-btn h-9 w-9 border px-0 text-bob-ink"
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
    </Layout>
  );
}
