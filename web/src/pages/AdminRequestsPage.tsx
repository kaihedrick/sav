import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { HistoryActions } from "../components/HistoryActions";
import { Layout } from "../components/Layout";
import { apiJson, apiFetch } from "../lib/api";
import { downloadEventArchive } from "../lib/requestsExcel";

type RequestRow = {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  status: string;
  lines: { itemId: string; qty: number; itemName?: string }[];
  createdAt: string;
  updatedAt: string;
};

type InvItem = {
  id: string;
  name: string;
  category: string;
  onHand: number;
  targetQty: number;
  packType?: string;
  projected: number;
  hidden?: boolean;
};

type UserRow = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
};

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function AdminRequestsPage() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [draftDate, setDraftDate] = useState("");
  const [newEventDate, setNewEventDate] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-requests"],
    queryFn: () => apiJson<{ requests: RequestRow[] }>("/admin/requests"),
    refetchInterval: 20_000,
  });

  const inv = useQuery({
    queryKey: ["inventory"],
    queryFn: () => apiJson<{ items: InvItem[] }>("/inventory"),
  });

  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiJson<{ users: UserRow[] }>("/admin/users"),
  });

  const event = useQuery({
    queryKey: ["event"],
    queryFn: () => apiJson<{ eventDate: string | null }>("/event"),
  });

  const eventDate = event.data?.eventDate ?? null;

  const itemNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of inv.data?.items ?? []) {
      m.set(it.id, it.name);
    }
    return m;
  }, [inv.data?.items]);

  const saveEventDate = useMutation({
    mutationFn: async (date: string) => {
      const res = await apiFetch("/admin/event", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventDate: date }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ eventDate: string }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event"] });
    },
  });

  const requests = data?.requests ?? [];

  function lineName(l: RequestRow["lines"][number]) {
    return l.itemName ?? itemNameById.get(l.itemId) ?? "Unknown item";
  }

  async function buildArchivePayload() {
    const requestLines = requests.flatMap((r) =>
      r.lines.map((l) => ({
        createdAt: r.createdAt,
        userName: r.userName,
        userEmail: r.userEmail,
        status: r.status,
        itemName: lineName(l),
        qty: l.qty,
        requestId: r.id,
      })),
    );
    let userRows = users.data?.users ?? [];
    if (!users.data) {
      const fresh = await apiJson<{ users: UserRow[] }>("/admin/users");
      userRows = fresh.users;
    }
    let items = inv.data?.items ?? [];
    if (!inv.data) {
      const fresh = await apiJson<{ items: InvItem[] }>("/inventory");
      items = fresh.items;
    }
    return {
      eventDate,
      requests: requestLines,
      users: userRows.map((u) => ({
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        createdAt: u.createdAt,
      })),
      inventory: items.map((it) => ({
        name: it.name,
        category: it.category,
        onHand: it.onHand,
        targetQty: it.targetQty,
        packType: it.packType,
        projected: it.projected,
        hidden: it.hidden,
      })),
    };
  }

  async function exportArchive() {
    const payload = await buildArchivePayload();
    const stamp = eventDate ?? todayIso();
    await downloadEventArchive({
      ...payload,
      filename: `Bags of Blessings — ${stamp} event archive.xlsx`,
    });
  }

  async function startNewEvent() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newEventDate)) {
      window.alert("Pick a valid event date.");
      return;
    }
    if (
      !window.confirm(
        `Save archive for the current event${eventDate ? ` (${eventDate})` : ""}, clear its history, then set the new event to ${newEventDate}?`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await exportArchive();
      const res = await apiFetch("/admin/requests", { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      const body = (await res.json()) as { deleted?: number };
      await saveEventDate.mutateAsync(newEventDate);
      await qc.invalidateQueries({ queryKey: ["admin-requests"] });
      await qc.invalidateQueries({ queryKey: ["my-requests"] });
      await qc.invalidateQueries({ queryKey: ["community-requests"] });
      await qc.invalidateQueries({ queryKey: ["inventory"] });
      window.alert(
        `Archive saved. Cleared ${body.deleted ?? requests.length} request(s). New event: ${newEventDate}.`,
      );
    } catch (e) {
      window.alert((e as Error).message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout isAdmin>
      <div className="mb-4">
        <h1 className="text-xl font-bold tracking-tight text-bob-ink md:text-2xl">
          Contribution history
        </h1>
        <p className="mt-1 text-sm text-bob-muted">
          {requests.length} contribution{requests.length === 1 ? "" : "s"}
          {eventDate ? ` · ${new Date(`${eventDate}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : ""}
        </p>
      </div>

      <button type="button" className="surface-glass-btn mb-3 inline-flex min-h-11 items-center gap-2 px-3 text-sm font-medium" disabled={busy || isLoading}
        onClick={() => void exportArchive().catch(e => window.alert((e as Error).message || "Export failed"))}>
        <i className="fa-solid fa-file-arrow-down text-bob-wood" aria-hidden />Export history
      </button>
      <details className="surface-glass group min-w-0 max-w-full overflow-hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-bob-wood [&::-webkit-details-marker]:hidden">
          <span><i className="fa-solid fa-calendar-days mr-2" aria-hidden />Manage event</span>
          <i className="fa-solid fa-chevron-down text-xs transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="space-y-4 border-t border-bob-mist/70 p-4">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
          <label className="block min-w-0 text-sm text-bob-ink">
            Current event date
            <input
              type="date"
              className="input-date"
              value={draftDate || eventDate || ""}
              onChange={(e) => setDraftDate(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="surface-glass-btn min-h-11 px-3 text-sm font-medium disabled:opacity-50"
            disabled={
              saveEventDate.isPending ||
              !(draftDate || eventDate) ||
              (draftDate || eventDate) === eventDate
            }
            onClick={() => {
              const d = draftDate || eventDate;
              if (!d) return;
              saveEventDate.mutate(d, {
                onSuccess: () => setDraftDate(""),
                onError: (e) => window.alert((e as Error).message),
              });
            }}
          >
            Save
          </button>
        </div>

        <div className="min-w-0 border-t border-bob-mist/70 pt-4">
          <p className="text-sm text-bob-muted">
            Starting a new event exports this event’s history and inventory, then clears its contributions.
          </p>
          <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1 text-sm text-bob-ink">
              New event date
              <input
                type="date"
                className="input-date"
                value={newEventDate}
                onChange={(e) => setNewEventDate(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="w-full shrink-0 rounded-full bg-bob-wood px-4 py-2.5 text-sm font-medium text-white shadow-sm disabled:opacity-50 sm:w-auto"
              disabled={busy || !newEventDate}
              onClick={() => void startNewEvent()}
            >
              {busy ? "Working…" : "Start new event"}
            </button>
          </div>
        </div>
        </div>
      </details>

      {isLoading && <p className="mt-4 text-sm text-bob-muted">Loading…</p>}
      {error && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {(error as Error).message}
        </p>
      )}

      <ul className="mt-6 space-y-4">
        {!isLoading && !error && requests.length === 0 ? <li className="surface-glass p-4 text-sm text-bob-muted">No contributions yet. They’ll appear here when someone commits.</li> : null}
        {requests.map((r) => (
          <li key={r.id} className="surface-glass p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-bob-ink">{r.userName}</p>
                <p className="text-xs text-bob-muted">
                  {new Date(r.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
            <ul className="mt-2 text-sm text-bob-ink/95">
              {r.lines.map((l, i) => (
                <li key={i}>
                  {lineName(l)} × {l.qty}
                </li>
              ))}
            </ul>
            <HistoryActions request={r} />
          </li>
        ))}
      </ul>
    </Layout>
  );
}
