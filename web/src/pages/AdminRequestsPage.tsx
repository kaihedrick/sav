import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Layout } from "../components/Layout";
import { apiJson, apiFetch } from "../lib/api";
import { Link } from "react-router-dom";

type RequestRow = {
  id: string;
  userId: string;
  userName: string;
  status: string;
  lines: { itemId: string; qty: number }[];
  createdAt: string;
  updatedAt: string;
};

export function AdminRequestsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-requests"],
    queryFn: () => apiJson<{ requests: RequestRow[] }>("/admin/requests"),
    refetchInterval: 20_000,
  });

  const inv = useQuery({
    queryKey: ["inventory"],
    queryFn: () => apiJson<{ items: { id: string; name: string }[] }>("/inventory"),
  });

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
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });

  const requests = data?.requests ?? [];

  return (
    <Layout isAdmin>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-md md:text-2xl">
          Request inbox
        </h1>
        <Link
          to="/admin"
          className="text-sm font-medium text-bob-pink underline decoration-pink-300 underline-offset-2"
        >
          Catalog
        </Link>
      </div>
      <p className="max-w-2xl text-sm leading-relaxed text-pink-100/90">
        Newest first. Rejecting removes a commitment from projected totals.
        Mark received after the event.
      </p>

      {isLoading && (
        <p className="mt-4 text-sm text-pink-200/90">Loading…</p>
      )}
      {error && (
        <p className="mt-4 rounded-xl border border-rose-400/40 bg-rose-950/50 px-3 py-2 text-sm text-red-200 backdrop-blur-sm">
          {(error as Error).message}
        </p>
      )}

      <ul className="mt-6 space-y-4">
        {requests.map((r) => (
          <li
            key={r.id}
            className="surface-glass p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-pink-50">{r.userName}</p>
                <p className="text-xs text-pink-200/75">
                  {new Date(r.createdAt).toLocaleString()} ·{" "}
                  <span className="font-medium text-bob-pink">{r.status}</span>
                </p>
              </div>
            </div>
            <ul className="mt-2 text-sm text-pink-100/95">
              {r.lines.map((l, i) => (
                <li key={i}>
                  {itemNameById.get(l.itemId) ?? "Unknown item"} × {l.qty}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {r.status === "pending" && (
                <>
                  <button
                    type="button"
                    className="rounded-full border border-rose-400/40 bg-rose-950/45 px-3 py-1.5 text-sm font-medium text-rose-200 backdrop-blur-sm hover:bg-rose-900/55"
                    onClick={() =>
                      patchStatus.mutate({ id: r.id, status: "rejected" })
                    }
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-bob-pink px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-pink-600"
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
