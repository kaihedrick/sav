/** Shared header aliases for import (SheetJS) and styled export (ExcelJS). */

export const TRACKER_SHEET = "Inventory Tracker";

export function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

export type InventoryColumnField =
  | "itemId"
  | "name"
  | "category"
  | "price"
  | "onHand"
  | "targetQty"
  | "notes"
  | "sortPriority"
  | "status"
  | "projected";

/** First matching column wins when building header → field map. */
export const INVENTORY_HEADER_ALIASES: Record<
  InventoryColumnField,
  readonly string[]
> = {
  itemId: ["item id", "itemid", "id", "uuid"],
  name: ["item name", "itemname", "name", "item", "product"],
  category: ["type", "category", "cat", "group"],
  price: ["price", "cost", "amount"],
  onHand: ["stock", "on hand", "onhand", "quantity", "qty"],
  targetQty: [
    "target",
    "targetqty",
    "target qty",
    "goal",
    "target quantity",
  ],
  notes: ["notes", "note", "comments", "remark"],
  sortPriority: [
    "sortpriority",
    "sort priority",
    "priority",
    "order",
    "#",
    "sort",
  ],
  status: ["status", "state"],
  projected: ["projected", "projection", "committed", "reserved"],
};
