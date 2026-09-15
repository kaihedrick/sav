import type { ContributionRequest, RequestLine } from "./types.js";
import { randomUUID } from "node:crypto";

const ORG = "ORG#default";

export function canContributorEdit(r: ContributionRequest, userId: string): boolean {
  return r.userId === userId;
}

export function canContributorDelete(r: ContributionRequest, userId: string): boolean {
  return r.userId === userId;
}

/** History entries can be corrected later by their owner or an admin. */
export function assertLinesPositive(lines: RequestLine[]): void {
  for (const l of lines) {
    if (!l.itemId || typeof l.qty !== "number" || l.qty < 1) {
      throw new Error("Each line needs itemId and qty >= 1");
    }
  }
}

export function withItemNames(
  lines: RequestLine[],
  nameById: Map<string, string>,
): RequestLine[] {
  return lines.map((l) => ({
    itemId: l.itemId,
    qty: l.qty,
    itemName: nameById.get(l.itemId) ?? l.itemName ?? "Unknown item",
  }));
}

export function newRequest(input: {
  userId: string;
  userName: string;
  userEmail?: string;
  lines: RequestLine[];
}): ContributionRequest {
  assertLinesPositive(input.lines);
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    userId: input.userId,
    userName: input.userName,
    userEmail: input.userEmail,
    status: "recorded",
    lines: input.lines,
    createdAt: now,
    updatedAt: now,
  };
}

export function mergeRequestUpdate(
  existing: ContributionRequest,
  lines: RequestLine[],
  userId: string,
  asAdmin = false,
): ContributionRequest {
  if (!asAdmin && existing.userId !== userId) throw new Error("Forbidden");
  assertLinesPositive(lines);
  return {
    ...existing,
    lines,
    updatedAt: new Date().toISOString(),
  };
}

export { ORG };
