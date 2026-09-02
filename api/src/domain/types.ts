export type RequestStatus = "pending" | "received" | "not_brought";

export interface RequestLine {
  itemId: string;
  qty: number;
  /** Snapshot of catalog name at write time (also filled on read when missing). */
  itemName?: string;
}

export interface ContributionRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  status: RequestStatus;
  lines: RequestLine[];
  createdAt: string;
  updatedAt: string;
}

export interface ItemEntity {
  id: string;
  name: string;
  category: string;
  targetQty: number;
  /** Optional reference / budget line (Excel “Price” column). */
  price?: number;
  notes?: string;
  /** Public HTTP(S) photo URL for this catalog item. */
  imageUrl?: string;
  /** When true, the item is omitted from the public Needs list. */
  hidden?: boolean;
  sortPriority: number;
  createdAt: string;
  updatedAt: string;
}

/** Stored at sk USER#{sub} */
export interface UserProfile {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  updatedAt: string;
}

/** Stored at sk SETTINGS */
export interface OrgSettings {
  eventDate: string;
  updatedAt: string;
}

/** Extra admin emails granted in-app (merged with Lambda ADMIN_EMAIL). */
export interface OrgAdminGrant {
  adminEmails: string[];
  updatedAt: string;
}
