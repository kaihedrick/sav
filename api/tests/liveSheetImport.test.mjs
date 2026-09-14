import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFileSync } from "node:fs";

async function load(entry, plugins = []) {
  const result = await build({ entryPoints: [entry], bundle: true, write: false, platform: "node", format: "esm", plugins });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}
const { planLiveSheetImport } = await load("src/domain/liveSheetImport.ts");
const item = { id: "a", name: "Soap", category: "Hygiene", targetQty: 100, onHand: 12,
  price: 2, notes: "Keep dry", hidden: false, sortPriority: 1, createdAt: "old", updatedAt: "old" };

test("imports edited quantities and ignores computed columns", () => {
  const [change] = planLiveSheetImport([
    ["Item ID", "Stock", "Target", "Projected", "Status"], ["a", 25, 300, 999, "anything"],
  ], [item]);
  assert.equal(change.after.onHand, 25);
  assert.equal(change.after.targetQty, 300);
  assert.equal(change.after.name, "Soap");
  assert.equal(change.after.projected, undefined);
  assert.equal(item.onHand, 12);
});
test("unchanged exported names do not gain emoji; repeat refresh is a no-op", () => {
  assert.deepEqual(planLiveSheetImport([["Item ID", "Item name", "Stock"], ["a", "🧴 Soap", 12]], [item]), []);
  const values = [["Item ID", "Target"], ["a", 300]];
  const [change] = planLiveSheetImport(values, [item]);
  assert.deepEqual(planLiveSheetImport(values, [change.after]), []);
});
test("missing rows and columns preserve unrelated inventory", () => {
  const changes = planLiveSheetImport([["Item ID", "Target"], ["a", 300]], [item, { ...item, id: "b" }]);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].after.onHand, 12);
  assert.equal(changes[0].after.notes, "Keep dry");
});
test("blank optional fields clear, blank stock/target never silently zero", () => {
  const [change] = planLiveSheetImport([["Item ID", "Price", "Notes", "Hidden"], ["a", "", "", ""]], [item]);
  assert.equal(change.after.price, undefined);
  assert.equal(change.after.notes, undefined);
  assert.equal(change.after.hidden, false);
  for (const column of ["Stock", "Target"]) {
    assert.throws(() => planLiveSheetImport([["Item ID", column], ["a", ""]], [item]), /blank/);
  }
});
test("invalid rows fail with location before a plan can be applied", () => {
  for (const value of [-1, 1.5, "#VALUE!", true, "oops", Infinity]) {
    assert.throws(() => planLiveSheetImport([["Item ID", "Stock"], ["a", value]], [item]), /row 2/);
  }
  assert.throws(() => planLiveSheetImport([["Item ID", "Hidden"], ["a", "maybe"]], [item]), /Hidden/);
  assert.throws(() => planLiveSheetImport([["Item ID", "Image"], ["a", "javascript:alert(1)"]], [item]), /HTTP/);
});
test("rejects empty sheets, ambiguous headers, missing/unknown/duplicate IDs", () => {
  for (const values of [[], [["Item ID"]], [["Item ID"], [""]], [["Stock"], [10]],
    [["Item ID", "ID"], ["a", "a"]], [["Item ID", "Stock"], ["", 1]],
    [["Item ID"], ["unknown"]], [["Item ID"], ["a"], ["a"]]]) {
    assert.throws(() => planLiveSheetImport(values, [item]));
  }
});
test("accepts reordered headers and numeric formula results; rejects oversize imports", () => {
  const [change] = planLiveSheetImport([[" TARGET QTY ", "item id", "stock"], [300, "a", "1,200"]], [item]);
  assert.equal(change.after.onHand, 1200);
  const items = Array.from({ length: 501 }, (_, i) => ({ ...item, id: String(i) }));
  assert.throws(() => planLiveSheetImport([["Item ID"], ...items.map((i) => [i.id])], items), /500/);
});

// Exercise the real route with isolated external services; never contacts live accounts.
const stubs = {
  "repository.js": `
    export const listItems = async () => globalThis.sheetTest.items;
    export const getStock = async id => globalThis.sheetTest.items.find(i => i.id === id).onHand;
    export const putItem = async item => { (globalThis.sheetTest.savedItems ??= []).push(item); };
    export const setStock = async (id, quantity) => { (globalThis.sheetTest.savedStock ??= []).push({ id, quantity }); };
    export const deleteItem = async id => { (globalThis.sheetTest.deletedItems ??= []).push(id); };
    export const deleteAllItems = async () => { globalThis.sheetTest.truncated = true; return globalThis.sheetTest.items.length; };
    export const applySheetChanges = async batch => {
      const state = globalThis.sheetTest;
      if (state.failBatch === state.batches.length) throw new Error('conflict');
      state.batches.push(batch);
    };
  `,
  "googleSheets.js": `
    export const isGoogleSheetsSyncEnabled = () => globalThis.sheetTest.configured;
    export const getPublicSheetViewUrl = () => null;
    export const readInventoryRows = async () => { globalThis.sheetTest.reads++; if (globalThis.sheetTest.readError) throw new Error('Read failed'); return globalThis.sheetTest.values; };
    export const clearAndWriteInventoryRows = async () => { throw new Error('Pull must never push'); };
  `,
  "auth.js": `
    export const verifyBearerToken = async () => ({ sub: 'user' });
    export const isAdmin = async () => globalThis.sheetTest.admin;
    export const verifyGoogleIdToken = async () => ({});
    export const mintSessionJwt = async () => '';
  `,
  "adminService.js": `export const allAdminEmails = async () => []; export const adminEmailsFromEnv = () => [];`,
  "resend.js": `export const notifyAdminRequest = async () => {};`,
};
// Fail loudly if the pull path accidentally reaches an unrelated repository operation.
for (const [, name] of readFileSync("src/data/repository.ts", "utf8").matchAll(/export async function (\w+)/g)) {
  if (!["listItems", "getStock", "applySheetChanges", "putItem", "setStock", "deleteItem", "deleteAllItems"].includes(name)) {
    stubs["repository.js"] += `export const ${name} = async () => { throw new Error('Unexpected repository call: ${name}'); };\n`;
  }
}
const { handleRequest } = await load("src/handlers/routes.ts", [{
  name: "isolate-services",
  setup(build) {
    build.onResolve({ filter: /\/(repository|googleSheets|auth|adminService|resend)\.js$/ }, args => ({ path: args.path.split("/").pop(), namespace: "stub" }));
    build.onLoad({ filter: /.*/, namespace: "stub" }, args => ({ contents: stubs[args.path], loader: "js" }));
  },
}]);
function reset(overrides = {}) {
  globalThis.sheetTest = { configured: true, admin: true, items: [item], values: [["Item ID", "Target"], ["a", 300]], batches: [], reads: 0, ...overrides };
  return globalThis.sheetTest;
}
const event = { rawPath: "/admin/inventory/pull-google-sheet", requestContext: { http: { method: "POST" } }, headers: { authorization: "Bearer test" } };
test("route requires admin and configured sync before reading sheet", async () => {
  for (const [overrides, status] of [[{ admin: false }, 403], [{ configured: false }, 503]]) {
    const state = reset(overrides);
    assert.equal((await handleRequest(event)).statusCode, status);
    assert.equal(state.reads, 0);
    assert.equal(state.batches.length, 0);
  }
  reset();
  assert.equal((await handleRequest({ ...event, headers: {} })).statusCode, 401);
});
test("route saves changes and does not overwrite sheet", async () => {
  const state = reset();
  const result = await handleRequest(event);
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.parse(result.body).updated, 1);
  assert.equal(state.batches[0][0].after.targetQty, 300);
});
test("read or validation failure performs no writes", async () => {
  for (const [overrides, status] of [[{ readError: true }, 502], [{ values: [["Item ID", "Stock"], ["a", 25], ["bad", 10]] }, 400]]) {
    const state = reset(overrides);
    assert.equal((await handleRequest(event)).statusCode, status);
    assert.equal(state.batches.length, 0);
  }
});
test("partial batch failure reports saved count; unchanged sheet writes nothing", async () => {
  const items = Array.from({ length: 51 }, (_, i) => ({ ...item, id: String(i) }));
  reset({ items, values: [["Item ID", "Target"], ...items.map(i => [i.id, 300])], failBatch: 1 });
  const originalError = console.error;
  console.error = () => {};
  try {
    const result = await handleRequest(event);
    assert.equal(result.statusCode, 409);
    assert.equal(JSON.parse(result.body).updated, 50);
  } finally { console.error = originalError; }
  const state = reset({ values: [["Item ID", "Target"], ["a", 100]] });
  assert.equal(JSON.parse((await handleRequest(event)).body).updated, 0);
  assert.equal(state.batches.length, 0);
});

const catalogItem = { ...item, id: "3b2f7677-122f-4874-87bd-3a588736e004", imageUrl: "https://example.com/saved.jpg" };
async function importRows(items, replaceAll = false) {
  return handleRequest({ ...event, rawPath: "/admin/items/import", body: JSON.stringify({ items, replaceAll }) });
}
test("Excel import preserves photo and ID even for old clients sending replaceAll", async () => {
  for (const withId of [false, true]) {
    const state = reset({ configured: false, items: [catalogItem] });
    const response = await importRows([{ ...(withId ? { itemId: catalogItem.id } : {}), name: "Soap", category: "Hygiene", onHand: 30, targetQty: 300 }], true);
    assert.equal(response.statusCode, 200);
    assert.equal(state.savedItems[0].id, catalogItem.id);
    assert.equal(state.savedItems[0].imageUrl, catalogItem.imageUrl);
    assert.equal(state.savedStock[0].quantity, 30);
    assert.equal(state.truncated, true);
    assert.equal(state.deletedItems, undefined);
  }
});
test("Excel import accepts new photos; merge keeps omitted items", async () => {
  const state = reset({ configured: false, items: [catalogItem, { ...catalogItem, id: "other", name: "Socks" }] });
  const response = await importRows([{ name: "Soap", onHand: 30, targetQty: 300, imageUrl: "https://example.com/new.jpg" }]);
  assert.equal(response.statusCode, 200);
  assert.equal(state.savedItems[0].imageUrl, "https://example.com/new.jpg");
  assert.equal(state.deletedItems, undefined);
});
test("ambiguous or invalid Excel imports cannot delete the existing catalog", async () => {
  for (const row of [
    { name: "Soap" },
    { name: "New item", imageUrl: "javascript:alert(1)" },
  ]) {
    const state = reset({ configured: false, items: [catalogItem, { ...catalogItem, id: "other" }] });
    const response = await importRows([{ ...row, onHand: 1, targetQty: 300 }], true);
    assert.equal(response.statusCode, 400);
    assert.equal(state.savedItems, undefined);
    assert.equal(state.deletedItems, undefined);
    assert.equal(state.truncated, undefined);
  }
});
test("exported decorated names match without duplicating items", async () => {
  const state = reset({ configured: false, items: [catalogItem] });
  assert.equal((await importRows([{ name: "🧴 Soap", onHand: 1, targetQty: 300 }])).statusCode, 200);
  assert.equal(state.savedItems[0].name, "Soap");
  assert.equal(state.savedItems[0].imageUrl, catalogItem.imageUrl);
});
test("replacement imports assign a fresh ID to a new item", async () => {
  const state = reset({ configured: false, items: [catalogItem] });
  const result = await importRows([{ name: "New blankets", onHand: 0, targetQty: 300 }], true);
  assert.equal(result.statusCode, 200);
  assert.equal(state.truncated, true);
  assert.match(state.savedItems[0].id, /^[0-9a-f-]{36}$/);
  assert.notEqual(state.savedItems[0].id, catalogItem.id);
  assert.equal(JSON.parse(result.body).created, 1);
});
test("pack type round-trips through live sheet changes and survives omitted Excel columns", async () => {
  const [change] = planLiveSheetImport([["Item ID", "Pack type"], ["a", "Case of 24"]], [item]);
  assert.equal(change.after.packType, "Case of 24");
  const state = reset({ configured: false, items: [{ ...catalogItem, packType: "Case of 24" }] });
  assert.equal((await importRows([{ name: "Soap", onHand: 1, targetQty: 300 }], true)).statusCode, 200);
  assert.equal(state.savedItems[0].packType, "Case of 24");
});
