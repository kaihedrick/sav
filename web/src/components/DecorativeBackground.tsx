import { useId, useMemo } from "react";
import { useReducedMotion } from "motion/react";

/**
 * SVG Repo assets — floating 3D-tilt layer + static grid when reduced motion.
 */
const PAPER_BAG_PATH_D =
  "M140.374,211.969c-0.021,0-0.042-0.001-0.063-0.001H31.043c-0.853,0-1.666-0.363-2.234-0.998c-0.569-0.636-0.841-1.483-0.748-2.331L46.728,39.338c0.167-1.521,1.452-2.671,2.982-2.671h26.191V24.75C75.901,11.103,87.004,0,100.651,0c2.276,0,4.482,0.309,6.577,0.887C109.323,0.309,111.529,0,113.805,0c13.647,0,24.75,11.103,24.75,24.75v11.917h27.846c1.558,0,2.855,1.191,2.989,2.743l14.523,169.292c0.071,0.799-0.177,1.624-0.754,2.268c-0.529,0.59-1.238,0.922-1.97,0.986c0,0.001-0.005,0.001-0.009,0.001c-0.004-0.001-0.006-0.001-0.01,0.001c-0.003,0-0.006,0-0.009,0c-0.003,0.001-0.005,0-0.01,0.001c-0.001,0.001-0.005,0-0.009,0.001c-0.004-0.001-0.008-0.002-0.01,0.001c-0.004,0-0.004,0-0.01,0c-0.003,0-0.003,0.002-0.01,0.001c-0.004-0.001-0.005-0.001-0.01,0c-0.004,0.001-0.007,0-0.01,0.001c-0.006-0.001-0.009,0.001-0.01,0.001c-0.004,0-0.007,0-0.011,0c-0.004,0.001-0.007,0.001-0.011,0.001c-0.001,0-0.001,0-0.002,0c-0.051,0.002-0.102,0.003-0.152,0.003h-40.474C140.415,211.968,140.395,211.969,140.374,211.969z M145.267,205.968h27.816l-19.11-17.128L145.267,205.968z M34.392,205.968h103.201l8.328-111.096c0.002-0.039,0.005-0.077,0.009-0.116l3.904-52.089h-24.434V52.5c0,1.657-1.343,3-3,3s-3-1.343-3-3v-9.833h-37.5V52.5c0,1.657-1.343,3-3,3s-3-1.343-3-3v-9.833H52.397L34.392,205.968z M156.006,182.604l21.283,19.075L163.647,42.667h-7.796l-3.93,52.42L156.006,182.604z M148.22,144.47l-3.732,49.79l5.546-10.912L148.22,144.47z M125.401,36.667h7.154V24.75c0-9.206-6.67-16.884-15.431-18.456c5.076,4.536,8.276,11.129,8.276,18.456V36.667z M95.056,36.667h24.345V24.75c0-8.025-5.069-14.89-12.173-17.56c-7.104,2.67-12.172,9.534-12.172,17.56V36.667z M81.901,36.667h7.155V24.75c0-7.327,3.2-13.92,8.276-18.456c-8.761,1.572-15.431,9.25-15.431,18.456V36.667z";

const CROSS_PATH_D =
  "M446.503,141.994H320.017V0H192.015v141.994H49.497v128.01h142.518V512h128.002V269.996l142.486,0.008v-128.01H446.503z M430.503,237.996H288.017V480h-64.001V237.996H81.497v-64.001h142.518V31.992h64.001v142.002h142.486V237.996z";

const FLOWER_HEART_PATH_D =
  "M23.734 16.952c-0.895-1.546-3.371-1.611-5.885-0.157-0.209 0.12-0.405 0.253-0.6 0.387v-0.701l5.693-6.317c1.203-1.098 1.954-2.672 1.954-4.422 0-0.487-0.058-0.96-0.168-1.413l0.008 0.041c-0.521-1.884-1.975-3.338-3.821-3.849l-0.038-0.009c-0.418-0.109-0.898-0.172-1.393-0.172-1.345 0-2.582 0.464-3.559 1.241l0.012-0.009c-0.89-0.671-2.014-1.074-3.232-1.074-1.52 0-2.893 0.628-3.874 1.639l-0.001 0.001c-0.97 0.954-1.587 2.264-1.638 3.718l-0 0.010c-0.001 0.029-0.001 0.063-0.001 0.097 0 1.627 0.686 3.093 1.785 4.125l0.003 0.003 5.771 6.392v3.772c-0.633-0.502-1.347-0.956-2.107-1.331l-0.070-0.031c-3.502-1.705-6.888-1.461-7.879 0.57-0.153 0.381-0.242 0.822-0.242 1.285 0 0.965 0.387 1.839 1.014 2.476l-0-0c0.983 1.171 2.197 2.114 3.576 2.766l0.064 0.027c1.292 0.673 2.813 1.088 4.427 1.14l0.017 0h0.008c0.007 0 0.016 0 0.024 0 0.414 0 0.818-0.044 1.206-0.128l-0.037 0.007v2.967c0 0.69 0.56 1.25 1.25 1.25s1.25-0.56 1.25-1.25v0-6.848c0.084 0.005 0.159 0.024 0.245 0.024 1.278-0.052 2.456-0.435 3.464-1.064l-0.030 0.017c2.516-1.453 3.695-3.631 2.807-5.175zM14.736 24.35c-0.049 0.1-0.4 0.305-1.18 0.305h-0.005c-1.233-0.055-2.378-0.377-3.398-0.908l0.045 0.021c-1.092-0.512-2.014-1.218-2.758-2.081l-0.009-0.011c-0.483-0.615-0.539-1.021-0.49-1.121 0.075-0.154 0.495-0.307 1.175-0.307 1.236 0.047 2.387 0.37 3.405 0.909l-0.043-0.021c1.092 0.512 2.014 1.218 2.758 2.081l0.009 0.011c0.483 0.615 0.539 1.021 0.49 1.121zM10.599 3.904c0.533-0.548 1.273-0.893 2.094-0.905l0.002-0c0.94 0.033 1.776 0.448 2.363 1.095l0.002 0.003c0.226 0.226 0.539 0.366 0.884 0.366s0.658-0.14 0.884-0.366v0c0.65-0.764 1.612-1.246 2.687-1.246 0.254 0 0.502 0.027 0.74 0.078l-0.023-0.004c1.017 0.289 1.802 1.074 2.085 2.071l0.005 0.021c0.047 0.216 0.074 0.465 0.074 0.719 0 1.074-0.482 2.035-1.241 2.679l-0.005 0.004-0.043 0.047-5.108 5.668-5.208-5.767c-0.673-0.553-1.1-1.385-1.1-2.317 0-0.841 0.347-1.602 0.907-2.145l0.001-0.001zM19.68 19.965c-0.669 0.44-1.49 0.701-2.372 0.701-0.002 0-0.004 0-0.006 0h0c0.429-0.731 1.040-1.313 1.773-1.695l0.024-0.012c0.673-0.434 1.494-0.695 2.375-0.703h0.002c-0.429 0.731-1.040 1.314-1.773 1.697l-0.024 0.012z";

const BAG_VIEWBOX = 211.969;
const CROSS_VIEWBOX = 512;
const FLOWER_VIEWBOX = 32;

const SCENE_BASE_WIDTH = 40;

type DecoKind = "bag" | "cross" | "flower";

const DECO_PALETTE = [
  "#ff4da6",
  "#ff8cc8",
  "#a8f0dc",
  "#6aa8ff",
  "#ffc8e8",
  "#e879f9",
] as const;

const KIND_CYCLE: DecoKind[] = [
  "bag",
  "cross",
  "bag",
  "cross",
  "bag",
  "cross",
  "cross",
  "bag",
  "cross",
  "bag",
  "cross",
  "flower",
];

function strokeWidthForKind(kind: DecoKind): number {
  switch (kind) {
    case "cross":
      return 3.2;
    case "flower":
      return 1.1;
    default:
      return 2.7;
  }
}

function assetForKind(kind: DecoKind): { d: string; view: number } {
  switch (kind) {
    case "cross":
      return { d: CROSS_PATH_D, view: CROSS_VIEWBOX };
    case "flower":
      return { d: FLOWER_HEART_PATH_D, view: FLOWER_VIEWBOX };
    default:
      return { d: PAPER_BAG_PATH_D, view: BAG_VIEWBOX };
  }
}

function depthOffset(kind: DecoKind): [number, number] {
  switch (kind) {
    case "cross":
      return [7, 10];
    case "flower":
      return [0.9, 1.2];
    default:
      return [4, 6];
  }
}

/** Deterministic 0..1 */
function rnd(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

type FloatingParticle = {
  id: number;
  leftPct: number;
  riseSec: number;
  delaySec: number;
  spinSec: number;
  sizePx: number;
  kind: DecoKind;
  paletteI: number;
  z: number;
};

const FLOATING_COUNT = 44;

function buildFloatingParticles(): FloatingParticle[] {
  return Array.from({ length: FLOATING_COUNT }, (_, i) => {
    let sizePx = 44 + rnd(i, 1) * 52;
    const kind = KIND_CYCLE[i % KIND_CYCLE.length];
    if (kind === "cross") sizePx *= 1.08;
    return {
      id: i,
      leftPct: 3 + rnd(i, 2) * 94,
      riseSec: 15 + rnd(i, 3) * 18,
      delaySec: -rnd(i, 4) * 28,
      spinSec: 4.2 + rnd(i, 5) * 6,
      sizePx,
      kind,
      paletteI: i % DECO_PALETTE.length,
      z: 1 + Math.floor(rnd(i, 6) * 18),
    };
  });
}

/* ---------- reduced motion: static centered grid ---------- */

type DecoItem = {
  kind: DecoKind;
  x: number;
  y: number;
  s: number;
  c: string;
  animSeed: number;
};

function buildCenteredDecorations(): DecoItem[] {
  const cx = 450;
  const cols = 9;
  const rows = 7;
  const stepX = 64;
  const stepY = 56;
  const out: DecoItem[] = [];
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ox = (c - (cols - 1) / 2) * stepX;
      const oy = (r - (rows - 1) / 2) * stepY;
      const t = idx + 1;
      const x = cx + ox + Math.sin(t * 0.9) * 14 + Math.cos(t * 0.55) * 10;
      const y = 300 + oy + Math.cos(t * 1.1) * 12 + Math.sin(t * 0.65) * 11;
      const kind = KIND_CYCLE[idx % KIND_CYCLE.length];
      let s = 0.48 + (idx % 11) * 0.028 + ((r + c) % 4) * 0.018;
      if (kind === "cross") s *= 1.14;
      const color = DECO_PALETTE[idx % DECO_PALETTE.length];
      out.push({ kind, x, y, s, c: color, animSeed: idx });
      idx++;
    }
  }
  return out;
}

const PAINT_ORDER: Record<DecoKind, number> = {
  bag: 0,
  flower: 1,
  cross: 2,
};

const STATIC_DECORATIONS = buildCenteredDecorations().sort(
  (a, b) => PAINT_ORDER[a.kind] - PAINT_ORDER[b.kind],
);

function StaticDecorativePath({
  kind,
  pathD,
  viewBoxSize,
  x,
  y,
  scale,
  color,
}: {
  kind: DecoKind;
  pathD: string;
  viewBoxSize: number;
  x: number;
  y: number;
  scale: number;
  color: string;
}) {
  const s = scale * (SCENE_BASE_WIDTH / viewBoxSize);
  const t = `translate(${x},${y}) scale(${s})`;
  return (
    <g transform={t}>
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidthForKind(kind)}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="nonScalingStroke"
        opacity={0.48}
      />
    </g>
  );
}

function FloatingShape({ p }: { p: FloatingParticle }) {
  const reactId = useId().replace(/:/g, "");
  const gradId = `deco-grad-${reactId}`;
  const { d, view } = assetForKind(p.kind);
  const sw = strokeWidthForKind(p.kind);
  const [dx, dy] = depthOffset(p.kind);
  const c1 = DECO_PALETTE[p.paletteI];
  const c2 = DECO_PALETTE[(p.paletteI + 2) % DECO_PALETTE.length];

  const vb = `0 0 ${view} ${view}`;

  return (
    <div
      className="deco-rise-anim absolute"
      style={{
        left: `${p.leftPct}%`,
        bottom: "-14vh",
        width: p.sizePx,
        height: p.sizePx,
        marginLeft: -p.sizePx / 2,
        animationDuration: `${p.riseSec}s`,
        animationDelay: `${p.delaySec}s`,
        zIndex: p.z,
      }}
    >
      <div className="h-full w-full [transform-style:preserve-3d]">
        <div
          className="deco-tilt-anim h-full w-full"
          style={{ animationDuration: `${p.spinSec}s` }}
        >
          <svg
            viewBox={vb}
            className="h-full w-full overflow-visible drop-shadow-[0_0_10px_rgba(255,100,180,0.25)]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient
                id={gradId}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor={c1} />
                <stop offset="100%" stopColor={c2} />
              </linearGradient>
            </defs>
            <g transform={`translate(${dx},${dy})`}>
              <path
                d={d}
                fill="none"
                stroke="rgba(0,0,0,0.5)"
                strokeWidth={sw + 0.35}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="nonScalingStroke"
              />
            </g>
            <path
              d={d}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={sw}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="nonScalingStroke"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

export function DecorativeBackground() {
  const reduced = useReducedMotion() ?? false;
  const particles = useMemo(() => buildFloatingParticles(), []);

  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-gradient-to-b from-black via-[#10060d] to-[#030102]"
      aria-hidden
    >
      {reduced ? (
        <svg
          className="mx-auto block h-full w-full max-w-[1200px]"
          viewBox="0 0 900 600"
          preserveAspectRatio="xMidYMid slice"
        >
          {STATIC_DECORATIONS.map((item) => {
            const { d, view } = assetForKind(item.kind);
            return (
              <StaticDecorativePath
                key={`static-${item.animSeed}-${item.kind}`}
                kind={item.kind}
                pathD={d}
                viewBoxSize={view}
                x={item.x}
                y={item.y}
                scale={item.s}
                color={item.c}
              />
            );
          })}
        </svg>
      ) : (
        <div className="perspective-deco absolute inset-0">
          {particles.map((p) => (
            <FloatingShape key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
