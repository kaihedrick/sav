import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const result = await build({ entryPoints: ["src/domain/requestService.ts"], bundle: true, write: false, platform: "node", format: "esm" });
const { canContributorEdit, canContributorDelete, newRequest, mergeRequestUpdate } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
const entry = newRequest({ userId: "owner", userName: "Person", lines: [{ itemId: "soap", qty: 5 }] });
test("new contributions are recorded immediately without arrival approval", () => assert.equal(entry.status, "recorded"));
test("owners can correct legacy history regardless of arrival status", () => {
  for (const status of ["pending", "received", "not_brought", "recorded"]) {
    const old = { ...entry, status };
    assert.equal(canContributorEdit(old, "owner"), true);
    assert.equal(canContributorDelete(old, "owner"), true);
    assert.equal(mergeRequestUpdate(old, [{ itemId: "soap", qty: 7 }], "owner").lines[0].qty, 7);
    assert.equal(mergeRequestUpdate(old, [{ itemId: "soap", qty: 7 }], "admin", true).lines[0].qty, 7);
    assert.equal(canContributorEdit(old, "stranger"), false);
    assert.equal(canContributorDelete(old, "stranger"), false);
    assert.throws(() => mergeRequestUpdate(old, old.lines, "stranger"), /Forbidden/);
  }
});
