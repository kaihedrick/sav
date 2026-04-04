import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "../components/Layout";
import { apiFetch, apiJson } from "../lib/api";
import { setTokens } from "../lib/tokens";

type MeResponse = {
  email: string;
  firstName: string;
  lastName: string;
  needsProfile: boolean;
};

type LocState = {
  from?: string;
  prefillFirstName?: string;
  prefillLastName?: string;
};

export function CompleteProfilePage() {
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();
  const state = (loc.state as LocState | null) ?? {};

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiJson<MeResponse>("/me"),
  });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!me) return;
    if (!me.needsProfile) {
      nav(state.from ?? "/", { replace: true });
      return;
    }
    if (me.firstName || me.lastName) {
      setFirstName(me.firstName);
      setLastName(me.lastName);
    } else {
      setFirstName(state.prefillFirstName ?? "");
      setLastName(state.prefillLastName ?? "");
    }
  }, [me, nav, state.from, state.prefillFirstName, state.prefillLastName]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      const res = await apiFetch("/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      });
      const raw = (await res.json()) as { accessToken?: string; error?: string };
      if (!res.ok) {
        throw new Error(raw.error ?? "Could not save profile");
      }
      if (!raw.accessToken) throw new Error("Missing token");
      setTokens(raw.accessToken, "");
      await qc.invalidateQueries({ queryKey: ["me"] });
      nav(state.from ?? "/", { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setPending(false);
    }
  }

  return (
    <Layout showNav={false}>
      <div className="surface-glass-auth mx-auto mt-10 max-w-md p-8">
        <h1 className="section-title text-center text-xl">Your name</h1>
        <p className="mt-2 text-center text-sm text-bob-muted">
          We use this so others can see who signed up to bring each item. This is
          your first sign-in — add your first and last name as you’d like them
          shown.
        </p>
        {me?.email && (
          <p className="mt-2 text-center text-xs text-bob-muted">
            Signed in as <span className="font-medium text-bob-ink">{me.email}</span>
          </p>
        )}
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm font-medium text-bob-ink">
              First name
            </label>
            <input
              required
              maxLength={80}
              autoComplete="given-name"
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-bob-ink placeholder:text-neutral-400 focus:border-bob-gold focus:outline-none focus:ring-2 focus:ring-bob-gold/25"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-bob-ink">
              Last name
            </label>
            <input
              required
              maxLength={80}
              autoComplete="family-name"
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-bob-ink placeholder:text-neutral-400 focus:border-bob-gold focus:outline-none focus:ring-2 focus:ring-bob-gold/25"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          {err && <p className="text-sm text-red-700">{err}</p>}
          <button
            type="submit"
            disabled={pending || !firstName.trim() || !lastName.trim()}
            className="w-full rounded-full bg-bob-gold py-3 font-semibold text-white shadow-md transition-colors hover:bg-bob-gold-dark disabled:opacity-50"
          >
            {pending ? "Saving…" : "Continue"}
          </button>
        </form>
      </div>
    </Layout>
  );
}
