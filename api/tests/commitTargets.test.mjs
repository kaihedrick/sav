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
      export class PutCommand {} export class QueryCommand {} export class DeleteCommand {}
    ` }));
  },
}] });
const { commitRequest } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
process.env.TABLE_NAME = "test";
const request = { id: "request", userId: "u", userName: "Person", status: "pending", createdAt: "start", updatedAt: "start", lines: [{ itemId: "soap", qty: 10 }] };
function database(target = 300, failCount = 0) {
  const rows = new Map([["ITEM#soap", { id: "soap", name: "Soap", category: "Hygiene", targetQty: target, sortPriority: 0, createdAt: "old", updatedAt: "old" }]]);
  let calls = 0;
  globalThis.commitDb = async command => {
    if (command.kind === "get") return { Item: rows.get(command.input.Key.sk) };
    calls++;
    const ops = command.input.TransactItems;
    const conflict = () => { const error = new Error("Conflict"); error.name = "TransactionCanceledException"; throw error; };
    if (calls <= failCount) conflict();
    for (const op of ops) {
      if (op.Put) {
        const existing = rows.get(op.Put.Item.sk);
        if (op.Put.ConditionExpression.includes("attribute_not_exists") ? !!existing : existing?.updatedAt !== op.Put.ExpressionAttributeValues[":expected"]) conflict();
      } else if (rows.get(op.Update.Key.sk)?.targetQty !== op.Update.ExpressionAttributeValues[":expected"]) conflict();
    }
    for (const op of ops) {
      if (op.Put) rows.set(op.Put.Item.sk, { ...op.Put.Item });
      else rows.set(op.Update.Key.sk, { ...rows.get(op.Update.Key.sk), targetQty: op.Update.ExpressionAttributeValues[":next"], updatedAt: op.Update.ExpressionAttributeValues[":now"] });
    }
    return {};
  };
  return rows;
}
test("commit reduces target; retry of the same request cannot subtract twice", async () => {
  const db = database();
  assert.equal(await commitRequest(request), true);
  assert.equal(db.get("ITEM#soap").targetQty, 290);
  assert.equal(await commitRequest(request), false);
  assert.equal(db.get("ITEM#soap").targetQty, 290);
});
test("concurrent commits retry the latest remaining target without losing either quantity", async () => {
  const db = database();
  await Promise.all([commitRequest(request), commitRequest({ ...request, id: "other" })]);
  assert.equal(db.get("ITEM#soap").targetQty, 280);
});
test("only added quantity reduces target; reductions require manual rollback", async () => {
  const db = database();
  await commitRequest(request);
  const increased = { ...request, updatedAt: "later", lines: [{ itemId: "soap", qty: 15 }] };
  await commitRequest(increased, request);
  assert.equal(db.get("ITEM#soap").targetQty, 285);
  await commitRequest({ ...request, updatedAt: "latest", lines: [{ itemId: "soap", qty: 3 }] }, increased);
  assert.equal(db.get("ITEM#soap").targetQty, 285);
});
test("targets stop at zero; multiple lines for the same item are combined", async () => {
  const db = database(12);
  await commitRequest({ ...request, lines: [{ itemId: "soap", qty: 10 }, { itemId: "soap", qty: 10 }] });
  assert.equal(db.get("ITEM#soap").targetQty, 0);
});
test("failed transaction or missing item leaves targets and requests untouched", async () => {
  const db = database(300, 3);
  await assert.rejects(commitRequest(request));
  assert.equal(db.get("ITEM#soap").targetQty, 300);
  assert.equal(db.has("REQUEST#request"), false);
  database();
  await assert.rejects(commitRequest({ ...request, lines: [{ itemId: "missing", qty: 10 }] }), /no longer available/);
});
