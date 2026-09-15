import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const result = await build({ entryPoints: ["src/lib/requestEmail.ts"], bundle: true, write: false, platform: "node", format: "esm" });
const { buildRequestEmail } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
const input = {
  contributorName: "Sample Contributor", contributorEmail: "sample@example.com", requestId: "request-123",
  updated: false, eventDate: "2026-10-03", inboxUrl: "https://www.bagsofblessings.net/admin/requests",
  items: [{ name: "Soap", quantity: 12, category: "Hygiene", packType: "6-pack", imageUrl: "https://example.com/soap.jpg" }, { name: "Socks", quantity: 8 }],
};
test("email includes quantities, photo, missing-image fallback and complete plain text", () => {
  const email = buildRequestEmail(input);
  assert.match(email.html, /20 total items/);
  assert.match(email.html, /src="https:\/\/example.com\/soap.jpg"/);
  assert.match(email.html, /alt="Soap"/);
  assert.match(email.html, /No item photo/);
  assert.match(email.text, /12 × Soap \(Hygiene\)/);
  assert.match(email.text, /8 × Socks/);
  assert.match(email.text, /2026-10-03/);
  assert.doesNotMatch(email.html, /Pending arrival|Received/);
  assert.match(email.text, /request-123/);
  assert.match(email.text, /Pack: 6-pack/);
  assert.match(email.html, /Pack: 6-pack/);
});
test("updated notifications make clear that this is the current full contribution", () => {
  const email = buildRequestEmail({ ...input, updated: true });
  assert.match(email.subject, /Updated contribution/);
  assert.match(email.html, /current contribution/);
  assert.match(email.text, /Contribution updated/);
});
test("untrusted names, categories and image URLs cannot inject email markup", () => {
  const email = buildRequestEmail({ ...input, contributorName: '<script>bad</script>',
    items: [{ name: '<img onerror="bad">', category: '<b>bad</b>', quantity: 3, imageUrl: 'javascript:alert(1)' }] });
  assert.doesNotMatch(email.html, /<script>|<b>bad<\/b>|javascript:|<img onerror/);
  assert.match(email.html, /&lt;img onerror=&quot;bad&quot;&gt;/);
  assert.match(email.html, /No item photo/);
});
test("optional contributor email and event date do not leave broken placeholders", () => {
  const email = buildRequestEmail({ ...input, contributorEmail: undefined, eventDate: undefined });
  assert.doesNotMatch(email.html, /undefined|Event date:|reply to this email/);
  assert.doesNotMatch(email.text, /undefined|Event date:/);
});
