import { useEffect, useState } from "react";
import patternUrl from "../assets/Untitled-1.png?url";

type CherryBlossomCardBgProps = {
  density?: "card" | "panel";
};

/** Large repeat tile — motif reads big; same value everywhere so tiles line up */
const TILE_WIDTH = "min(960px, 92vw)";

const MQ_NARROW = "(max-width: 768px)";

/**
 * Seamless PNG: `fixed` + same size/position = one continuous field across every card.
 * Vertical drift uses `var(--cherry-scroll-y)` from {@link CherryBlossomScrollBridge}.
 */
export function CherryBlossomCardBg({ density = "card" }: CherryBlossomCardBgProps) {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MQ_NARROW);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const filter = narrow
    ? "saturate(1.2) blur(1.25px)"
    : "saturate(1.2) blur(3px)";

  return (
    <div
      data-density={density}
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-[inherit]"
      style={{
        backgroundImage: `url(${patternUrl})`,
        backgroundRepeat: "repeat",
        backgroundSize: `${TILE_WIDTH} auto`,
        backgroundAttachment: "fixed",
        backgroundPosition: "center var(--cherry-scroll-y, 0px)",
        opacity: 0.5,
        mixBlendMode: "soft-light",
        filter,
      }}
      aria-hidden
    />
  );
}
