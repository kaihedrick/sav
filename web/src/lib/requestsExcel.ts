import ExcelJS from "exceljs";

export type RequestExportLine = {
  createdAt: string;
  userName: string;
  userEmail?: string;
  status: string;
  itemName: string;
  qty: number;
  requestId: string;
};

export type UserExportRow = {
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
};

export type InventoryExportLite = {
  name: string;
  category: string;
  onHand: number;
  targetQty: number;
  projected: number;
  hidden?: boolean;
};

const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Desktop → Downloads via <a download>. iOS → Files / Share sheet when available. */
export async function saveExcelFile(
  buffer: ArrayBuffer | Uint8Array,
  filename: string,
): Promise<void> {
  const bytes =
    buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: XLSX_TYPE });
  const file = new File([blob], filename, { type: XLSX_TYPE });

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  const shareData: ShareData = { files: [file], title: filename };
  if (typeof nav.canShare === "function" && nav.canShare(shareData) && nav.share) {
    try {
      await nav.share(shareData);
      return;
    } catch (e) {
      // User cancelled share — don't fall through to a second save prompt.
      if ((e as Error)?.name === "AbortError") return;
    }
  }

  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(u);
}

export async function buildEventArchiveXlsxBuffer(input: {
  eventDate: string | null;
  requests: RequestExportLine[];
  users: UserExportRow[];
  inventory: InventoryExportLite[];
}): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Bags of Blessings";
  wb.created = new Date();

  const meta = wb.addWorksheet("Event");
  meta.columns = [
    { header: "Field", key: "field", width: 18 },
    { header: "Value", key: "value", width: 40 },
  ];
  meta.addRow({
    field: "Event date",
    value: input.eventDate ?? "(not set)",
  });
  meta.addRow({
    field: "Exported at",
    value: new Date().toISOString(),
  });
  meta.addRow({ field: "Requests", value: input.requests.length });
  meta.addRow({ field: "Contributors", value: input.users.length });
  meta.addRow({ field: "Inventory items", value: input.inventory.length });

  const reqs = wb.addWorksheet("Request history");
  reqs.columns = [
    { header: "Submitted", key: "createdAt", width: 22 },
    { header: "Name", key: "userName", width: 22 },
    { header: "Email", key: "userEmail", width: 28 },
    { header: "Status", key: "status", width: 14 },
    { header: "Item", key: "itemName", width: 36 },
    { header: "Qty", key: "qty", width: 8 },
    { header: "Request ID", key: "requestId", width: 38 },
  ];
  for (const r of input.requests) {
    reqs.addRow({
      createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString() : "",
      userName: r.userName,
      userEmail: r.userEmail ?? "",
      status: r.status,
      itemName: r.itemName,
      qty: r.qty,
      requestId: r.requestId,
    });
  }

  const users = wb.addWorksheet("Contributors");
  users.columns = [
    { header: "First name", key: "firstName", width: 16 },
    { header: "Last name", key: "lastName", width: 16 },
    { header: "Email", key: "email", width: 30 },
    { header: "Joined", key: "createdAt", width: 22 },
  ];
  for (const u of input.users) {
    users.addRow({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      createdAt: u.createdAt ? new Date(u.createdAt).toLocaleString() : "",
    });
  }

  const inv = wb.addWorksheet("Inventory");
  inv.columns = [
    { header: "Item", key: "name", width: 36 },
    { header: "Category", key: "category", width: 18 },
    { header: "On hand", key: "onHand", width: 10 },
    { header: "Target", key: "targetQty", width: 10 },
    { header: "Projected", key: "projected", width: 10 },
    { header: "Hidden", key: "hidden", width: 10 },
  ];
  for (const it of input.inventory) {
    inv.addRow({
      name: it.name,
      category: it.category,
      onHand: it.onHand,
      targetQty: it.targetQty,
      projected: it.projected,
      hidden: it.hidden ? "yes" : "",
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf);
}

export async function downloadEventArchive(input: {
  eventDate: string | null;
  requests: RequestExportLine[];
  users: UserExportRow[];
  inventory: InventoryExportLite[];
  filename?: string;
}): Promise<void> {
  const stamp = input.eventDate ?? new Date().toISOString().slice(0, 10);
  const filename =
    input.filename ??
    `Bags of Blessings — ${stamp} event archive.xlsx`;
  const buf = await buildEventArchiveXlsxBuffer(input);
  await saveExcelFile(buf, filename);
}

/** @deprecated use downloadEventArchive */
export async function downloadRequestsXlsx(
  rows: RequestExportLine[],
  filename = "Bags of Blessings — request history.xlsx",
): Promise<void> {
  await downloadEventArchive({
    eventDate: null,
    requests: rows,
    users: [],
    inventory: [],
    filename,
  });
}
