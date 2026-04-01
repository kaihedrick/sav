import {
  INVENTORY_HEADER_ALIASES,
  TRACKER_SHEET,
  normKey,
} from "./inventoryExcelColumns";

export type ParsedInventoryRow = {
  itemId?: string;
  name: string;
  category: string;
  price?: number;
  targetQty: number;
  onHand: number;
  notes?: string;
  sortPriority?: number;
};

function getCell(row: Record<string, unknown>, aliases: readonly string[]): unknown {
  for (const key of Object.keys(row)) {
    const nk = normKey(key);
    if (nk === "column1" || nk === "column 1") continue;
    for (const a of aliases) {
      if (nk === normKey(a)) return row[key];
    }
  }
  return undefined;
}

function asNonnegInt(v: unknown, fallback: number): number {
  if (v == null || v === "") return fallback;
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.max(0, Math.floor(v));
  }
  const n = Number(String(v).replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function asOptionalPrice(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  const n = Number(String(v).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseItemId(v: unknown): string | undefined {
  const s = String(v ?? "").trim();
  if (!s || !UUID_RE.test(s)) return undefined;
  return s;
}

/**
 * Reads “Inventory Tracker” sheet when present, else first sheet.
 * Matches your workbook: Item name, Type, Price, Stock, Status, Notes, …
 * **Projected** is ignored on import (live data from Dynamo / requests).
 * **Target** sets catalog targetQty (optional; defaults to 0 for new rows).
 * **Item ID** enables round-trip updates to existing items.
 */
export async function parseInventoryExcel(
  ab: ArrayBuffer,
): Promise<ParsedInventoryRow[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(ab, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames.includes(TRACKER_SHEET)
    ? TRACKER_SHEET
    : wb.SheetNames[0];
  if (!sheetName) return [];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
  });
  const out: ParsedInventoryRow[] = [];
  let i = 0;
  for (const row of rows) {
    const rawName = getCell(row, INVENTORY_HEADER_ALIASES.name);
    const name = String(rawName ?? "").trim();
    if (!name) continue;

    const itemId = parseItemId(getCell(row, INVENTORY_HEADER_ALIASES.itemId));

    const category = String(
      getCell(row, INVENTORY_HEADER_ALIASES.category) ?? "",
    ).trim();

    const price = asOptionalPrice(getCell(row, INVENTORY_HEADER_ALIASES.price));

    const onHand = asNonnegInt(
      getCell(row, INVENTORY_HEADER_ALIASES.onHand),
      0,
    );

    const targetQty = asNonnegInt(
      getCell(row, INVENTORY_HEADER_ALIASES.targetQty),
      0,
    );

    const notesRaw = getCell(row, INVENTORY_HEADER_ALIASES.notes);
    const notes = String(notesRaw ?? "").trim() || undefined;

    const sortRaw = getCell(row, INVENTORY_HEADER_ALIASES.sortPriority);
    let sortPriority: number | undefined;
    if (sortRaw !== "" && sortRaw != null) {
      const n = asNonnegInt(sortRaw, NaN);
      if (Number.isFinite(n)) sortPriority = n;
    }

    out.push({
      itemId,
      name: name.slice(0, 500),
      category: category.slice(0, 200),
      price,
      targetQty,
      onHand,
      notes: notes?.slice(0, 2000),
      sortPriority: sortPriority ?? i,
    });
    i++;
  }
  return out;
}
