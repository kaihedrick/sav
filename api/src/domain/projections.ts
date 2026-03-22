import type { ContributionRequest, RequestLine, RequestStatus } from "./types.js";

/** Pending (and received-not-finalized) counts toward projected; rejected does not. */
export function lineCountsTowardProjection(status: RequestStatus): boolean {
  return status === "pending";
}

export function projectedQtyForItem(
  itemId: string,
  requests: ContributionRequest[],
): number {
  let sum = 0;
  for (const r of requests) {
    if (!lineCountsTowardProjection(r.status)) continue;
    for (const line of r.lines) {
      if (line.itemId === itemId) sum += line.qty;
    }
  }
  return sum;
}

export function priorityScore(
  targetQty: number,
  onHand: number,
  projected: number,
): number {
  const need = Math.max(0, targetQty - onHand - projected);
  return need * 1000 + projected;
}

export function sortItemsByPriority<
  T extends { targetQty: number; onHand: number; projected: number },
>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      priorityScore(b.targetQty, b.onHand, b.projected) -
      priorityScore(a.targetQty, a.onHand, a.projected),
  );
}
