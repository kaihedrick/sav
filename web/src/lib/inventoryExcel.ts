import {
  inventoryWebStatusLabel,
  itemDisplayNameForExport,
} from "./inventoryCardStyle";

/** Labels aligned with “Bags of Blessings” / Inventory Tracker workbook + app fields. */

export type InventoryExportRow = {
  id: string;
  name: string;
  category: string;
  packType?: string;
  price?: number;
  targetQty: number;
  onHand: number;
  projected: number;
  notes?: string;
  imageUrl?: string;
  hidden?: boolean;
};

export function exportStatusLabel(row: {
  targetQty: number;
  onHand: number;
  projected: number;
}): string {
  return inventoryWebStatusLabel(row.onHand);
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
  "Image",
  "Hidden",
  "Pack type",
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
        (it.imageUrl ?? "").replace(/\t/g, " "),
        it.hidden ? "yes" : "",
        (it.packType ?? "").replace(/[\t\r\n]/g, " "),
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
