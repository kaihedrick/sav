import type { RequestLine } from "./types.js";

/** Signed stock changes, including removed lines; targets remain fixed. */
export function additionalCommitments(lines: RequestLine[], previous: RequestLine[] = []): Map<string, number> {
  const totals = (rows: RequestLine[]) => {
    const result = new Map<string, number>();
    for (const row of rows) result.set(row.itemId, (result.get(row.itemId) ?? 0) + row.qty);
    return result;
  };
  const before = totals(previous);
  const after = totals(lines);
  return new Map([...new Set([...before.keys(), ...after.keys()])]
    .map(id => [id, (after.get(id) ?? 0) - (before.get(id) ?? 0)] as [string, number])
    .filter(([, qty]) => qty !== 0));
}
