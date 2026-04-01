import ExcelJS from "exceljs";
import {
  INVENTORY_HEADER_ALIASES,
  TRACKER_SHEET,
  normKey,
  type InventoryColumnField,
} from "./inventoryExcelColumns";
import type { InventoryExportRow } from "./inventoryExcel";
import {
  categoryExcelTagStyle,
  inventoryWebStatusLabel,
  itemDisplayNameForExport,
  stockExcelTagStyle,
} from "./inventoryCardStyle";

const HEADER_CHARCOAL = "FF3F3F46";
const BOB_INK = "0C0C0C";
const ROW_GRAY = "FFF9FAFB";
const HEADER_ROW = 1;
const DATA_START_ROW = 2;

type ExportFieldKey =
  | "itemId"
  | "name"
  | "category"
  | "price"
  | "onHand"
  | "status"
  | "notes"
  | "targetQty"
  | "projected";

function cellPlainText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && v !== null) {
    const o = v as unknown as Record<string, unknown>;
    if (Array.isArray(o.richText)) {
      return (o.richText as { text: string }[])
        .map((x) => x.text)
        .join("");
    }
    if (typeof o.text === "string" || typeof o.text === "number")
      return String(o.text);
    if (typeof o.result === "string" || typeof o.result === "number")
      return String(o.result);
  }
  return String(v);
}

function deepCloneStyle(
  s: Partial<ExcelJS.Style> | undefined,
): Partial<ExcelJS.Style> {
  if (!s || Object.keys(s).length === 0) return {};
  return JSON.parse(JSON.stringify(s)) as Partial<ExcelJS.Style>;
}

function mapHeaderToColumns(
  row: ExcelJS.Row,
): Partial<Record<ExportFieldKey, number>> {
  const out: Partial<Record<ExportFieldKey, number>> = {};
  const used = new Set<number>();
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const text = cellPlainText(cell).trim();
    if (!text) return;
    const nk = normKey(text);
    if (nk === "column1" || nk === "column 1") return;
    (Object.keys(INVENTORY_HEADER_ALIASES) as InventoryColumnField[]).forEach(
      (field) => {
        if (field === "sortPriority") return;
        const aliases = INVENTORY_HEADER_ALIASES[field];
        const match = aliases.some((a) => normKey(a) === nk);
        if (!match) return;
        const ek = field as ExportFieldKey;
        if (out[ek] != null || used.has(colNumber)) return;
        out[ek] = colNumber;
        used.add(colNumber);
      },
    );
  });
  return out;
}

function maxMappedColumn(colMap: Partial<Record<ExportFieldKey, number>>): number {
  let m = 1;
  for (const c of Object.values(colMap)) {
    if (typeof c === "number" && c > m) m = c;
  }
  return m;
}

function pickPrototypeDataRow(
  ws: ExcelJS.Worksheet,
  nameCol: number,
): number {
  const cap = Math.min(ws.rowCount || DATA_START_ROW, 40);
  for (let r = DATA_START_ROW; r <= cap; r++) {
    const t = cellPlainText(ws.getRow(r).getCell(nameCol)).trim();
    if (t) return r;
  }
  return DATA_START_ROW;
}

function writeRowValues(
  ws: ExcelJS.Worksheet,
  excelRowIndex: number,
  row: InventoryExportRow,
  colMap: Partial<Record<ExportFieldKey, number>>,
): void {
  const er = ws.getRow(excelRowIndex);
  const set = (field: ExportFieldKey, value: ExcelJS.CellValue) => {
    const c = colMap[field];
    if (c == null) return;
    er.getCell(c).value = value;
  };
  set("itemId", row.id);
  set("name", itemDisplayNameForExport(row.name, row.category));
  set("category", row.category || "—");
  set("price", row.price != null && Number.isFinite(row.price) ? row.price : "");
  set("onHand", row.onHand);
  set("status", inventoryWebStatusLabel(row.onHand));
  set("notes", row.notes ?? "");
  set("targetQty", row.targetQty);
  set("projected", row.projected);
}

/** Category + status “pills” and numeric alignment — matches web list semantics. */
function applyWebViewRowDecorations(
  ws: ExcelJS.Worksheet,
  excelRowIndex: number,
  colMap: Partial<Record<ExportFieldKey, number>>,
  row: InventoryExportRow,
): void {
  const er = ws.getRow(excelRowIndex);
  const nc = colMap.name;
  if (nc != null) {
    const cell = er.getCell(nc);
    cell.value = itemDisplayNameForExport(row.name, row.category);
    cell.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };
  }
  const cc = colMap.category;
  if (cc != null) {
    const tag = categoryExcelTagStyle(row.category);
    const cell = er.getCell(cc);
    cell.value = row.category || "—";
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: tag.fillArgb },
    };
    cell.font = { bold: true, color: { argb: tag.fontArgb }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  }
  const sc = colMap.status;
  if (sc != null) {
    const tag = stockExcelTagStyle(row.onHand);
    const cell = er.getCell(sc);
    cell.value = tag.label;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: tag.fillArgb },
    };
    cell.font = { bold: true, color: { argb: tag.fontArgb }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  }
  const pc = colMap.price;
  if (pc != null) {
    er.getCell(pc).alignment = {
      vertical: "middle",
      horizontal: "right",
    };
  }
  const stockCol = colMap.onHand;
  if (stockCol != null) {
    er.getCell(stockCol).alignment = {
      vertical: "middle",
      horizontal: "right",
    };
  }
  const tc = colMap.targetQty;
  if (tc != null) {
    er.getCell(tc).alignment = {
      vertical: "middle",
      horizontal: "right",
    };
  }
  const prc = colMap.projected;
  if (prc != null) {
    er.getCell(prc).alignment = {
      vertical: "middle",
      horizontal: "right",
    };
  }
}

async function fillTemplateWorkbook(
  templateBuffer: ArrayBuffer,
  rows: InventoryExportRow[],
): Promise<Uint8Array | null> {
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(templateBuffer);
    const sheet =
      wb.getWorksheet(TRACKER_SHEET) ?? wb.worksheets[0];
    if (!sheet) return null;

    const headerRow = sheet.getRow(HEADER_ROW);
    const colMap = mapHeaderToColumns(headerRow);
    if (colMap.name == null) return null;

    const nameCol = colMap.name;
    const protoR = pickPrototypeDataRow(sheet, nameCol);
    const proto = sheet.getRow(protoR);
    const maxCol = maxMappedColumn(colMap);
    const styleByCol = new Map<number, Partial<ExcelJS.Style>>();
    for (let c = 1; c <= maxCol; c++) {
      styleByCol.set(c, deepCloneStyle(proto.getCell(c).style));
    }
    const protoHeight = proto.height;

    const n = rows.length;
    let last = sheet.lastRow?.number ?? DATA_START_ROW;
    if (last > n + 1) {
      sheet.spliceRows(n + 2, last - (n + 1));
    }
    last = sheet.lastRow?.number ?? DATA_START_ROW;
    if (last < n + 1) {
      const toAdd = n + 1 - last;
      const blanks = Array.from({ length: toAdd }, () => [] as unknown[]);
      sheet.spliceRows(last + 1, 0, ...blanks);
    }

    for (let i = 0; i < n; i++) {
      const r = DATA_START_ROW + i;
      const excelRow = sheet.getRow(r);
      if (protoHeight != null) excelRow.height = protoHeight;
      writeRowValues(sheet, r, rows[i], colMap);
      for (let c = 1; c <= maxCol; c++) {
        const st = styleByCol.get(c);
        if (st && Object.keys(st).length > 0) {
          excelRow.getCell(c).style = st;
        }
      }
      applyWebViewRowDecorations(sheet, r, colMap, rows[i]);
    }

    const out = await wb.xlsx.writeBuffer();
    return new Uint8Array(out);
  } catch {
    return null;
  }
}

const FALLBACK_HEADERS: { key: ExportFieldKey; label: string; width: number }[] =
  [
    { key: "itemId", label: "Item ID", width: 38 },
    { key: "name", label: "Item name", width: 36 },
    { key: "category", label: "Type", width: 18 },
    { key: "price", label: "Price", width: 10 },
    { key: "onHand", label: "Stock", width: 10 },
    { key: "status", label: "Status", width: 14 },
    { key: "notes", label: "Notes", width: 40 },
    { key: "targetQty", label: "Target", width: 10 },
    { key: "projected", label: "Projected", width: 12 },
  ];

async function buildFallbackStyledWorkbook(
  rows: InventoryExportRow[],
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(TRACKER_SHEET, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws.columns = FALLBACK_HEADERS.map((h) => ({
    header: h.label,
    key: h.key,
    width: h.width,
  }));

  const headerRow = ws.getRow(1);
  headerRow.height = 22;
  const headerBottom = {
    style: "thin" as const,
    color: { argb: "FF52525B" },
  };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_CHARCOAL },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      bottom: headerBottom,
    };
  });

  const rowDivider = {
    style: "thin" as const,
    color: { argb: "FFE5E7EB" },
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const excelRow = ws.addRow({
      itemId: r.id,
      name: itemDisplayNameForExport(r.name, r.category),
      category: r.category,
      price:
        r.price != null && Number.isFinite(r.price) ? r.price : "",
      onHand: r.onHand,
      status: inventoryWebStatusLabel(r.onHand),
      notes: r.notes ?? "",
      targetQty: r.targetQty,
      projected: r.projected,
    });
    excelRow.height = 20;
    const zebraBg = i % 2 === 1 ? ROW_GRAY : "FFFFFFFF";
    FALLBACK_HEADERS.forEach((h, idx) => {
      const c = idx + 1;
      const cell = excelRow.getCell(c);
      if (h.key === "category") {
        const tag = categoryExcelTagStyle(r.category);
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: tag.fillArgb },
        };
        cell.font = { bold: true, color: { argb: tag.fontArgb }, size: 11 };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (h.key === "status") {
        const tag = stockExcelTagStyle(r.onHand);
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: tag.fillArgb },
        };
        cell.font = { bold: true, color: { argb: tag.fontArgb }, size: 11 };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: zebraBg },
        };
        cell.font = { color: { argb: BOB_INK }, size: 11 };
        const right =
          h.key === "price" ||
          h.key === "onHand" ||
          h.key === "targetQty" ||
          h.key === "projected";
        cell.alignment = {
          vertical: "middle",
          horizontal: right ? "right" : "left",
          wrapText: h.key === "notes" || h.key === "name",
        };
      }
      cell.border = { bottom: rowDivider };
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf);
}

/**
 * Prefers the last imported workbook (preserves its styling). Falls back to a
 * Bags-of-Blessings–styled sheet if there is no template or it cannot be read.
 */
export async function buildStyledInventoryXlsxBuffer(
  rows: InventoryExportRow[],
  templateBuffer?: ArrayBuffer | null,
): Promise<Uint8Array> {
  let resolved: ArrayBuffer | null =
    templateBuffer !== undefined && templateBuffer !== null
      ? templateBuffer
      : null;
  if (resolved == null) {
    const { loadInventoryExportTemplate } = await import(
      "./inventoryExportTemplateStorage"
    );
    resolved = await loadInventoryExportTemplate();
  }
  if (resolved && resolved.byteLength > 0) {
    const filled = await fillTemplateWorkbook(resolved, rows);
    if (filled) return filled;
  }
  return buildFallbackStyledWorkbook(rows);
}
