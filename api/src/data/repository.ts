import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type {
  ItemEntity,
  ContributionRequest,
  RequestStatus,
  UserProfile,
  OrgSettings,
} from "../domain/types.js";
import { ORG } from "../domain/requestService.js";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function tableName(): string {
  const t = process.env.TABLE_NAME;
  if (!t) throw new Error("TABLE_NAME not set");
  return t;
}

const PK = ORG;

export async function listItems(): Promise<ItemEntity[]> {
  const out = await client.send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": PK,
        ":prefix": "ITEM#",
      },
    }),
  );
  return (out.Items ?? []).map(itemFromAttrs);
}

export async function getItem(id: string): Promise<ItemEntity | null> {
  const out = await client.send(
    new GetCommand({
      TableName: tableName(),
      Key: { pk: PK, sk: `ITEM#${id}` },
    }),
  );
  if (!out.Item) return null;
  return itemFromAttrs(out.Item);
}

export async function putItem(entity: ItemEntity): Promise<void> {
  await client.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        pk: PK,
        sk: `ITEM#${entity.id}`,
        gsi1pk: "ITEM",
        gsi1sk: entity.name,
        ...entityAttrs(entity),
      },
    }),
  );
}

export async function deleteItem(id: string): Promise<void> {
  await client.send(
    new DeleteCommand({
      TableName: tableName(),
      Key: { pk: PK, sk: `ITEM#${id}` },
    }),
  );
  await client.send(
    new DeleteCommand({
      TableName: tableName(),
      Key: { pk: PK, sk: `STOCK#${id}` },
    }),
  );
}

/** Deletes every catalog item and its stock row. Returns how many items were removed. */
export async function deleteAllItems(): Promise<number> {
  const items = await listItems();
  for (const it of items) {
    await deleteItem(it.id);
  }
  return items.length;
}

export async function getStock(itemId: string): Promise<number> {
  const out = await client.send(
    new GetCommand({
      TableName: tableName(),
      Key: { pk: PK, sk: `STOCK#${itemId}` },
    }),
  );
  if (!out.Item) return 0;
  return Number(out.Item.quantity ?? 0);
}

export async function setStock(itemId: string, quantity: number): Promise<void> {
  await client.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        pk: PK,
        sk: `STOCK#${itemId}`,
        gsi1pk: "STOCK",
        gsi1sk: itemId,
        itemId,
        quantity,
      },
    }),
  );
}

export async function listAllRequests(): Promise<ContributionRequest[]> {
  const out = await client.send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: "GSI1",
      KeyConditionExpression: "gsi1pk = :gpk",
      ExpressionAttributeValues: { ":gpk": "REQUEST" },
      ScanIndexForward: false,
    }),
  );
  return (out.Items ?? []).map(requestFromAttrs);
}

export async function getRequest(id: string): Promise<ContributionRequest | null> {
  const out = await client.send(
    new GetCommand({
      TableName: tableName(),
      Key: { pk: PK, sk: `REQUEST#${id}` },
    }),
  );
  if (!out.Item) return null;
  return requestFromAttrs(out.Item);
}

export async function putRequest(r: ContributionRequest): Promise<void> {
  await client.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        pk: PK,
        sk: `REQUEST#${r.id}`,
        gsi1pk: "REQUEST",
        gsi1sk: `${r.createdAt}#${r.id}`,
        ...requestAttrs(r),
      },
    }),
  );
}

export async function deleteRequest(id: string): Promise<void> {
  await client.send(
    new DeleteCommand({
      TableName: tableName(),
      Key: { pk: PK, sk: `REQUEST#${id}` },
    }),
  );
}

/** Deletes every contribution request. Returns how many were removed. */
export async function deleteAllRequests(): Promise<number> {
  const all = await listAllRequests();
  for (const r of all) {
    await deleteRequest(r.id);
  }
  return all.length;
}

export async function listRequestsByUser(userId: string): Promise<ContributionRequest[]> {
  const all = await listAllRequests();
  return all.filter((r) => r.userId === userId);
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const out = await client.send(
    new GetCommand({
      TableName: tableName(),
      Key: { pk: PK, sk: `USER#${userId}` },
    }),
  );
  if (!out.Item || String(out.Item.entityType ?? "") !== "USER_PROFILE") {
    return null;
  }
  return userProfileFromAttrs(out.Item as Record<string, unknown>);
}

export async function putUserProfile(input: {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}): Promise<UserProfile> {
  const existing = await getUserProfile(input.userId);
  const now = new Date().toISOString();
  const createdAt = existing?.createdAt ?? now;
  const profile: UserProfile = {
    userId: input.userId,
    email: input.email.trim(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    createdAt,
    updatedAt: now,
  };
  await client.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        pk: PK,
        sk: `USER#${input.userId}`,
        gsi1pk: "USER_PROFILE",
        gsi1sk: profile.email.toLowerCase(),
        entityType: "USER_PROFILE",
        ...userProfileAttrs(profile),
      },
    }),
  );
  return profile;
}

export async function listUserProfiles(): Promise<UserProfile[]> {
  const out = await client.send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: "GSI1",
      KeyConditionExpression: "gsi1pk = :gpk",
      ExpressionAttributeValues: { ":gpk": "USER_PROFILE" },
    }),
  );
  return (out.Items ?? []).map((raw) =>
    userProfileFromAttrs(raw as Record<string, unknown>),
  );
}

export async function getOrgSettings(): Promise<OrgSettings | null> {
  const raw = await getSettingsRecord();
  if (!raw) return null;
  const eventDate = String(raw.eventDate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return null;
  return {
    eventDate,
    updatedAt: String(raw.updatedAt ?? ""),
  };
}

async function getSettingsRecord(): Promise<Record<string, unknown> | null> {
  const out = await client.send(
    new GetCommand({
      TableName: tableName(),
      Key: { pk: PK, sk: "SETTINGS" },
    }),
  );
  if (!out.Item) return null;
  return out.Item as Record<string, unknown>;
}

async function putSettingsRecord(
  patch: Record<string, unknown>,
): Promise<void> {
  const existing = (await getSettingsRecord()) ?? {};
  const now = new Date().toISOString();
  await client.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        pk: PK,
        sk: "SETTINGS",
        entityType: "ORG_SETTINGS",
        ...existing,
        ...patch,
        updatedAt: now,
      },
    }),
  );
}

export async function getOrgAdminEmails(): Promise<string[]> {
  const raw = await getSettingsRecord();
  if (!raw) return [];
  const list = raw.adminEmails;
  if (!Array.isArray(list)) return [];
  return list
    .map((e) => String(e).toLowerCase().trim())
    .filter((e) => e.includes("@"));
}

export async function addOrgAdminEmail(email: string): Promise<string[]> {
  const normalized = email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Invalid email");
  }
  const current = await getOrgAdminEmails();
  if (current.includes(normalized)) return current;
  const next = [...current, normalized].sort((a, b) => a.localeCompare(b));
  await putSettingsRecord({ adminEmails: next });
  return next;
}

export async function removeOrgAdminEmail(email: string): Promise<string[]> {
  const normalized = email.toLowerCase().trim();
  const current = await getOrgAdminEmails();
  const next = current.filter((e) => e !== normalized);
  if (next.length === current.length) return current;
  await putSettingsRecord({ adminEmails: next });
  return next;
}

/** Record sign-in; preserves saved names, fills from Google when profile is incomplete. */
export async function touchUserOnLogin(input: {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
}): Promise<UserProfile> {
  const existing = await getUserProfile(input.userId);
  const now = new Date().toISOString();
  const firstName =
    existing?.firstName?.trim() || input.firstName?.trim() || "";
  const lastName =
    existing?.lastName?.trim() || input.lastName?.trim() || "";
  const profile: UserProfile = {
    userId: input.userId,
    email: input.email.trim(),
    firstName,
    lastName,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await client.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        pk: PK,
        sk: `USER#${input.userId}`,
        gsi1pk: "USER_PROFILE",
        gsi1sk: profile.email.toLowerCase(),
        entityType: "USER_PROFILE",
        ...userProfileAttrs(profile),
      },
    }),
  );
  return profile;
}

export async function putOrgSettings(eventDate: string): Promise<OrgSettings> {
  const trimmed = eventDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error("eventDate must be YYYY-MM-DD");
  }
  await putSettingsRecord({ eventDate: trimmed });
  const settings = await getOrgSettings();
  if (!settings) throw new Error("Failed to save settings");
  return settings;
}

function userProfileAttrs(p: UserProfile) {
  return {
    userId: p.userId,
    email: p.email,
    firstName: p.firstName,
    lastName: p.lastName,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function userProfileFromAttrs(raw: Record<string, unknown>): UserProfile {
  return {
    userId: String(raw.userId),
    email: String(raw.email ?? ""),
    firstName: String(raw.firstName ?? ""),
    lastName: String(raw.lastName ?? ""),
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
}

function entityAttrs(e: ItemEntity) {
  const out: Record<string, unknown> = {
    id: e.id,
    name: e.name,
    category: e.category,
    targetQty: e.targetQty,
    notes: e.notes ?? "",
    sortPriority: e.sortPriority,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
  if (e.price != null && Number.isFinite(e.price)) {
    out.price = e.price;
  }
  if (e.imageUrl) out.imageUrl = e.imageUrl;
  if (e.hidden) out.hidden = true;
  return out;
}

function itemFromAttrs(raw: Record<string, unknown>): ItemEntity {
  const priceRaw = raw.price;
  let price: number | undefined;
  if (priceRaw != null && priceRaw !== "") {
    const n = Number(priceRaw);
    if (Number.isFinite(n)) price = n;
  }
  return {
    id: String(raw.id),
    name: String(raw.name),
    category: String(raw.category ?? ""),
    targetQty: Number(raw.targetQty ?? 0),
    price,
    notes: raw.notes ? String(raw.notes) : undefined,
    imageUrl: raw.imageUrl ? String(raw.imageUrl) : undefined,
    hidden: raw.hidden === true,
    sortPriority: Number(raw.sortPriority ?? 0),
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
  };
}

function requestAttrs(r: ContributionRequest) {
  return {
    id: r.id,
    userId: r.userId,
    userName: r.userName,
    userEmail: r.userEmail ?? "",
    status: r.status,
    lines: r.lines,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function requestFromAttrs(raw: Record<string, unknown>): ContributionRequest {
  const rawLines = (raw.lines as ContributionRequest["lines"]) ?? [];
  return {
    id: String(raw.id),
    userId: String(raw.userId),
    userName: String(raw.userName),
    userEmail: raw.userEmail ? String(raw.userEmail) : undefined,
    status: raw.status as RequestStatus,
    lines: rawLines.map((l) => ({
      itemId: String(l.itemId),
      qty: Number(l.qty),
      ...(l.itemName ? { itemName: String(l.itemName) } : {}),
    })),
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
  };
}
