/**
 * Mirrors web `inventoryCardStyle` for Google Sheets rows (emoji + on-hand status).
 * Keep thresholds and rules aligned with the SPA.
 */

const LOW_STOCK_THRESHOLD = 10;

export function stockLevelFromOnHand(onHand: number): "out" | "low" | "ok" {
  if (onHand <= 0) return "out";
  if (onHand <= LOW_STOCK_THRESHOLD) return "low";
  return "ok";
}

export function inventoryWebStatusLabel(onHand: number): string {
  switch (stockLevelFromOnHand(onHand)) {
    case "out":
      return "Out of stock";
    case "low":
      return "Low stock";
    default:
      return "In stock";
  }
}

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

export function itemDisplayNameForExport(name: string, category: string): string {
  return `${itemEmoji(name, category)} ${name}`;
}
