import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
  const [newEventDate, setNewEventDate] = useState(todayIso());

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
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });

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

  const requests = (data?.requests ?? []).filter(
    (r) => r.status !== "rejected",
  );

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
        `Save archive for the current event${eventDate ? ` (${eventDate})` : ""}, clear the inbox, then set the new event to ${newEventDate}?`,
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
          Request inbox
        </h1>
        <p className="mt-1 text-sm text-bob-muted">
          {requests.length} request{requests.length === 1 ? "" : "s"}
          {eventDate ? ` · event ${eventDate}` : ""}
        </p>
      </div>

      <section className="surface-glass min-w-0 space-y-4 overflow-visible p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-bob-wood">
          Event
        </h2>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1 text-sm text-bob-ink">
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
            className="surface-glass-btn w-full shrink-0 px-3 py-2.5 text-sm font-medium sm:w-auto"
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
            Save date
          </button>
        </div>

        <div className="min-w-0 border-t border-bob-mist/70 pt-4">
          <p className="text-sm text-bob-muted">
            Starting a new event saves request history, contributors, and
            inventory to Excel (Downloads on desktop; Share / Files on iPhone),
            then clears the inbox.
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
              disabled={busy}
              onClick={() => void startNewEvent()}
            >
              {busy ? "Working…" : "Start new event"}
            </button>
          </div>
          <button
            type="button"
            className="surface-glass-btn mt-3 w-full px-3 py-2 text-sm font-medium sm:w-auto"
            disabled={busy}
            onClick={() =>
              void exportArchive().catch((e) =>
                window.alert((e as Error).message || "Export failed"),
              )
            }
          >
            Export all purchase history
          </button>
        </div>
      </section>

      {isLoading && <p className="mt-4 text-sm text-bob-muted">Loading…</p>}
      {error && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {(error as Error).message}
        </p>
      )}

      <ul className="mt-6 space-y-4">
        {requests.map((r) => (
          <li key={r.id} className="surface-glass p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-bob-ink">{r.userName}</p>
                <p className="text-xs text-bob-muted">
                  {new Date(r.createdAt).toLocaleString()} ·{" "}
                  <span className="font-medium text-bob-magenta">{r.status}</span>
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
            <div className="mt-3 flex flex-wrap gap-2">
              {r.status === "pending" && (
                <>
                  <button
                    type="button"
                    className="rounded-full bg-bob-gold px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-bob-gold-dark"
                    onClick={() =>
                      patchStatus.mutate({ id: r.id, status: "received" })
                    }
                  >
                    Mark received
                  </button>
                  <button
                    type="button"
                    className="surface-glass-btn px-3 py-1.5 text-sm font-medium"
                    onClick={() =>
                      patchStatus.mutate({ id: r.id, status: "not_brought" })
                    }
                  >
                    Not brought
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Layout>
  );
}
