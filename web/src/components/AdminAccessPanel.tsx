import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch, apiJson } from "../lib/api";

type MemberRow = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  createdAt: string;
  isAdmin: boolean;
  canRevokeAdmin: boolean;
};

function formatJoined(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function AdminAccessPanel() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);

  const members = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiJson<{ users: MemberRow[] }>("/admin/users"),
  });

  const grant = useMutation({
    mutationFn: async (addr: string) => {
      const res = await apiFetch("/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addr }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ emails: string[] }>;
    },
    onSuccess: () => {
      setEmail("");
      setMsg("Admin added. They must sign out and sign in again.");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-emails"] });
      setTimeout(() => setMsg(null), 5000);
    },
    onError: (e) => setMsg((e as Error).message || "Failed"),
  });

  const revoke = useMutation({
    mutationFn: async (addr: string) => {
      const res = await apiFetch("/admin/admins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addr }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? res.statusText);
      }
      return res.json() as Promise<{ emails: string[] }>;
    },
    onSuccess: () => {
      setMsg("Admin access removed. They must sign out and sign in again.");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-emails"] });
      setTimeout(() => setMsg(null), 5000);
    },
    onError: (e) => setMsg((e as Error).message || "Failed"),
  });

  const list = members.data?.users ?? [];
  const pending = grant.isPending || revoke.isPending;

  async function toggleAdmin(user: MemberRow) {
    const addr = user.email.toLowerCase().trim();
    if (pending) return;
    setBusyEmail(addr);
    try {
      if (user.isAdmin && user.canRevokeAdmin) {
        await revoke.mutateAsync(addr);
      } else if (!user.isAdmin) {
        await grant.mutateAsync(addr);
      }
    } finally {
      setBusyEmail(null);
    }
  }

  return (
    <div className="rounded-xl border border-bob-mist/80 bg-white/50 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-bob-wood/90">
        Admin access
      </p>
      <p className="mt-1 text-xs text-bob-muted">
        Grant admin by email or tap a member below. No notification is sent.
      </p>
      <form
        className="mt-3 flex min-w-0 flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = email.trim();
          if (!t) return;
          grant.mutate(t);
        }}
      >
        <input
          type="email"
          placeholder="email@example.com"
          className="input-date !mt-0"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
        />
        <button
          type="submit"
          className="surface-glass-btn w-full px-3 py-2 text-sm font-medium disabled:opacity-50"
          disabled={pending || !email.trim()}
        >
          {grant.isPending && !busyEmail ? "Adding…" : "Grant admin by email"}
        </button>
      </form>
      {msg ? (
        <p className="mt-2 text-xs text-bob-wood">{msg}</p>
      ) : null}

      <div className="mt-4 border-t border-bob-mist/80 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-bob-wood/90">
          Members
          {members.isLoading ? null : (
            <span className="ml-1 font-normal text-bob-muted">({list.length})</span>
          )}
        </p>
        <p className="mt-1 text-xs text-bob-muted">
          Everyone who has signed in. Tap to grant or remove admin.
        </p>
        <ul className="mt-2 space-y-1">
          {members.isLoading ? (
            <li className="text-xs text-bob-muted">Loading…</li>
          ) : list.length === 0 ? (
            <li className="text-xs text-bob-muted">No members yet</li>
          ) : (
            list.map((user) => {
              const addr = user.email.toLowerCase().trim();
              const isBusy = busyEmail === addr;
              const clickable =
                !user.isAdmin || user.canRevokeAdmin;
              const actionLabel = user.isAdmin
                ? user.canRevokeAdmin
                  ? "Remove admin"
                  : "Built-in admin"
                : "Grant admin";

              return (
                <li key={user.userId}>
                  <button
                    type="button"
                    className={`flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
                      clickable
                        ? "hover:bg-bob-mist/60 active:bg-bob-mist/80"
                        : "opacity-90"
                    } ${isBusy ? "opacity-60" : ""}`}
                    disabled={!clickable || pending}
                    onClick={() => toggleAdmin(user)}
                    title={user.email}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-bob-ink">
                        {user.displayName}
                      </span>
                      <span className="block truncate text-xs text-bob-muted">
                        Joined {formatJoined(user.createdAt)}
                        {user.displayName !== user.email ? ` · ${user.email}` : ""}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        user.isAdmin
                          ? "bg-bob-gold/25 text-bob-wood"
                          : "bg-bob-mist/80 text-bob-muted"
                      }`}
                    >
                      {isBusy ? "…" : user.isAdmin ? "Admin" : actionLabel}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
