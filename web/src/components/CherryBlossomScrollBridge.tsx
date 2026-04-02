import { useEffect } from "react";

/** 1 = background shifts 1px vertically for each 1px of page scroll */
const PARALLAX = 1;

/**
 * One passive listener updates `--cherry-scroll-y` for all {@link CherryBlossomCardBg} layers.
 */
export function CherryBlossomScrollBridge() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const y = reduce ? 0 : -window.scrollY * PARALLAX;
      root.style.setProperty("--cherry-scroll-y", `${y}px`);
    };
    apply();
    window.addEventListener("scroll", apply, { passive: true });
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", apply);
    return () => {
      window.removeEventListener("scroll", apply);
      mq.removeEventListener("change", apply);
    };
  }, []);
  return null;
}
