import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "../components/Layout";
import { apiJson } from "../lib/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getIdToken } from "../lib/tokens";
import { isAdminFromToken } from "../lib/sessionJwt";
import {
  categoryAccent,
  inventoryGlassCardClass,
  stockLevelFromOnHand,
  stockStatusClasses,
} from "../lib/inventoryCardStyle";
import { HistoryActions } from "../components/HistoryActions";
import { IconButton } from "../components/IconButton";
import { InventoryBrowser } from "../components/InventoryBrowser";
import { ItemThumb } from "../components/ItemThumb";
import { PackLabel } from "../components/PackLabel";
import ShinyText from "../components/ShinyText";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL ?? "";
// Use the recipient's shared Venmo profile link; a phone number is not a profile URL.
const VENMO_PROFILE_URL =
  import.meta.env.VITE_VENMO_PROFILE_URL?.trim() ||
  "https://account.venmo.com/u/Savannah-Leone-1";

type InvItem = {
  id: string;
  name: string;
  category: string;
  packType?: string;
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
  const commitAttempt = useRef<{ payload: string; id: string } | null>(null);
  const [commitWarning, setCommitWarning] = useState<string | null>(null);
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

  useEffect(() => {
    if (!quickOrderItem) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [quickOrderItem]);

  const quickCommit = useMutation({
    mutationFn: (payload: { itemId: string; qty: number }) => {
      const fingerprint = JSON.stringify(payload);
      if (commitAttempt.current?.payload !== fingerprint) commitAttempt.current = { payload: fingerprint, id: crypto.randomUUID() };
      return apiJson<{ googleSheetSync?: string }>("/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: commitAttempt.current.id,
          lines: [{ itemId: payload.itemId, qty: payload.qty }],
        }),
      });
    },
    onSuccess: (data) => {
      commitAttempt.current = null;
      setCommitWarning(data.googleSheetSync === "error" ? "Your commitment is saved and On hand is updated on the website, but the shared sheet could not update. Please let an admin know." : null);
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
  );

  const mineRequests = mine.data?.requests ?? [];

  return (
    <Layout isAdmin={admin}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-bob-ink md:text-3xl">
          What we need
        </h1>
        {VENMO_PROFILE_URL ? (
          <a
            href={VENMO_PROFILE_URL}
            className="surface-glass-btn inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bob-ink"
          >
            <i className="fa-solid fa-dollar-sign" aria-hidden="true" />
            <ShinyText
              text="Donate money"
              color="#604438"
              shineColor="#99702e"
              speed={2}
              delay={1}
            />
          </a>
        ) : null}
      </div>
      <section className="mt-6">
        <p className="mb-3 flex items-center gap-2 text-sm text-bob-muted">
          <i className="fa-solid fa-arrow-down motion-safe:animate-bounce" aria-hidden="true" />
          Add items below
        </p>
        {commitWarning ? <p role="status" className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{commitWarning}</p> : null}
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
                    <PackLabel value={it.packType} />
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
                        <dt className="text-bob-muted">Target</dt>
                        <dd className="font-medium text-bob-magenta">{it.targetQty}</dd>
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
                <PackLabel value={quickOrderItem.packType} />
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
          My history
        </h2>
        <p className="mt-2 text-sm text-bob-muted">Your contributions appear here as soon as you commit. You can edit them later.</p>
        <ul className="mt-3 space-y-3">
          {mineRequests.length === 0 && (
            <li className="surface-glass flex items-center gap-2 px-4 py-3 text-sm text-bob-muted">
              <i className="fa-solid fa-inbox" aria-hidden />
              Empty
            </li>
          )}
          {mineRequests.map((r) => (
            <li key={r.id} className="surface-glass p-4">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="text-bob-muted">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
              <ul className="mt-2 text-sm text-bob-ink/95">
                {r.lines.map((l, i) => (
                  <li key={i}>{formatLine(l)}</li>
                ))}
              </ul>
              <HistoryActions request={r} />
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
          {admin ? "All history" : "Community history"}
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
              </div>
              <p className="mt-0.5 text-xs text-bob-muted">
                {new Date(r.createdAt).toLocaleString()}
              </p>
              <ul className="mt-2 text-sm text-bob-ink/95">
                {r.lines.map((l, i) => (
                  <li key={i}>{formatLine(l)}</li>
                ))}
              </ul>
              {admin ? <HistoryActions request={r} /> : null}
            </li>
          ))}
        </ul>
      </section>
    </Layout>
  );
}
