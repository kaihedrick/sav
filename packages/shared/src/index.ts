export type UserRole = "admin" | "contributor";

export type RequestStatus = "pending" | "received" | "not_brought";

export interface Item {
  id: string;
  name: string;
  category: string;
  targetQty: number;
  notes?: string;
  imageUrl?: string;
  hidden?: boolean;
  sortPriority: number;
  createdAt: string;
  updatedAt: string;
}

export interface StockRow {
  itemId: string;
  quantity: number;
}

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

export interface ItemWithStock extends Item {
  onHand: number;
  projected: number;
  /** priority score: higher = more urgent (lower effective stock vs target) */
  priorityScore: number;
}
