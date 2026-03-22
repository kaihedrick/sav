import { Navigate, useLocation } from "react-router-dom";
import { getIdToken, clearTokens } from "../lib/tokens";
import { isAppSessionToken } from "../lib/sessionJwt";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const t = getIdToken();
  if (t && !isAppSessionToken(t)) {
    clearTokens();
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  if (!t) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  return <>{children}</>;
}
