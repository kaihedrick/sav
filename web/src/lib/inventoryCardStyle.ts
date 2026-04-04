/** On-hand counts at or below this (but &gt; 0) show as “low” (yellow). */
const LOW_STOCK_THRESHOLD = 10;

export type StockLevel = "out" | "low" | "ok";

export function stockLevelFromOnHand(onHand: number): StockLevel {
  if (onHand <= 0) return "out";
  if (onHand <= LOW_STOCK_THRESHOLD) return "low";
  return "ok";
}

export function stockStatusClasses(level: StockLevel): {
  label: string;
  textClass: string;
  /** Status line on dusty-rose card (`bg-bob-card`). */
  textClassOnCard: string;
} {
  switch (level) {
    case "out":
      return {
        label: "Out of stock",
        textClass: "font-semibold text-red-600",
        textClassOnCard: "font-semibold text-red-700",
      };
    case "low":
      return {
        label: "Low stock",
        textClass: "font-semibold text-amber-600",
        textClassOnCard: "font-semibold text-amber-700",
      };
    default:
      return {
        label: "In stock",
        textClass: "font-semibold text-emerald-700",
        textClassOnCard: "font-semibold text-emerald-800",
      };
  }
}

/** Same status line as the home “What we need” cards (on-hand only). */
export function inventoryWebStatusLabel(onHand: number): string {
  return stockStatusClasses(stockLevelFromOnHand(onHand)).label;
}

/** Item name with leading emoji, matching the web list. */
export function itemDisplayNameForExport(name: string, category: string): string {
  return `${itemEmoji(name, category)} ${name}`;
}

/** Solid fills for Excel that mirror web red / amber / green status semantics. */
export function stockExcelTagStyle(onHand: number): {
  label: string;
  fillArgb: string;
  fontArgb: string;
} {
  const level = stockLevelFromOnHand(onHand);
  switch (level) {
    case "out":
      return {
        label: "Out of stock",
        fillArgb: "FFFEE2E2",
        fontArgb: "FFDC2626",
      };
    case "low":
      return {
        label: "Low stock",
        fillArgb: "FFFEF9C3",
        fontArgb: "FFD97706",
      };
    default:
      return {
        label: "In stock",
        fillArgb: "FFD1FAE5",
        fontArgb: "FF047857",
      };
  }
}

const CATEGORY_PALETTE = [
  {
    borderL: "border-l-bob-magenta",
    ring: "ring-bob-rose/50",
    panelBg: "bg-gradient-to-br from-bob-peach/95 to-white/95",
    pill: "bg-white/90 text-bob-ink border border-bob-mist",
    pillGlass:
      "border border-bob-wood/25 bg-white/75 text-bob-ink shadow-sm",
  },
  {
    borderL: "border-l-violet-600",
    ring: "ring-violet-200/60",
    panelBg: "bg-gradient-to-br from-violet-50/95 to-white/95",
    pill: "bg-white/90 text-bob-ink border border-bob-mist",
    pillGlass: "border border-violet-300/80 bg-white/75 text-bob-ink shadow-sm",
  },
  {
    borderL: "border-l-bob-sky",
    ring: "ring-sky-200/60",
    panelBg: "bg-gradient-to-br from-sky-50/95 to-white/95",
    pill: "bg-white/90 text-bob-ink border border-bob-mist",
    pillGlass: "border border-sky-300/80 bg-white/75 text-bob-ink shadow-sm",
  },
  {
    borderL: "border-l-amber-600",
    ring: "ring-amber-200/60",
    panelBg: "bg-gradient-to-br from-amber-50/95 to-white/95",
    pill: "bg-white/90 text-bob-ink border border-bob-mist",
    pillGlass: "border border-amber-300/80 bg-white/75 text-bob-ink shadow-sm",
  },
  {
    borderL: "border-l-bob-leaf",
    ring: "ring-emerald-200/60",
    panelBg: "bg-gradient-to-br from-emerald-50/95 to-white/95",
    pill: "bg-white/90 text-bob-ink border border-bob-mist",
    pillGlass: "border border-emerald-300/80 bg-white/75 text-bob-ink shadow-sm",
  },
  {
    borderL: "border-l-bob-coral",
    ring: "ring-orange-200/60",
    panelBg: "bg-gradient-to-br from-orange-50/95 to-white/95",
    pill: "bg-white/90 text-bob-ink border border-bob-mist",
    pillGlass: "border border-orange-300/80 bg-white/75 text-bob-ink shadow-sm",
  },
] as const;

function hashCategory(s: string): number {
  const t = s.trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < t.length; i++) {
    h = (h * 31 + t.charCodeAt(i)) >>> 0;
  }
  return h;
}

function categoryPaletteIndex(category: string): number {
  const t = category.trim().toLowerCase();
  const hints: Record<string, number> = {
    drinks: 2,
    drink: 2,
    hydration: 2,
    water: 2,
    hygiene: 0,
    food: 3,
    snacks: 5,
    snack: 5,
    clothing: 1,
    clothes: 1,
    misc: 4,
    other: 4,
  };
  const fromHint = t ? hints[t] : undefined;
  return fromHint !== undefined
    ? fromHint % CATEGORY_PALETTE.length
    : hashCategory(t || "general") % CATEGORY_PALETTE.length;
}

/** Light cell fill + font (ARGB) aligned with `categoryAccent` palette order. */
const CATEGORY_EXCEL_TAG: { fillArgb: string; fontArgb: string }[] = [
  { fillArgb: "FFFCE7F3", fontArgb: "FF9D174D" },
  { fillArgb: "FFF3E8FF", fontArgb: "FF6B21A8" },
  { fillArgb: "FFE0F2FE", fontArgb: "FF0369A1" },
  { fillArgb: "FFFEF3C7", fontArgb: "FFB45309" },
  { fillArgb: "FFD1FAE5", fontArgb: "FF065F46" },
  { fillArgb: "FFFFEDD5", fontArgb: "FFC2410C" },
];

export function categoryExcelTagStyle(category: string): {
  fillArgb: string;
  fontArgb: string;
} {
  return CATEGORY_EXCEL_TAG[categoryPaletteIndex(category)]!;
}

/** Stable accent colors per category string. */
export function categoryAccent(category: string) {
  return CATEGORY_PALETTE[categoryPaletteIndex(category)]!;
}

/** Dusty-rose card shell + colored left edge (event-flyer palette). */
export function inventoryGlassCardClass(accent: (typeof CATEGORY_PALETTE)[number]): string {
  return `relative isolate cursor-pointer overflow-hidden rounded-2xl border border-bob-mist/90 border-l-4 ${accent.borderL} bg-bob-card p-4 pr-10 text-left shadow-md shadow-bob-wood/10 ring-1 ring-bob-mist/40 transition hover:ring-2 hover:ring-bob-gold/35`;
}

/** Emoji from item name + category (no extra dependencies). */
export function itemEmoji(name: string, category: string): string {
  const blob = `${name} ${category}`.toLowerCase();
  const rules: [RegExp, string][] = [
    [/water|gatorade|juice|drink|soda|hydration|beverage/, "💧"],
    [/soap|shampoo|toothbrush|toothpaste|hygiene|deodorant|lotion/, "🧴"],
    [/sock|shirt|pants|jacket|coat|glove|hat|scarf|clothing|cloth/, "👕"],
    [/blanket|towel/, "🛁"],
    [/can|soup|chicken|chilli|chili|corn|food|meal|bar|granola|cereal/, "🥫"],
    [/fruit|apple|banana/, "🍎"],
    [/bread|sandwich/, "🍞"],
    [/book|notebook|paper|pen|pencil/, "📚"],
    [/toy|game|doll|stuffed/, "🧸"],
    [/diaper|baby|infant/, "👶"],
    [/battery|flashlight|candle/, "🔦"],
    [/mask|bandage|first aid|medicine|vitamin/, "💊"],
    [/bag|tote|backpack/, "🎒"],
  ];
  for (const [pat, icon] of rules) {
    if (pat.test(blob)) return icon;
  }
  return "📦";
}
