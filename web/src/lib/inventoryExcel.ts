import {
  inventoryWebStatusLabel,
  itemDisplayNameForExport,
} from "./inventoryCardStyle";

/** Labels aligned with “Bags of Blessings” / Inventory Tracker workbook + app fields. */

export type InventoryExportRow = {
  id: string;
  name: string;
  category: string;
  price?: number;
  targetQty: number;
  onHand: number;
  projected: number;
  notes?: string;
};

export function exportStatusLabel(row: {
  targetQty: number;
  onHand: number;
  projected: number;
}): string {
  const target = row.targetQty;
  const committed = row.onHand + row.projected;
  if (target <= 0) {
    if (row.onHand > 0) return "In stock";
    return row.onHand === 0 && row.projected === 0 ? "Out of stock" : "In stock";
  }
  const gap = Math.max(0, target - committed);
  if (gap === 0) return "FULL";
  const shortRatio = gap / target;
  if (shortRatio >= 0.85) return "Running low";
  if (row.onHand === 0 && row.projected === 0) return "Out of stock";
  return "In stock";
}

const HEADERS = [
  "Item ID",
  "Item name",
  "Type",
  "Price",
  "Stock",
  "Status",
  "Notes",
  "Target",
  "Projected",
] as const;

/** Same column order as export, tab-separated (paste into Excel / Sheets). */
export function inventoryToTsv(rows: InventoryExportRow[]): string {
  const lines: string[] = [
    HEADERS.join("\t"),
    ...rows.map((it) =>
      [
        it.id,
        itemDisplayNameForExport(it.name, it.category).replace(/\t/g, " "),
        it.category.replace(/\t/g, " "),
        it.price != null && Number.isFinite(it.price) ? String(it.price) : "",
        String(it.onHand),
        inventoryWebStatusLabel(it.onHand).replace(/\t/g, " "),
        (it.notes ?? "").replace(/\t/g, " ").replace(/\r?\n/g, " "),
        String(it.targetQty),
        String(it.projected),
      ].join("\t"),
    ),
  ];
  return lines.join("\n");
}

export async function buildInventoryXlsxBuffer(
  rows: InventoryExportRow[],
): Promise<Uint8Array> {
  const { buildStyledInventoryXlsxBuffer } = await import(
    "./inventoryExcelStyledExport"
  );
  return buildStyledInventoryXlsxBuffer(rows);
}
