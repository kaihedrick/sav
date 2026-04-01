import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { Layout } from "../components/Layout";
import { GOOGLE_CLIENT_ID, API_URL } from "../lib/config";
import { getIdToken, setTokens, clearTokens } from "../lib/tokens";
import { isAppSessionToken } from "../lib/sessionJwt";

export function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string })?.from ?? "/";
  const [apiAuthError, setApiAuthError] = useState<string | null>(null);

  useEffect(() => {
    const t = getIdToken();
    if (t && !isAppSessionToken(t)) clearTokens();
    else if (t && isAppSessionToken(t)) nav(from, { replace: true });
  }, [from, nav]);

  const ready = Boolean(GOOGLE_CLIENT_ID && API_URL);

  return (
    <Layout showNav={false}>
      <div className="surface-glass-auth mx-auto mt-12 max-w-md p-8">
        <h1 className="text-center text-2xl font-bold text-bob-pink">
          Bags of Blessings
        </h1>
        {!ready && (
          <p className="mt-4 flex gap-2 rounded-xl border border-amber-400/35 bg-amber-950/50 p-3 text-sm text-amber-100 backdrop-blur-sm">
            <i className="fa-solid fa-triangle-exclamation mt-0.5 text-amber-400" aria-hidden />
            <span>
              Set <code className="text-xs">VITE_API_URL</code> &{" "}
              <code className="text-xs">VITE_GOOGLE_CLIENT_ID</code> (env / Vercel), then rebuild.
            </span>
          </p>
        )}
        {apiAuthError && (
          <p className="mt-4 flex gap-2 rounded-xl border border-rose-400/40 bg-rose-950/50 p-3 text-sm text-red-100 backdrop-blur-sm">
            <i className="fa-solid fa-circle-xmark mt-0.5 text-red-400" aria-hidden />
            <span>{apiAuthError}</span>
          </p>
        )}
        {ready && (
          <div className="mt-8 flex justify-center">
            <GoogleLogin
              ux_mode="popup"
              use_fedcm_for_button
              onSuccess={async (cred) => {
                setApiAuthError(null);
                const credential = cred.credential;
                if (!credential) return;
                const res = await fetch(`${API_URL}/auth/google`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ credential }),
                });
                const raw = await res.text();
                if (!res.ok) {
                  let detail = "Sign-in failed";
                  try {
                    const j = JSON.parse(raw) as { error?: string };
                    detail = j.error ?? detail;
                  } catch {
                    if (raw) detail = raw.slice(0, 200);
                  }
                  console.error("/auth/google", res.status, detail, raw);
                  setApiAuthError(`${res.status}: ${detail}`);
                  return;
                }
                const data = JSON.parse(raw) as {
                  accessToken: string;
                  needsProfile?: boolean;
                  prefillFirstName?: string;
                  prefillLastName?: string;
                };
                setTokens(data.accessToken, "");
                if (data.needsProfile) {
                  nav("/complete-profile", {
                    replace: true,
                    state: {
                      from,
                      prefillFirstName: data.prefillFirstName ?? "",
                      prefillLastName: data.prefillLastName ?? "",
                    },
                  });
                } else {
                  nav(from, { replace: true });
                }
              }}
              onError={() => alert("Google sign-in was cancelled or failed.")}
              useOneTap={false}
              theme="filled_black"
              size="large"
              text="continue_with"
              shape="pill"
            />
          </div>
        )}
      </div>
    </Layout>
  );
}
