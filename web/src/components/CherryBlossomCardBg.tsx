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
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-[inherit] bg-right bg-no-repeat max-md:bg-[length:64%_auto] md:bg-[length:42%_auto]"
      style={{
        backgroundImage: `url(${sakuraCamoUrl})`,
        opacity: layerOpacity,
      }}
      aria-hidden
    />
  );
}
