import { Link, useNavigate } from "react-router-dom";
import { DecorativeBackground } from "./DecorativeBackground";
import { clearTokens } from "../lib/tokens";

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
  return (
    <>
      <DecorativeBackground />
      <div className="relative z-0 min-h-screen pb-24">
        {showNav && (
          <header className="sticky top-0 z-20 border-b border-pink-200/60 bg-white/85 backdrop-blur-md">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 md:max-w-5xl">
              <Link
                to="/"
                className="font-semibold text-bob-pink hover:text-bob-blue"
              >
                Bags of Blessings
              </Link>
              <nav className="flex flex-wrap items-center justify-end gap-2 text-sm">
                <Link
                  to="/"
                  className="rounded-full px-3 py-1.5 text-gray-700 hover:bg-pink-100"
                >
                  Home
                </Link>
                {isAdmin && (
                  <>
                    <Link
                      to="/admin"
                      className="rounded-full px-3 py-1.5 text-gray-700 hover:bg-pink-100"
                    >
                      Admin
                    </Link>
                    <Link
                      to="/admin/requests"
                      className="rounded-full px-3 py-1.5 text-gray-700 hover:bg-pink-100"
                    >
                      Inbox
                    </Link>
                  </>
                )}
                <button
                  type="button"
                  className="rounded-full px-3 py-1.5 text-gray-500 hover:bg-gray-100"
                  onClick={() => {
                    clearTokens();
                    nav("/login");
                  }}
                >
                  Sign out
                </button>
              </nav>
            </div>
          </header>
        )}
        <main className="mx-auto max-w-3xl px-4 py-6 md:max-w-5xl">{children}</main>
      </div>
    </>
  );
}
