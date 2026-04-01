import sakuraCamoUrl from "../assets/sakura-camo-layer.svg?url";

type CherryBlossomCardBgProps = {
  density?: "card" | "panel";
};

/**
 * Sakura camo background (`src/assets/sakura-camo-layer.svg`) — dense traced motif, tinted for zinc glass.
 */
export function CherryBlossomCardBg({ density = "card" }: CherryBlossomCardBgProps) {
  const soft = density === "panel";
  const layerOpacity = soft ? 0.45 : 0.55;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-[inherit] bg-no-repeat"
      style={{
        backgroundImage: `url(${sakuraCamoUrl})`,
        backgroundSize: "42% auto",
        backgroundPosition: "right center",
        opacity: layerOpacity,
      }}
      aria-hidden
    />
  );
}
