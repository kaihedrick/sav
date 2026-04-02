import patternUrl from "../assets/Untitled-1.png?url";

type CherryBlossomCardBgProps = {
  density?: "card" | "panel";
};

/** Large repeat tile — motif reads big; same value everywhere so tiles line up */
const TILE_WIDTH = "min(960px, 92vw)";

/**
 * Seamless PNG: `fixed` + same size/position = one continuous field across every card.
 * Vertical drift uses `var(--cherry-scroll-y)` from {@link CherryBlossomScrollBridge}.
 */
export function CherryBlossomCardBg({ density = "card" }: CherryBlossomCardBgProps) {
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
        opacity: 0.2,
        mixBlendMode: "soft-light",
        filter: "saturate(1.2) blur(3px)",
      }}
      aria-hidden
    />
  );
}
