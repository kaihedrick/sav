import { useEffect } from "react";
import { notifyCherryPatternAlign } from "../lib/cherryPatternRegistry";

/**
 * Single rAF-throttled scroll/resize loop so all {@link CherryBlossomCardBg}
 * layers can recompute document-Y alignment (seamless repeat without `fixed`).
 */
export function CherryBlossomScrollBridge() {
  useEffect(() => {
    let rafId = 0;

    const schedule = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        notifyCherryPatternAlign();
      });
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);
  return null;
}
