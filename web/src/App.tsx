import { Routes, Route, Navigate } from "react-router-dom";
import { RequireAuth } from "./components/RequireAuth";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminRequestsPage } from "./pages/AdminRequestsPage";
import { getIdToken } from "./lib/tokens";
import { isAdminFromToken } from "./lib/sessionJwt";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL ?? "";

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const t = getIdToken();
  if (!t || !isAdminFromToken(t, ADMIN_EMAIL || undefined)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      {/* Old Cognito flow used this path; send anyone with a stale bookmark here back to GIS login. */}
      <Route path="/auth/callback" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/requests"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AdminRequestsPage />
            </RequireAdmin>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
