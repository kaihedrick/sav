import type { ItemEntity } from "./types.js";
import { itemDisplayNameForExport } from "../lib/inventoryLabels.js";

export type SheetItem = ItemEntity & { onHand: number };
export type SheetChange = { before: SheetItem; after: SheetItem };

const aliases: Record<string, string[]> = {
  id: ["itemid", "id", "uuid"], name: ["itemname", "name", "item", "product"],
  category: ["type", "category"], price: ["price", "cost"],
  packType: ["packtype", "packsize", "pack", "packaging"],
  onHand: ["stock", "onhand", "quantity", "qty"], targetQty: ["target", "targetqty", "goal", "targetquantity"],
  notes: ["notes", "note"], imageUrl: ["image", "imageurl", "photo", "photourl"],
  hidden: ["hidden", "hide"],
};

/** Validate the entire sheet before any writes. Missing rows never delete items. */
export function planLiveSheetImport(values: unknown[][], items: SheetItem[]): SheetChange[] {
  if (values.length < 2) throw new Error("The live sheet has no inventory rows.");
  const columns = new Map<string, number>();
  values[0].forEach((header, index) => {
    const key = String(header ?? "").trim().toLowerCase().replace(/\s+/g, "");
    const field = Object.keys(aliases).find((f) => aliases[f].includes(key));
    if (!field) return;
    if (columns.has(field)) throw new Error(`Duplicate column: ${header}`);
    columns.set(field, index);
  });
  if (!columns.has("id")) throw new Error("The live sheet needs an Item ID column. Keep the IDs exported by the website.");
  const byId = new Map(items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const changes: SheetChange[] = [];
  let rowCount = 0;
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every((cell) => cell == null || String(cell).trim() === "")) continue;
    if (++rowCount > 500) throw new Error("Maximum 500 inventory rows per refresh.");
    const cell = (field: string) => row[columns.get(field)!];
    const str = (field: string) => String(cell(field) ?? "").trim();
    const fail = (message: string): never => { throw new Error(`Sheet row ${i + 1}: ${message}`); };
    const id = str("id");
    if (!id) fail("Item ID is missing. Add new items in Catalog first.");
    if (seen.has(id)) fail("duplicate Item ID.");
    seen.add(id);
    const before = byId.get(id);
    if (!before) fail("Item ID was not found in Catalog. Refresh does not create items.");
    const after: SheetItem = { ...before! };
    for (const field of ["onHand", "targetQty", "price"] as const) {
      if (!columns.has(field)) continue;
      const raw = cell(field);
      if (raw == null || str(field) === "") {
        if (field === "price") { after.price = undefined; continue; }
        fail(`${field === "onHand" ? "Stock" : "Target"} is blank; enter 0 to clear it.`);
      }
      const number = typeof raw === "number" ? raw : Number(str(field).replace(/,/g, ""));
      if (typeof raw === "boolean" || !Number.isFinite(number) || number < 0 ||
          (field !== "price" && !Number.isSafeInteger(number))) fail(`invalid ${field} value.`);
      after[field] = number;
    }
    for (const [field, max] of [["name", 500], ["category", 200], ["packType", 100], ["notes", 2000], ["imageUrl", 2000]] as const) {
      if (!columns.has(field)) continue;
      let value = str(field);
      // Exports decorate names; importing an unchanged export must not rename items.
      if (field === "name" && value === itemDisplayNameForExport(before!.name, before!.category)) value = before!.name;
      if (field === "name" && !value) fail("Item name is blank.");
      if (value.length > max) fail(`${field} is too long.`);
      if (field === "imageUrl" && value) {
        try { if (!["http:", "https:"].includes(new URL(value).protocol)) fail("Image must be an HTTP(S) URL."); }
        catch { fail("Image must be an HTTP(S) URL."); }
      }
      if (field === "notes" || field === "imageUrl" || field === "packType") after[field] = value || undefined;
      else after[field] = value;
    }
    if (columns.has("hidden")) {
      const value = str("hidden").toLowerCase();
      if (!["", "yes", "true", "1", "no", "false", "0"].includes(value)) fail("Hidden must be yes or no.");
      after.hidden = ["yes", "true", "1"].includes(value);
    }
    // Status and Projected are derived from website data, never imported.
    if (Object.keys(aliases).some((field) => field !== "id" &&
      (after[field as keyof SheetItem] ?? (field === "hidden" ? false : "")) !==
      (before![field as keyof SheetItem] ?? (field === "hidden" ? false : "")))) {
      changes.push({ before: before!, after });
    }
  }
  if (!rowCount) throw new Error("The live sheet has no inventory rows.");
  return changes;
}
