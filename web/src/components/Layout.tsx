import { Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { StaticPageBackground } from "./StaticPageBackground";
import { clearTokens } from "../lib/tokens";
import { apiJson } from "../lib/api";

export function Layout({
  children,
  showNav = true,
  isAdmin = false,
}: {
  children: React.ReactNode;
  showNav?: boolean;
  isAdmin?: boolean;
}) {
  const nav = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const liveSheet = useQuery({
    queryKey: ["inventory-sheet"],
    queryFn: () =>
      apiJson<{ url: string | null; syncEnabled?: boolean }>("/inventory/sheet"),
    enabled: showNav,
  });

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  useEffect(() => {
    if (!moreOpen) return;
    const el = document.documentElement;
    const prevOverflow = el.style.overflow;
    const prevHeight = el.style.height;
    el.style.overflow = "hidden";
    el.style.height = "100svh";
    return () => {
      el.style.overflow = prevOverflow;
      el.style.height = prevHeight;
    };
  }, [moreOpen]);

  function signOut() {
    clearTokens();
    setMoreOpen(false);
    nav("/login");
  }

  const path = location.pathname;
  const sheetUrl = liveSheet.data?.url;

  return (
    <>
      <StaticPageBackground />
      <div className="layout-status-bar-fill" aria-hidden />
      <div
        className={`relative z-10 flex min-h-[100vh] min-h-[100svh] min-h-[100dvh] min-h-[-webkit-fill-available] flex-col ${
          showNav
            ? "pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))]"
            : "pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]"
        }`}
      >
        {showNav && (
          <header className="layout-header-chrome layout-chrome-glass sticky top-0 z-20 border-b border-bob-mist/60 pt-[env(safe-area-inset-top,0px)] shadow-[0_8px_32px_-12px_rgba(93,64,55,0.14)]">
            <div className="mx-auto flex min-h-[52px] max-w-3xl flex-col items-center justify-center px-safe py-2 sm:min-h-[60px] md:max-w-5xl">
              <Link
                to="/"
                className="wordmark-title inline-block max-w-full whitespace-nowrap text-center text-[clamp(1.65rem,6vw,2.75rem)] font-semibold leading-none tracking-wide text-bob-wood antialiased transition-colors hover:text-bob-ink"
              >
                Bags of Blessings
              </Link>
              <EventDateLine enabled={showNav} />
            </div>
          </header>
        )}
        <main className="mx-auto w-full max-w-3xl px-safe py-6 text-bob-ink md:max-w-5xl">
          {children}
        </main>
      </div>

      {showNav ? (
        <>
          {moreOpen ? (
            <button
              type="button"
              className="fixed-cover-viewport z-[24] bg-bob-ink/40 backdrop-blur-sm"
              aria-label="Close menu"
              onClick={() => setMoreOpen(false)}
            />
          ) : null}

          {moreOpen ? (
            <div
              id="more-nav-menu"
              className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-[25] mx-auto max-w-3xl overflow-hidden rounded-2xl border border-bob-mist/80 bg-bob-cream shadow-2xl shadow-bob-wood/20 md:max-w-5xl"
              role="menu"
              aria-label="More"
            >
              <div className="border-b border-bob-mist/80 bg-bob-peach/30 px-4 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-bob-wood/90">
                  More
                </p>
              </div>
              <div className="p-2">
                {sheetUrl ? (
                  <a
                    href={sheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-3 text-base font-semibold text-bob-ink hover:bg-bob-mist/60"
                    onClick={() => setMoreOpen(false)}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bob-gold/15 text-bob-gold">
                      <i className="fa-solid fa-table" aria-hidden />
                    </span>
                    Shared sheet
                  </a>
                ) : null}
                <button
                  type="button"
                  className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base font-semibold text-bob-wood hover:bg-rose-50/80"
                  onClick={signOut}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                    <i className="fa-solid fa-right-from-bracket" aria-hidden />
                  </span>
                  Sign out
                </button>
              </div>
            </div>
          ) : null}

          <nav
            className="layout-chrome-glass fixed bottom-0 left-0 right-0 z-30 border-t border-bob-mist/60 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_32px_-12px_rgba(93,64,55,0.14)]"
            aria-label="Main"
          >
            <div className="mx-auto flex max-w-3xl items-stretch px-1 md:max-w-5xl">
              <TabLink
                to="/"
                icon="fa-house"
                label="Home"
                active={path === "/"}
              />
              {isAdmin ? (
                <>
                  <TabLink
                    to="/admin"
                    icon="fa-boxes-stacked"
                    label="Catalog"
                    active={path === "/admin"}
                  />
                  <TabLink
                    to="/admin/requests"
                    icon="fa-inbox"
                    label="Inbox"
                    active={path.startsWith("/admin/requests")}
                  />
                </>
              ) : null}
              <button
                type="button"
                className={tabClass(moreOpen)}
                aria-expanded={moreOpen}
                aria-controls="more-nav-menu"
                aria-label="More"
                onClick={() => setMoreOpen((o) => !o)}
              >
                <i className="fa-solid fa-ellipsis text-xl" aria-hidden />
                <span>More</span>
              </button>
            </div>
          </nav>
        </>
      ) : null}
    </>
  );
}

function tabClass(active: boolean): string {
  return `flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[0.65rem] font-semibold tracking-wide ${
    active ? "text-bob-wood" : "text-bob-muted hover:text-bob-ink"
  }`;
}

function formatEventDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function EventDateLine({ enabled }: { enabled: boolean }) {
  const event = useQuery({
    queryKey: ["event"],
    queryFn: () => apiJson<{ eventDate: string | null }>("/event"),
    enabled,
  });
  const date = event.data?.eventDate;
  if (!date) return null;
  return (
    <p className="mt-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-bob-wood/75 sm:text-xs">
      Event · {formatEventDate(date)}
    </p>
  );
}

function TabLink({
  to,
  icon,
  label,
  active,
}: {
  to: string;
  icon: string;
  label: string;
  active: boolean;
}): ReactNode {
  return (
    <Link to={to} className={tabClass(active)} aria-current={active ? "page" : undefined}>
      <i className={`fa-solid ${icon} text-xl`} aria-hidden />
      <span>{label}</span>
    </Link>
  );
}
