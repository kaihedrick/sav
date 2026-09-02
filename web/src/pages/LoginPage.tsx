import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { Layout } from "../components/Layout";
import { GOOGLE_CLIENT_ID, API_URL } from "../lib/config";
import { getIdToken, setTokens, clearTokens } from "../lib/tokens";
import { isAppSessionToken } from "../lib/sessionJwt";
import loginLogo from "../assets/bags-of-blessings-login-logo.png";

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
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const googleOriginMismatch =
    origin.startsWith("http://localhost:") && origin !== "http://localhost:5173";

  return (
    <Layout showNav={false}>
      <div className="surface-glass-auth mx-auto mt-6 max-w-lg px-3 py-4 sm:px-4 sm:py-5">
        <h1 className="flex justify-center">
          <img
            src={loginLogo}
            alt="Bags of Blessings"
            className="-my-1 h-auto w-full max-w-[22rem] object-contain sm:max-w-[28rem]"
          />
        </h1>
        {!ready && (
          <p className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <i className="fa-solid fa-triangle-exclamation mt-0.5 text-amber-600" aria-hidden />
            <span>
              Set <code className="text-xs">VITE_API_URL</code> &{" "}
              <code className="text-xs">VITE_GOOGLE_CLIENT_ID</code> (env / Vercel), then rebuild.
            </span>
          </p>
        )}
        {googleOriginMismatch && (
          <p className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <i className="fa-solid fa-triangle-exclamation mt-0.5 text-amber-600" aria-hidden />
            <span>
              Google Sign-In will fail on this URL ({origin}). Open{" "}
              <a className="font-semibold underline" href="http://localhost:5173/login">
                http://localhost:5173
              </a>{" "}
              instead. A different port is a different origin.
            </span>
          </p>
        )}
        {apiAuthError && (
          <p className="mt-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
            <i className="fa-solid fa-circle-xmark mt-0.5 text-rose-600" aria-hidden />
            <span>{apiAuthError}</span>
          </p>
        )}
        {ready && (
          <div className="mt-3 flex justify-center">
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
              theme="outline"
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
