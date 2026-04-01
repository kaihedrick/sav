const DB = "bags-bob-export";
const STORE = "templates";
const KEY = "last-imported-xlsx";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
  });
}

export async function saveInventoryExportTemplate(
  buffer: ArrayBuffer,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("indexedDB write failed"));
    tx.objectStore(STORE).put(buffer, KEY);
  });
  db.close();
}

export async function loadInventoryExportTemplate(): Promise<ArrayBuffer | null> {
  const db = await openDb();
  const buf = await new Promise<ArrayBuffer | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    tx.onerror = () => reject(tx.error ?? new Error("indexedDB read failed"));
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => {
      const v = req.result;
      resolve(v instanceof ArrayBuffer ? v : null);
    };
  });
  db.close();
  return buf;
}
