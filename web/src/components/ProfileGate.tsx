import { useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "./Layout";
import { apiJson } from "../lib/api";
import { getIdToken } from "../lib/tokens";
import { isAdminFromToken } from "../lib/sessionJwt";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL ?? "";

type MeResponse = {
  needsProfile: boolean;
};

/**
 * Redirects to /complete-profile until first + last name are saved.
 * Wrap routes that require a finished profile (not the profile page itself).
 */
export function ProfileGate({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const admin = useMemo(() => {
    const t = getIdToken();
    if (!t) return false;
    return isAdminFromToken(t, ADMIN_EMAIL || undefined);
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiJson<MeResponse>("/me"),
  });

  if (isLoading) {
    return (
      <Layout isAdmin={admin}>
        <p className="text-pink-100">Loading…</p>
      </Layout>
    );
  }

  if (isError) {
    return (
      <Layout isAdmin={admin}>
        <p className="text-pink-100">Could not load your profile. Try signing in again.</p>
      </Layout>
    );
  }

  if (data?.needsProfile) {
    return (
      <Navigate
        to="/complete-profile"
        replace
        state={{ from: loc.pathname === "/complete-profile" ? "/" : loc.pathname }}
      />
    );
  }

  return <>{children}</>;
}
