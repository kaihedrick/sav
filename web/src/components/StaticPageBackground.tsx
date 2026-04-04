import { lazy, Suspense, useEffect, useState } from "react";

const Silk = lazy(() =>
  import("./Silk").then((m) => ({ default: m.Silk })),
);

/**
 * Silk shader tint: warm greige in the flyer’s beige family (visible motion, not gray).
 * Pairs with bob-mist / bob-card.
 */
const SILK_COLOR = "#C9B8A8";

/**
 * Flyer-like ground: pale cream + sandy beige shapes + optional silk. Respects reduced motion.
 */
export function StaticPageBackground() {
  const [reduceMotion, setReduceMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 h-[100svh] min-h-[100vh] min-h-[100svh] min-h-[100dvh] min-h-[-webkit-fill-available] w-full bg-bob-cream"
      aria-hidden
    >
      {/* WebGL layer: own overflow visible so Canvas isn’t clipped; blobs use overflow-hidden below */}
      <div className="absolute inset-0 z-0 h-full min-h-[100%] w-full">
        {!reduceMotion ? (
          <div className="absolute inset-0 h-full min-h-full w-full opacity-[0.45]">
            <Suspense fallback={null}>
              <Silk
                speed={3.5}
                scale={1}
                color={SILK_COLOR}
                noiseIntensity={0.55}
                rotation={0}
                className="h-full min-h-full"
              />
            </Suspense>
          </div>
        ) : null}

      <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
        <div className="absolute inset-0 bg-bob-card/25" />

        <div className="absolute -left-[22%] top-[6%] h-[min(85vw,540px)] w-[min(85vw,540px)] rounded-full bg-bob-mist/50 blur-3xl" />
        <div className="absolute -right-[16%] top-[28%] h-[min(75vw,480px)] w-[min(75vw,480px)] rounded-full bg-bob-card/45 blur-3xl" />
        <div className="absolute bottom-[6%] left-[10%] h-[min(62vw,420px)] w-[min(62vw,420px)] rounded-full bg-bob-mist/35 blur-3xl" />
        <div className="absolute bottom-[18%] right-[6%] h-[min(48vw,340px)] w-[min(48vw,340px)] rounded-full bg-bob-peach/35 blur-3xl" />

        <div className="absolute inset-0 bg-gradient-to-br from-bob-cream/70 via-bob-cream/25 to-bob-mist/45" />
      </div>
    </div>
  );
}
