import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const result = await build({ entryPoints: ["src/data/repository.ts"], bundle: true, write: false, platform: "node", format: "esm", plugins: [{
  name: "memory-database",
  setup(build) {
    build.onResolve({ filter: /^@aws-sdk\// }, args => ({ path: args.path, namespace: "memory" }));
    build.onLoad({ filter: /.*/, namespace: "memory" }, () => ({ contents: `
      export class DynamoDBClient {}
      export const DynamoDBDocumentClient = { from: () => ({ send: command => globalThis.commitDb(command) }) };
      export class GetCommand { constructor(input) { this.input = input; this.kind = 'get'; } }
      export class TransactWriteCommand { constructor(input) { this.input = input; this.kind = 'transaction'; } }
      export class PutCommand {}
      export class QueryCommand { constructor(input) { this.input = input; this.kind = 'query'; } }
      export class DeleteCommand { constructor(input) { this.input = input; this.kind = 'delete'; } }
    ` }));
  },
}] });
const { commitRequest, deleteRequest, deleteAllRequests } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
process.env.TABLE_NAME = "test";
const request = { id: "request", userId: "u", userName: "Person", status: "pending", createdAt: "start", updatedAt: "start", lines: [{ itemId: "soap", qty: 10 }] };
function database(target = 300, failCount = 0) {
  const rows = new Map([["ITEM#soap", { id: "soap", name: "Soap", category: "Hygiene", targetQty: target, sortPriority: 0, createdAt: "old", updatedAt: "old" }]]);
  rows.set("STOCK#soap", { itemId: "soap", quantity: 59 });
  let calls = 0;
  globalThis.commitDb = async command => {
    if (command.kind === "get") return { Item: rows.get(command.input.Key.sk) };
    if (command.kind === "query") return { Items: [...rows.values()].filter(row => row.gsi1pk === "REQUEST") };
    if (command.kind === "delete") { rows.delete(command.input.Key.sk); return {}; }
    calls++;
    const ops = command.input.TransactItems;
    const conflict = () => { const error = new Error("Conflict"); error.name = "TransactionCanceledException"; throw error; };
    if (calls <= failCount) conflict();
    for (const op of ops) {
      if (op.Put) {
        const existing = rows.get(op.Put.Item.sk);
        if (op.Put.ConditionExpression.includes("attribute_not_exists") ? !!existing : existing?.updatedAt !== op.Put.ExpressionAttributeValues[":expected"]) conflict();
      } else if (op.Delete) {
        if (rows.get(op.Delete.Key.sk)?.updatedAt !== op.Delete.ExpressionAttributeValues[":expected"]) conflict();
      } else if (rows.get(op.Update.Key.sk)?.[op.Update.Key.sk.startsWith("STOCK#") ? "quantity" : "targetQty"] !== op.Update.ExpressionAttributeValues[":expected"]) conflict();
    }
    for (const op of ops) {
      if (op.Put) rows.set(op.Put.Item.sk, { ...op.Put.Item });
      else if (op.Delete) rows.delete(op.Delete.Key.sk);
      else rows.set(op.Update.Key.sk, { ...rows.get(op.Update.Key.sk), [op.Update.Key.sk.startsWith("STOCK#") ? "quantity" : "targetQty"]: op.Update.ExpressionAttributeValues[":next"], updatedAt: op.Update.ExpressionAttributeValues[":now"] });
    }
    return {};
  };
  return rows;
}
test("commit adds to stock once and leaves target fixed", async () => {
  const db = database();
  assert.equal(await commitRequest(request), true);
  assert.equal(db.get("ITEM#soap").targetQty, 300);
  assert.equal(db.get("STOCK#soap").quantity, 69);
  assert.equal(await commitRequest(request), false);
  assert.equal(db.get("ITEM#soap").targetQty, 300);
  assert.equal(db.get("STOCK#soap").quantity, 69);
});
test("concurrent commits preserve both stock additions", async () => {
  const db = database();
  await Promise.all([commitRequest(request), commitRequest({ ...request, id: "other" })]);
  assert.equal(db.get("ITEM#soap").targetQty, 300);
  assert.equal(db.get("STOCK#soap").quantity, 79);
});
test("edits apply increases and reductions while keeping target fixed", async () => {
  const db = database();
  await commitRequest(request);
  const increased = { ...request, updatedAt: "later", lines: [{ itemId: "soap", qty: 15 }] };
  await commitRequest(increased, request);
  assert.equal(db.get("ITEM#soap").targetQty, 300);
  assert.equal(db.get("STOCK#soap").quantity, 74);
  await commitRequest({ ...request, updatedAt: "latest", lines: [{ itemId: "soap", qty: 3 }] }, increased);
  assert.equal(db.get("ITEM#soap").targetQty, 300);
  assert.equal(db.get("STOCK#soap").quantity, 62);
});
test("stock may exceed target and duplicate lines are combined", async () => {
  const db = database(12);
  await commitRequest({ ...request, lines: [{ itemId: "soap", qty: 10 }, { itemId: "soap", qty: 10 }] });
  assert.equal(db.get("ITEM#soap").targetQty, 12);
  assert.equal(db.get("STOCK#soap").quantity, 79);
});
test("failed transaction or missing item leaves targets and requests untouched", async () => {
  const db = database(300, 3);
  await assert.rejects(commitRequest(request));
  assert.equal(db.get("ITEM#soap").targetQty, 300);
  assert.equal(db.has("REQUEST#request"), false);
  database();
  await assert.rejects(commitRequest({ ...request, lines: [{ itemId: "missing", qty: 10 }] }), /no longer available/);
});

test("100 combo kits added to 59 gives 159 with target still 300", async () => {
 const db = database();
 await commitRequest({...request,lines:[{itemId:"soap",qty:100}]});
 assert.equal(db.get("STOCK#soap").quantity,159);
 assert.equal(db.get("ITEM#soap").targetQty,300);
});

test("delete reverses stock once, keeps target fixed, and retains an audit record", async () => {
  const db = database();
  await commitRequest(request);
  await deleteRequest(request.id, request, "admin");
  assert.equal(db.get("STOCK#soap").quantity, 59);
  assert.equal(db.get("ITEM#soap").targetQty, 300);
  assert.equal(db.has("REQUEST#request"), false);
  const audits = [...db.values()].filter(r => r.action === "delete_contribution");
  assert.equal(audits.length, 1);
  assert.deepEqual(audits[0].lines, request.lines);
  await assert.rejects(deleteRequest(request.id, request, "admin"));
  assert.equal(db.get("STOCK#soap").quantity, 59);
});
test("stale deletion cannot undo an edited contribution", async () => {
  const db = database();
  await commitRequest(request);
  await commitRequest({...request, updatedAt:"changed", lines:[{itemId:"soap",qty:20}]}, request);
  await assert.rejects(deleteRequest(request.id, request, "admin"));
  assert.equal(db.get("STOCK#soap").quantity,79);
  assert.equal(db.has("REQUEST#request"),true);
});
test("removed lines reduce stock and low stock never becomes negative", async () => {
  const db = database();
  await commitRequest(request);
  db.get("STOCK#soap").quantity=4;
  await commitRequest({...request,updatedAt:"removed",lines:[]},request);
  assert.equal(db.get("STOCK#soap").quantity,0);
  assert.equal(db.get("ITEM#soap").targetQty,300);
});

test("clearing event history preserves stock", async () => {
  const db = database();
  await commitRequest(request);
  assert.equal(await deleteAllRequests(), 1);
  assert.equal(db.has("REQUEST#request"),false);
  assert.equal(db.get("STOCK#soap").quantity,69);
});
test("failed delete transaction retains both stock and request", async () => {
  const db = database(300,3);
  db.set("REQUEST#request",{...request});
  await assert.rejects(deleteRequest(request.id,request,"admin"));
  assert.equal(db.get("STOCK#soap").quantity,59);
  assert.equal(db.has("REQUEST#request"),true);
  assert.equal([...db.values()].filter(r=>r.action==="delete_contribution").length,0);
});
test("deleting a contribution to a removed catalog item does not recreate stock", async () => {
  const db = database();
  await commitRequest(request);
  db.delete("ITEM#soap"); db.delete("STOCK#soap");
  await deleteRequest(request.id,request,"admin");
  assert.equal(db.has("STOCK#soap"),false);
  assert.equal(db.has("REQUEST#request"),false);
});
