/**
 * Static cream + soft organic blobs (no animation). Replaces floating / parallax layers.
 */
export function StaticPageBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bob-cream"
      aria-hidden
    >
      <div className="absolute -left-[20%] top-[8%] h-[min(80vw,520px)] w-[min(80vw,520px)] rounded-full bg-bob-mist/70 blur-3xl" />
      <div className="absolute -right-[18%] top-[32%] h-[min(72vw,460px)] w-[min(72vw,460px)] rounded-full bg-bob-peach/55 blur-3xl" />
      <div className="absolute bottom-[8%] left-[12%] h-[min(58vw,400px)] w-[min(58vw,400px)] rounded-full bg-bob-mist/55 blur-3xl" />
      <div className="absolute bottom-[20%] right-[8%] h-[min(45vw,320px)] w-[min(45vw,320px)] rounded-full bg-bob-rose/25 blur-3xl" />
    </div>
  );
}
