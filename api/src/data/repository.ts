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
  return {
    id: String(raw.id),
    userId: String(raw.userId),
    userName: String(raw.userName),
    userEmail: raw.userEmail ? String(raw.userEmail) : undefined,
    status: raw.status as RequestStatus,
    lines: (raw.lines as ContributionRequest["lines"]) ?? [],
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
  };
}
