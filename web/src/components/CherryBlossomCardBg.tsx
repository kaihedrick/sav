import { useCallback, useLayoutEffect, useRef, useState } from "react";
import patternUrl from "../assets/Untitled-1.png?url";
import { registerCherryPatternAlign } from "../lib/cherryPatternRegistry";

type CherryBlossomCardBgProps = {
  density?: "card" | "panel";
};

/** Large repeat tile — motif reads big; same value everywhere so tiles line up */
const TILE_WIDTH = "min(960px, 92vw)";

/**
 * Seamless PNG on cards: `scroll` attachment + document-Y offset so the repeat
 * lines up across cards (same idea as `fixed` + global parallax, without iOS jank).
 */
export function CherryBlossomCardBg({ density = "card" }: CherryBlossomCardBgProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [docY, setDocY] = useState(0);

  const measure = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const next = el.getBoundingClientRect().top + window.scrollY;
    setDocY((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
  }, []);

  useLayoutEffect(() => {
    measure();
    return registerCherryPatternAlign(measure);
  }, [measure]);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div
      ref={rootRef}
      data-density={density}
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-[inherit]"
      style={{
        backgroundImage: `url(${patternUrl})`,
        backgroundRepeat: "repeat",
        backgroundSize: `${TILE_WIDTH} auto`,
        backgroundAttachment: "scroll",
        backgroundPosition: `center ${-docY}px`,
        opacity: 0.5,
        mixBlendMode: "soft-light",
        filter: "saturate(1.2)",
        WebkitBackfaceVisibility: "hidden",
        backfaceVisibility: "hidden",
      }}
      aria-hidden
    />
  );
}
