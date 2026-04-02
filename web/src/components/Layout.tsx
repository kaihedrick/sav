import { Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { DecorativeBackground } from "./DecorativeBackground";
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
    queryFn: () => apiJson<{ url: string | null }>("/inventory/sheet"),
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

  const iconNavBtn =
    "inline-flex h-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[15px] text-white/90 transition-colors hover:bg-pink-500/20 hover:text-white sm:h-11 sm:min-h-0 sm:min-w-0 sm:p-2.5 sm:text-base";

  function signOut() {
    clearTokens();
    setMenuOpen(false);
    nav("/login");
  }

  return (
    <>
      <DecorativeBackground />
      <div
        className={`relative z-10 flex min-h-[100dvh] min-h-[-webkit-fill-available] flex-col ${
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
                className="fixed inset-0 z-[19] bg-black/55 backdrop-blur-[2px] sm:hidden"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              />
            ) : null}
            <header className="layout-header-chrome sticky top-0 z-20 overflow-visible border-b border-pink-400/35 bg-zinc-950/80 pt-[env(safe-area-inset-top,0px)] shadow-md shadow-black/25 backdrop-blur-md">
              <div className="relative mx-auto max-w-3xl overflow-visible px-safe py-3 md:max-w-5xl">
                <Link
                  to="/"
                  className="wordmark-title absolute left-1/2 top-1/2 z-10 inline-block max-w-[min(calc(100%-5.5rem),22rem)] -translate-x-1/2 -translate-y-1/2 break-words text-balance text-center text-[clamp(1.55rem,5.75vw,2.45rem)] font-light leading-[1.12] tracking-[0.06em] text-pink-100 antialiased transition-colors hover:text-pink-50 sm:tracking-[0.07em]"
                  onClick={() => setMenuOpen(false)}
                >
                  Bags of Blessings
                </Link>

                <div className="relative z-20 flex min-h-[44px] w-full items-center justify-end gap-1.5 font-sans">
                  <button
                    type="button"
                    className="inline-flex h-10 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-pink-500/20 sm:hidden"
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
                  <Link
                    to="/"
                    className={iconNavBtn}
                    aria-label="Home"
                    title="Home"
                  >
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
                        <i
                          className="fa-solid fa-screwdriver-wrench"
                          aria-hidden
                        />
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
                    className="inline-flex h-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[15px] text-pink-200/85 transition-colors hover:bg-white/10 hover:text-white sm:h-11 sm:min-h-0 sm:min-w-0 sm:p-2.5 sm:text-base"
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
                  className={`absolute left-0 right-0 top-full z-30 border-b border-pink-400/35 bg-zinc-950/95 shadow-lg shadow-black/40 backdrop-blur-md ${
                    menuOpen ? "block sm:hidden" : "hidden"
                  }`}
                  role="navigation"
                  aria-label="Main"
                >
                  <div className="flex max-h-[min(70vh,calc(100dvh-5rem))] flex-col overflow-y-auto px-safe pb-[env(safe-area-inset-bottom,8px)] pt-1">
                    <Link
                      to="/"
                      className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-pink-50 transition-colors hover:bg-white/10"
                      onClick={() => setMenuOpen(false)}
                    >
                      <i className="fa-solid fa-house w-5 text-center text-pink-300/90" aria-hidden />
                      Home
                    </Link>
                    {liveSheet.data?.url ? (
                      <a
                        href={liveSheet.data.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-pink-50 transition-colors hover:bg-white/10"
                        onClick={() => setMenuOpen(false)}
                      >
                        <i className="fa-solid fa-table w-5 text-center text-pink-300/90" aria-hidden />
                        Shared sheet
                      </a>
                    ) : null}
                    {isAdmin && (
                      <>
                        <Link
                          to="/admin"
                          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-pink-50 transition-colors hover:bg-white/10"
                          onClick={() => setMenuOpen(false)}
                        >
                          <i
                            className="fa-solid fa-screwdriver-wrench w-5 text-center text-pink-300/90"
                            aria-hidden
                          />
                          Admin
                        </Link>
                        <Link
                          to="/admin/requests"
                          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-pink-50 transition-colors hover:bg-white/10"
                          onClick={() => setMenuOpen(false)}
                        >
                          <i className="fa-solid fa-inbox w-5 text-center text-pink-300/90" aria-hidden />
                          Request inbox
                        </Link>
                      </>
                    )}
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-pink-200/90 transition-colors hover:bg-white/10"
                      onClick={signOut}
                    >
                      <i className="fa-solid fa-right-from-bracket w-5 text-center" aria-hidden />
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            </header>
          </>
        )}
        <main className="mx-auto w-full max-w-3xl px-safe py-6 text-pink-50 md:max-w-5xl">
          {children}
        </main>
      </div>
    </>
  );
}
