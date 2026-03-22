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
      <div className="mx-auto mt-12 max-w-md rounded-3xl border border-pink-200 bg-white/90 p-8 shadow-lg backdrop-blur">
        <h1 className="text-center text-2xl font-bold text-bob-pink">
          Bags of Blessings
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Sign in with Google to view needs and share what you can bring.
        </p>
        {!ready && (
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            Set <code className="text-xs">VITE_GOOGLE_CLIENT_ID</code> and{" "}
            <code className="text-xs">VITE_API_URL</code> in{" "}
            <code className="text-xs">web/.env</code>.
          </p>
        )}
        {ready && import.meta.env.DEV && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-950">
            <span className="font-semibold">Google “no registered origin”?</span> In{" "}
            <a
              className="text-bob-blue underline"
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
            >
              Google Cloud → Credentials
            </a>
            , open your <strong>Web application</strong> OAuth client (this ID) and add{" "}
            <strong>Authorized JavaScript origins</strong> — paste exactly:
            <br />
            <code className="mt-1 block break-all rounded bg-white/80 px-2 py-1 font-mono text-[11px] text-gray-900">
              {typeof window !== "undefined" ? window.location.origin : ""}
            </code>
            <span className="mt-1 block text-[11px] text-amber-900/90">
              Register <strong>both</strong>{" "}
              <code className="text-xs">http://localhost:5173</code> and{" "}
              <code className="text-xs">http://127.0.0.1:5173</code> if you switch URLs. Use Chrome/Edge
              at that URL — Cursor’s embedded / Simple Browser often uses an origin Google does not
              allow.
            </span>
          </p>
        )}
        {apiAuthError && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <span className="font-semibold">Server sign-in error:</span> {apiAuthError}
            <span className="mt-1 block text-xs text-red-800/90">
              If this says <code className="text-[11px]">Missing bearer token</code>, redeploy the API (
              <code className="text-[11px]">sam deploy</code>) so <code className="text-[11px]">/auth/google</code>{" "}
              is live. Other messages usually mean Lambda{" "}
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
                const data = JSON.parse(raw) as { accessToken: string };
                setTokens(data.accessToken, "");
                nav(from, { replace: true });
              }}
              onError={() => alert("Google sign-in was cancelled or failed.")}
              useOneTap={false}
              theme="filled_blue"
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
