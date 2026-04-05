import { Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);

  const liveSheet = useQuery({
    queryKey: ["inventory-sheet"],
    queryFn: () =>
      apiJson<{ url: string | null; syncEnabled?: boolean }>("/inventory/sheet"),
    enabled: showNav,
  });

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  /** Safari mobile: lock documentElement height while the drawer is open (WebWise / apple.com-style burger fix). */
  useEffect(() => {
    if (!menuOpen) return;
    const el = document.documentElement;
    const prevOverflow = el.style.overflow;
    const prevHeight = el.style.height;
    el.style.overflow = "hidden";
    el.style.height = "100svh";
    return () => {
      el.style.overflow = prevOverflow;
      el.style.height = prevHeight;
    };
  }, [menuOpen]);

  const iconNavBtn =
    "inline-flex h-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-bob-wood transition-colors hover:bg-bob-mist/80 sm:h-11 sm:min-h-0 sm:min-w-0 sm:p-2.5 sm:text-base";

  function signOut() {
    clearTokens();
    setMenuOpen(false);
    nav("/login");
  }

  return (
    <>
      <StaticPageBackground />
      <div className="layout-status-bar-fill" aria-hidden />
      <div
        className={`relative z-10 flex min-h-[100vh] min-h-[100svh] min-h-[100dvh] min-h-[-webkit-fill-available] flex-col ${
          showNav
            ? "pb-[calc(6rem+env(safe-area-inset-bottom,0px))]"
            : "pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]"
        }`}
      >
        {showNav && (
          <>
            {menuOpen ? (
              <button
                type="button"
                className="fixed-cover-viewport z-[19] bg-bob-ink/50 backdrop-blur-sm sm:hidden"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              />
            ) : null}
            <header className="layout-header-chrome sticky top-0 z-20 overflow-visible border-b border-bob-mist/60 bg-bob-cream/45 pt-[env(safe-area-inset-top,0px)] shadow-[0_8px_32px_-12px_rgba(93,64,55,0.14)] backdrop-blur-xl backdrop-saturate-150">
              <div className="relative mx-auto max-w-3xl overflow-visible px-safe py-3 md:max-w-5xl">
                <Link
                  to="/"
                  className="wordmark-title absolute left-1/2 top-1/2 z-10 inline-block w-max max-w-[calc(100%-5.5rem)] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center text-[clamp(1.65rem,6vw,3.1rem)] font-semibold leading-none tracking-wide text-bob-wood antialiased transition-colors hover:text-bob-ink max-sm:tracking-wide sm:tracking-wide"
                  onClick={() => setMenuOpen(false)}
                >
                  Bags of Blessings
                </Link>

                <div className="relative z-20 flex min-h-[44px] w-full items-center justify-end gap-1.5 font-sans">
                  <button
                    type="button"
                    className={`inline-flex h-10 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-bob-wood transition-colors hover:bg-bob-mist/80 sm:hidden ${
                      menuOpen ? "bg-bob-cream shadow-md ring-2 ring-bob-gold/40" : ""
                    }`}
                    aria-expanded={menuOpen}
                    aria-controls="mobile-nav-menu"
                    aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
                    onClick={() => setMenuOpen((o) => !o)}
                  >
                    <i
                      className={`fa-solid ${menuOpen ? "fa-xmark" : "fa-bars"} text-lg`}
                      aria-hidden
                    />
                  </button>

                  <nav
                    className="hidden flex-shrink-0 items-center gap-x-1.5 sm:flex"
                    aria-label="Main"
                  >
                    <Link to="/" className={iconNavBtn} aria-label="Home" title="Home">
                      <i className="fa-solid fa-house" aria-hidden />
                    </Link>
                    {liveSheet.data?.url ? (
                      <a
                        href={liveSheet.data.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={iconNavBtn}
                        aria-label="Shared inventory sheet"
                        title="Shared sheet"
                      >
                        <i className="fa-solid fa-table" aria-hidden />
                      </a>
                    ) : null}
                    {isAdmin && (
                      <>
                        <Link
                          to="/admin"
                          className={iconNavBtn}
                          aria-label="Admin"
                          title="Admin"
                        >
                          <i className="fa-solid fa-screwdriver-wrench" aria-hidden />
                        </Link>
                        <Link
                          to="/admin/requests"
                          className={iconNavBtn}
                          aria-label="Inbox"
                          title="Inbox"
                        >
                          <i className="fa-solid fa-inbox" aria-hidden />
                        </Link>
                      </>
                    )}
                    <button
                      type="button"
                      className="inline-flex h-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-bob-muted transition-colors hover:bg-bob-mist/80 sm:h-11 sm:min-h-0 sm:min-w-0 sm:p-2.5 sm:text-base"
                      aria-label="Sign out"
                      title="Sign out"
                      onClick={signOut}
                    >
                      <i className="fa-solid fa-right-from-bracket" aria-hidden />
                    </button>
                  </nav>
                </div>

                <div
                  id="mobile-nav-menu"
                  className={`absolute left-2 right-2 top-full z-30 mt-1.5 overflow-hidden rounded-2xl border-2 border-bob-wood/12 bg-bob-cream shadow-2xl shadow-bob-wood/18 ring-1 ring-bob-mist/50 ${
                    menuOpen ? "block sm:hidden" : "hidden"
                  }`}
                  role="navigation"
                  aria-label="Main"
                >
                  <div className="border-b border-bob-mist/80 bg-bob-peach/30 px-4 py-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-bob-wood/90">
                      Menu
                    </p>
                  </div>
                  <div className="flex max-h-[min(65svh,calc(100svh-6rem))] flex-col overflow-y-auto px-2 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    <Link
                      to="/"
                      className="flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-3 text-base font-semibold text-bob-ink transition-colors active:bg-bob-mist/70 hover:bg-bob-cream"
                      onClick={() => setMenuOpen(false)}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bob-gold/15 text-bob-gold">
                        <i className="fa-solid fa-house" aria-hidden />
                      </span>
                      Home
                    </Link>
                    {liveSheet.data?.url ? (
                      <a
                        href={liveSheet.data.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-3 text-base font-semibold text-bob-ink transition-colors active:bg-bob-mist/70 hover:bg-bob-cream"
                        onClick={() => setMenuOpen(false)}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bob-gold/15 text-bob-gold">
                          <i className="fa-solid fa-table" aria-hidden />
                        </span>
                        Shared sheet
                      </a>
                    ) : null}
                    {isAdmin && (
                      <>
                        <Link
                          to="/admin"
                          className="flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-3 text-base font-semibold text-bob-ink transition-colors active:bg-bob-mist/70 hover:bg-bob-cream"
                          onClick={() => setMenuOpen(false)}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bob-gold/15 text-bob-gold">
                            <i className="fa-solid fa-screwdriver-wrench" aria-hidden />
                          </span>
                          Admin
                        </Link>
                        <Link
                          to="/admin/requests"
                          className="flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-3 text-base font-semibold text-bob-ink transition-colors active:bg-bob-mist/70 hover:bg-bob-cream"
                          onClick={() => setMenuOpen(false)}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bob-gold/15 text-bob-gold">
                            <i className="fa-solid fa-inbox" aria-hidden />
                          </span>
                          Request inbox
                        </Link>
                      </>
                    )}
                    <div className="my-1 border-t border-bob-mist" />
                    <button
                      type="button"
                      className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base font-semibold text-bob-wood transition-colors active:bg-rose-50 hover:bg-rose-50/80"
                      onClick={signOut}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                        <i className="fa-solid fa-right-from-bracket" aria-hidden />
                      </span>
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            </header>
          </>
        )}
        <main className="mx-auto w-full max-w-3xl px-safe py-6 text-bob-ink md:max-w-5xl">
          {children}
        </main>
      </div>
    </>
  );
}
