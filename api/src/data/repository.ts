import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type { ItemEntity, ContributionRequest, RequestStatus } from "../domain/types.js";
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

export async function adjustStock(itemId: string, delta: number): Promise<number> {
  const current = await getStock(itemId);
  const next = Math.max(0, current + delta);
  await setStock(itemId, next);
  return next;
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

function entityAttrs(e: ItemEntity) {
  return {
    id: e.id,
    name: e.name,
    category: e.category,
    targetQty: e.targetQty,
    notes: e.notes ?? "",
    sortPriority: e.sortPriority,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

function itemFromAttrs(raw: Record<string, unknown>): ItemEntity {
  return {
    id: String(raw.id),
    name: String(raw.name),
    category: String(raw.category ?? ""),
    targetQty: Number(raw.targetQty ?? 0),
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
