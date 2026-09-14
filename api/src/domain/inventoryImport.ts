import type { ItemEntity } from "./types.js";
import { itemDisplayNameForExport } from "../lib/inventoryLabels.js";

const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

/** Resolve every row before writing, so ambiguous names never overwrite a random item. */
export function resolveInventoryImport<T extends { itemId?: string; name: string; category?: string; packType?: string }>(
  rows: T[], catalog: ItemEntity[],
): { row: T; existing?: ItemEntity }[] {
  const seen = new Set<string>();
  return rows.map((row, index) => {
    let existing: ItemEntity | undefined;
    if (row.itemId) {
      existing = catalog.find(item => item.id === row.itemId);
    } else {
      const candidates = catalog.filter(item =>
        [item.name, itemDisplayNameForExport(item.name, item.category)].some(name => normalize(name) === normalize(row.name)) &&
        (!row.category?.trim() || normalize(item.category) === normalize(row.category)) &&
        (!row.packType?.trim() || normalize(item.packType ?? "") === normalize(row.packType)));
      if (candidates.length > 1) throw new Error(`Row ${index + 2}: multiple items match ${row.name}. Include Item ID, category, or pack type.`);
      existing = candidates[0];
    }
    const identity = existing ? `id:${existing.id}` : `name:${normalize(row.name)}|${normalize(row.category ?? "")}|${normalize(row.packType ?? "")}`;
    if (seen.has(identity)) throw new Error(`Row ${index + 2}: duplicate item in import: ${row.name}.`);
    seen.add(identity);
    const name = existing && normalize(row.name) === normalize(itemDisplayNameForExport(existing.name, existing.category))
      ? existing.name : row.name.trim();
    return { row: { ...row, name }, existing };
  });
}
