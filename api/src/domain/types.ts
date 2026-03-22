export type RequestStatus = "pending" | "rejected" | "received" | "not_brought";

export interface RequestLine {
  itemId: string;
  qty: number;
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
  notes?: string;
  sortPriority: number;
  createdAt: string;
  updatedAt: string;
}
