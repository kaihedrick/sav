import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
  const liveSheet = useQuery({
    queryKey: ["inventory-sheet"],
    queryFn: () => apiJson<{ url: string | null }>("/inventory/sheet"),
    enabled: showNav,
  });

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
          <header className="sticky top-0 z-20 border-b border-pink-400/35 bg-zinc-950/80 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md shadow-md shadow-black/25">
            <div className="mx-auto flex max-w-3xl flex-col gap-2 px-safe py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-3 md:max-w-5xl">
              <Link
                to="/"
                className="min-w-0 shrink font-semibold text-bob-pink transition-colors hover:text-pink-300 sm:max-w-[55%]"
              >
                <span className="block truncate text-sm sm:text-base">
                  Bags of Blessings
                </span>
              </Link>
              <nav
                className="flex flex-shrink-0 flex-wrap items-center justify-end gap-x-0.5 gap-y-1 sm:gap-x-1.5 sm:gap-y-0"
                aria-label="Main"
              >
                <Link
                  to="/"
                  className="inline-flex h-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[15px] text-white/90 transition-colors hover:bg-pink-500/20 hover:text-white sm:h-11 sm:min-h-0 sm:min-w-0 sm:p-2.5 sm:text-base"
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
                    className="inline-flex h-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[15px] text-white/90 transition-colors hover:bg-pink-500/20 hover:text-white sm:h-11 sm:min-h-0 sm:min-w-0 sm:p-2.5 sm:text-base"
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
                      className="inline-flex h-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[15px] text-white/90 transition-colors hover:bg-pink-500/20 hover:text-white sm:h-11 sm:min-h-0 sm:min-w-0 sm:p-2.5 sm:text-base"
                      aria-label="Admin"
                      title="Admin"
                    >
                      <i className="fa-solid fa-screwdriver-wrench" aria-hidden />
                    </Link>
                    <Link
                      to="/admin/requests"
                      className="inline-flex h-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[15px] text-white/90 transition-colors hover:bg-pink-500/20 hover:text-white sm:h-11 sm:min-h-0 sm:min-w-0 sm:p-2.5 sm:text-base"
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
                  onClick={() => {
                    clearTokens();
                    nav("/login");
                  }}
                >
                  <i className="fa-solid fa-right-from-bracket" aria-hidden />
                </button>
              </nav>
            </div>
          </header>
        )}
        <main className="mx-auto w-full max-w-3xl px-safe py-6 text-pink-50 md:max-w-5xl">
          {children}
        </main>
      </div>
    </>
  );
}
