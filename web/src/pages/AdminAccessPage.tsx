import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "../components/Layout";
import { AdminAccessPanel } from "../components/AdminAccessPanel";
import { apiFetch, apiJson } from "../lib/api";
import { setTokens } from "../lib/tokens";

type MeResponse = {
  email: string;
  firstName: string;
  lastName: string;
  needsProfile: boolean;
  emailNotifyRequests: boolean;
  isAdmin: boolean;
};

export function AdminAccessPage() {
  const qc = useQueryClient();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiJson<MeResponse>("/me"),
  });

  const notify = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiFetch("/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailNotifyRequests: enabled }),
      });
      const raw = (await res.json()) as {
        accessToken?: string;
        emailNotifyRequests?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(raw.error ?? "Could not update");
      if (raw.accessToken) setTokens(raw.accessToken, "");
      return raw;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const enabled = me.data?.emailNotifyRequests !== false;

  return (
    <Layout isAdmin>
      <div className="mb-4">
        <h1 className="text-xl font-bold tracking-tight text-bob-ink md:text-2xl">
          Admin access
        </h1>
        <p className="mt-1 text-sm text-bob-muted">
          Manage admins and request email alerts.
        </p>
      </div>

      <section className="surface-glass mb-4 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-bob-wood/90">
          Purchase emails
        </p>
        <p className="mt-1 text-sm text-bob-muted">
          Email me when someone submits or updates a purchase request (who bought
          what).
        </p>
        <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-bob-mist/40 px-3 py-3">
          <span className="text-sm font-medium text-bob-ink">
            {enabled ? "Emails on" : "Emails off"}
          </span>
          <input
            type="checkbox"
            className="h-5 w-5 accent-bob-wood"
            checked={enabled}
            disabled={me.isLoading || notify.isPending}
            onChange={(e) => notify.mutate(e.target.checked)}
          />
        </label>
        {notify.isError ? (
          <p className="mt-2 text-xs text-rose-700">
            {(notify.error as Error).message}
          </p>
        ) : null}
        {me.data?.email ? (
          <p className="mt-2 text-xs text-bob-muted">Sent to {me.data.email}</p>
        ) : null}
      </section>

      <section className="surface-glass p-4">
        <AdminAccessPanel />
      </section>
    </Layout>
  );
}
