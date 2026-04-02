import { useEffect } from "react";

/** Desktop: 1:1 with scroll. Narrow viewports (e.g. iPhone): slower so the pattern doesn’t race */
function parallaxFactor(): number {
  if (typeof window === "undefined") return 1;
  return window.innerWidth <= 768 ? 0.32 : 1;
}

/**
 * One passive listener updates `--cherry-scroll-y` for all {@link CherryBlossomCardBg} layers.
 */
export function CherryBlossomScrollBridge() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const y = reduce ? 0 : -window.scrollY * parallaxFactor();
      root.style.setProperty("--cherry-scroll-y", `${y}px`);
    };
    apply();
    window.addEventListener("scroll", apply, { passive: true });
    window.addEventListener("resize", apply, { passive: true });
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", apply);
    return () => {
      window.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      mq.removeEventListener("change", apply);
    };
  }, []);
  return null;
}
