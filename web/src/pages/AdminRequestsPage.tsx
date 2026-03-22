import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
        <h1 className="text-xl font-bold md:text-2xl">Request inbox</h1>
        <Link to="/admin" className="text-sm text-bob-blue underline">
          Catalog
        </Link>
      </div>
      <p className="text-sm text-gray-600">
        Newest first. Rejecting removes a commitment from projected totals.
        Mark received after the event.
      </p>

      {isLoading && <p className="mt-4">Loading…</p>}
      {error && (
        <p className="mt-4 text-red-600">{(error as Error).message}</p>
      )}

      <ul className="mt-6 space-y-4">
        {requests.map((r) => (
          <li
            key={r.id}
            className="rounded-2xl border border-pink-100 bg-white/95 p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-900">{r.userName}</p>
                <p className="text-xs text-gray-500">
                  {new Date(r.createdAt).toLocaleString()} ·{" "}
                  <span className="font-medium text-bob-pink">{r.status}</span>
                </p>
              </div>
            </div>
            <ul className="mt-2 text-sm">
              {r.lines.map((l, i) => (
                <li key={i}>
                  {l.itemId} × {l.qty}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {r.status === "pending" && (
                <>
                  <button
                    type="button"
                    className="rounded-full bg-red-50 px-3 py-1.5 text-sm text-red-700"
                    onClick={() =>
                      patchStatus.mutate({ id: r.id, status: "rejected" })
                    }
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800"
                    onClick={() =>
                      patchStatus.mutate({ id: r.id, status: "received" })
                    }
                  >
                    Mark received
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-gray-100 px-3 py-1.5 text-sm"
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
