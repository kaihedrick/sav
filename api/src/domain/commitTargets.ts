import type { RequestLine } from "./types.js";

/** Only additional commitments increase stock. Reductions/cancellations are corrected manually. */
export function additionalCommitments(lines: RequestLine[], previous: RequestLine[] = []): Map<string, number> {
  const totals = (rows: RequestLine[]) => {
    const result = new Map<string, number>();
    for (const row of rows) result.set(row.itemId, (result.get(row.itemId) ?? 0) + row.qty);
    return result;
  };
  const before = totals(previous);
  return new Map([...totals(lines)].map(([id, qty]) => [id, Math.max(0, qty - (before.get(id) ?? 0))]).filter(([, qty]) => Number(qty) > 0) as [string, number][]);
}
