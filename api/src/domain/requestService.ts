import type { ContributionRequest, RequestLine, RequestStatus } from "./types.js";
import { randomUUID } from "node:crypto";

const ORG = "ORG#default";

export function canContributorEdit(r: ContributionRequest, userId: string): boolean {
  return r.userId === userId && r.status === "pending";
}

export function canContributorDelete(r: ContributionRequest, userId: string): boolean {
  if (r.userId !== userId) return false;
  return r.status === "pending" || r.status === "rejected";
}

/** After event, only pending-like might be locked — allow admin to set received */
export function assertLinesPositive(lines: RequestLine[]): void {
  for (const l of lines) {
    if (!l.itemId || typeof l.qty !== "number" || l.qty < 1) {
      throw new Error("Each line needs itemId and qty >= 1");
    }
  }
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
    status: "pending",
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
  if (!asAdmin && existing.status !== "pending") {
    throw new Error("Only pending requests can be edited by contributor");
  }
  if (asAdmin && existing.status !== "pending") {
    throw new Error("Admin can only edit lines while request is pending");
  }
  assertLinesPositive(lines);
  return {
    ...existing,
    lines,
    updatedAt: new Date().toISOString(),
  };
}

export { ORG };
