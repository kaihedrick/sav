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
      <div className="mx-auto mt-12 max-w-md rounded-3xl border border-pink-200/90 bg-white/92 p-8 shadow-lg shadow-pink-900/10 backdrop-blur">
        <h1 className="text-center text-2xl font-bold text-bob-pink">
          Bags of Blessings
        </h1>
        <p className="mt-2 text-center text-sm text-bob-muted">
          Sign in with Google to view needs and share what you can bring.
        </p>
        {!ready && (
          <p className="mt-4 rounded-xl border border-pink-200 bg-pink-50/80 p-3 text-sm text-bob-ink">
            Set <code className="rounded bg-white/90 px-1 text-xs text-bob-pink">VITE_GOOGLE_CLIENT_ID</code>{" "}
            and{" "}
            <code className="rounded bg-white/90 px-1 text-xs text-bob-pink">VITE_API_URL</code>{" "}
            locally in <code className="rounded bg-white/90 px-1 text-xs">web/.env</code>, or in your host’s
            environment (e.g. Vercel → Settings → Environment Variables), then rebuild.
          </p>
        )}
        {apiAuthError && (
          <p className="mt-4 rounded-xl border border-pink-300/80 bg-pink-50/90 p-3 text-sm text-bob-ink">
            <span className="font-semibold text-bob-rose">Server sign-in error:</span>{" "}
            {apiAuthError}
            <span className="mt-1 block text-xs text-bob-muted">
              If this says <code className="text-[11px] text-bob-ink">Missing bearer token</code>, redeploy
              the API (<code className="text-[11px]">sam deploy</code>) so{" "}
              <code className="text-[11px]">/auth/google</code> is live. Other messages usually mean Lambda{" "}
              <code className="text-[11px]">GOOGLE_CLIENT_ID</code> must match this Web client ID or the
              session secret env is wrong.
            </span>
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
