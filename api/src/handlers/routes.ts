import type {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { z, ZodError } from "zod";
import {
  verifyBearerToken,
  isAdmin,
  verifyGoogleIdToken,
  mintSessionJwt,
} from "../lib/auth.js";
import * as repo from "../data/repository.js";
import {
  newRequest,
  mergeRequestUpdate,
  canContributorEdit,
  canContributorDelete,
} from "../domain/requestService.js";
import { projectedQtyForItem, sortItemsByPriority } from "../domain/projections.js";
import type { ItemEntity, RequestStatus } from "../domain/types.js";
import { randomUUID } from "node:crypto";
import { notifyAdminRequest } from "../integrations/resend.js";

const lineSchema = z.object({
  itemId: z.string().min(1),
  qty: z.number().int().positive(),
});

const corsHeaders = (origin?: string) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Headers": "authorization,content-type",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
});

function json(
  statusCode: number,
  body: unknown,
  origin?: string,
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    body: JSON.stringify(body),
  };
}

/**
 * Normalize route path: HTTP API v2 uses rawPath; REST (v1) uses path. Some
 * integrations omit a leading slash (`auth/google`) which would otherwise skip
 * `/auth/google` matching and fall through to requireUser → "Missing bearer token".
 */
function httpRoutePath(event: APIGatewayProxyEventV2 | APIGatewayProxyEvent): string {
  let raw: string | undefined;
  if ("rawPath" in event && typeof event.rawPath === "string" && event.rawPath) {
    raw = event.rawPath;
  } else if ("path" in event && typeof event.path === "string" && event.path) {
    raw = event.path;
  } else if (
    "requestContext" in event &&
    event.requestContext &&
    "http" in event.requestContext
  ) {
    const http = (event.requestContext as APIGatewayProxyEventV2["requestContext"])
      .http;
    if (http && typeof http.path === "string") raw = http.path;
  }
  const noQuery = (raw ?? "/").split("?")[0] ?? "/";
  let p = noQuery.replace(/\/$/, "") || "/";
  if (!p.startsWith("/")) p = `/${p}`;
  return p;
}

function httpMethodFromEvent(
  event: APIGatewayProxyEventV2 | APIGatewayProxyEvent,
): string {
  if ("httpMethod" in event && typeof event.httpMethod === "string") {
    return event.httpMethod;
  }
  if (
    "requestContext" in event &&
    event.requestContext &&
    "http" in event.requestContext
  ) {
    const m = (event.requestContext as APIGatewayProxyEventV2["requestContext"])
      .http?.method;
    if (typeof m === "string") return m;
  }
  return "GET";
}

/** POST …/auth/google with any prefix (e.g. stage) or missing leading slash on raw path. */
function isPostAuthGoogle(method: string, path: string): boolean {
  if (method.toUpperCase() !== "POST") return false;
  const segs = path.split("/").filter(Boolean);
  if (segs.length < 2) return false;
  const a = segs[segs.length - 2]?.toLowerCase();
  const b = segs[segs.length - 1]?.toLowerCase();
  return a === "auth" && b === "google";
}

async function requireUser(
  event: APIGatewayProxyEventV2 | APIGatewayProxyEvent,
  origin?: string,
) {
  const h = event.headers?.authorization ?? event.headers?.Authorization;
  if (!h?.startsWith("Bearer ")) {
    return { error: json(401, { error: "Missing bearer token" }, origin) };
  }
  const token = h.slice(7);
  try {
    const user = await verifyBearerToken(token);
    return { user };
  } catch {
    return { error: json(401, { error: "Invalid token" }, origin) };
  }
}

export async function handleRequest(
  event: APIGatewayProxyEventV2 | APIGatewayProxyEvent,
): Promise<APIGatewayProxyResultV2> {
  const origin =
    event.headers?.origin ?? event.headers?.Origin ?? undefined;
  const method = httpMethodFromEvent(event);
  const path = httpRoutePath(event);

  if (method === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(origin), body: "" };
  }

  if (path === "/health" && method === "GET") {
    return json(200, { ok: true }, origin);
  }

  if (isPostAuthGoogle(method, path)) {
    try {
      const body = JSON.parse(event.body || "{}");
      const { credential } = z
        .object({ credential: z.string().min(20) })
        .parse(body);
      const google = await verifyGoogleIdToken(credential);
      const accessToken = await mintSessionJwt(google);
      return json(
        200,
        { accessToken, expiresIn: 7 * 24 * 3600 },
        origin,
      );
    } catch (e) {
      let msg = e instanceof Error ? e.message : "Auth failed";
      if (e instanceof ZodError) msg = "Invalid sign-in payload";
      return json(401, { error: msg }, origin);
    }
  }

  const auth = await requireUser(event, origin);
  if ("error" in auth && auth.error) return auth.error;
  const { user } = auth as { user: import("../lib/auth.js").AuthUser };
  const admin = isAdmin(user);

  try {
    /* ---------- inventory summary ---------- */
    if (path === "/inventory" && method === "GET") {
      const items = await repo.listItems();
      const requests = await repo.listAllRequests();
      const withStock = await Promise.all(
        items.map(async (it) => {
          const onHand = await repo.getStock(it.id);
          const projected = projectedQtyForItem(it.id, requests);
          return {
            ...it,
            onHand,
            projected,
            priorityScore:
              Math.max(0, it.targetQty - onHand - projected) * 1000 + projected,
          };
        }),
      );
      const sorted = sortItemsByPriority(withStock);
      return json(200, { items: sorted }, origin);
    }

    /* ---------- admin items CRUD ---------- */
    if (path === "/items" && method === "POST") {
      if (!admin) return json(403, { error: "Admin only" }, origin);
      const body = JSON.parse(event.body || "{}");
      const schema = z.object({
        name: z.string().min(1),
        category: z.string().optional(),
        targetQty: z.number().int().nonnegative(),
        notes: z.string().optional(),
        sortPriority: z.number().int().optional(),
      });
      const p = schema.parse(body);
      const now = new Date().toISOString();
      const id = randomUUID();
      const entity: ItemEntity = {
        id,
        name: p.name,
        category: p.category ?? "",
        targetQty: p.targetQty,
        notes: p.notes,
        sortPriority: p.sortPriority ?? 0,
        createdAt: now,
        updatedAt: now,
      };
      await repo.putItem(entity);
      await repo.setStock(id, 0);
      return json(201, entity, origin);
    }

    const itemIdMatch = path.match(/^\/items\/([^/]+)$/);
    if (itemIdMatch && method === "PATCH") {
      if (!admin) return json(403, { error: "Admin only" }, origin);
      const id = itemIdMatch[1];
      const existing = await repo.getItem(id);
      if (!existing) return json(404, { error: "Not found" }, origin);
      const body = JSON.parse(event.body || "{}");
      const schema = z.object({
        name: z.string().optional(),
        category: z.string().optional(),
        targetQty: z.number().int().nonnegative().optional(),
        notes: z.string().optional(),
        sortPriority: z.number().int().optional(),
      });
      const p = schema.parse(body);
      const updated: ItemEntity = {
        ...existing,
        ...p,
        updatedAt: new Date().toISOString(),
      };
      await repo.putItem(updated);
      return json(200, updated, origin);
    }

    if (itemIdMatch && method === "DELETE") {
      if (!admin) return json(403, { error: "Admin only" }, origin);
      const id = itemIdMatch[1];
      await repo.deleteItem(id);
      return json(200, { ok: true }, origin);
    }

    const stockMatch = path.match(/^\/items\/([^/]+)\/stock$/);
    if (stockMatch && method === "PATCH") {
      if (!admin) return json(403, { error: "Admin only" }, origin);
      const id = stockMatch[1];
      const body = JSON.parse(event.body || "{}");
      const p = z.object({ quantity: z.number().int().nonnegative() }).parse(body);
      await repo.setStock(id, p.quantity);
      return json(200, { itemId: id, quantity: p.quantity }, origin);
    }

    /* ---------- requests ---------- */
    if (path === "/my-requests" && method === "GET") {
      const mine = await repo.listRequestsByUser(user.sub);
      return json(200, { requests: mine }, origin);
    }

    if (path === "/admin/requests" && method === "GET") {
      if (!admin) return json(403, { error: "Admin only" }, origin);
      const all = await repo.listAllRequests();
      return json(200, { requests: all }, origin);
    }

    if (path === "/requests" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const p = z.object({ lines: z.array(lineSchema).min(1) }).parse(body);
      const r = newRequest({
        userId: user.sub,
        userName: user.name ?? user.email ?? "Contributor",
        userEmail: user.email,
        lines: p.lines,
      });
      await repo.putRequest(r);
      await notifyAdminRequest({
        contributorName: r.userName,
        contributorEmail: r.userEmail,
        summary: summarizeLines(r.lines),
      });
      return json(201, r, origin);
    }

    const reqMatch = path.match(/^\/requests\/([^/]+)$/);
    if (reqMatch && method === "PATCH") {
      const id = reqMatch[1];
      const existing = await repo.getRequest(id);
      if (!existing) return json(404, { error: "Not found" }, origin);
      const body = JSON.parse(event.body || "{}");
      const p = z.object({ lines: z.array(lineSchema).min(1) }).parse(body);
      if (!canContributorEdit(existing, user.sub) && !admin) {
        return json(403, { error: "Forbidden" }, origin);
      }
      const updated = mergeRequestUpdate(existing, p.lines, user.sub, admin);
      await repo.putRequest(updated);
      if (!admin) {
        await notifyAdminRequest({
          contributorName: updated.userName,
          contributorEmail: updated.userEmail,
          summary: `Updated request: ${summarizeLines(updated.lines)}`,
        });
      }
      return json(200, updated, origin);
    }

    if (reqMatch && method === "DELETE") {
      const id = reqMatch[1];
      const existing = await repo.getRequest(id);
      if (!existing) return json(404, { error: "Not found" }, origin);
      if (!canContributorDelete(existing, user.sub) && !admin) {
        return json(403, { error: "Forbidden" }, origin);
      }
      await repo.deleteRequest(id);
      return json(200, { ok: true }, origin);
    }

    const statusMatch = path.match(/^\/admin\/requests\/([^/]+)\/status$/);
    if (statusMatch && method === "PATCH") {
      if (!admin) return json(403, { error: "Admin only" }, origin);
      const id = statusMatch[1];
      const existing = await repo.getRequest(id);
      if (!existing) return json(404, { error: "Not found" }, origin);
      const body = JSON.parse(event.body || "{}");
      const p = z
        .object({ status: z.enum(["pending", "rejected", "received", "not_brought"]) })
        .parse(body);
      const updated = {
        ...existing,
        status: p.status as RequestStatus,
        updatedAt: new Date().toISOString(),
      };
      await repo.putRequest(updated);
      return json(200, updated, origin);
    }

    const consumeMatch = path === "/admin/stock/consume" && method === "POST";
    if (consumeMatch) {
      if (!admin) return json(403, { error: "Admin only" }, origin);
      const body = JSON.parse(event.body || "{}");
      const p = z
        .object({
          items: z.array(z.object({ itemId: z.string(), quantity: z.number().int().positive() })),
        })
        .parse(body);
      const results: { itemId: string; quantity: number }[] = [];
      for (const row of p.items) {
        const q = await repo.adjustStock(row.itemId, -row.quantity);
        results.push({ itemId: row.itemId, quantity: q });
      }
      return json(200, { results }, origin);
    }

    if (path === "/admin/seed" && method === "POST") {
      if (!admin) return json(403, { error: "Admin only" }, origin);
      const existing = await repo.listItems();
      if (existing.length > 0) {
        return json(400, { error: "Already seeded" }, origin);
      }
      const now = new Date().toISOString();
      const samples = [
        { name: "Toothbrushes", category: "Hygiene", targetQty: 50, sortPriority: 1 },
        { name: "Soap bars", category: "Hygiene", targetQty: 40, sortPriority: 2 },
        { name: "Socks", category: "Clothing", targetQty: 60, sortPriority: 3 },
        { name: "Granola bars", category: "Food", targetQty: 100, sortPriority: 4 },
      ];
      for (const s of samples) {
        const id = randomUUID();
        const entity = {
          id,
          name: s.name,
          category: s.category,
          targetQty: s.targetQty,
          notes: "",
          sortPriority: s.sortPriority,
          createdAt: now,
          updatedAt: now,
        };
        await repo.putItem(entity);
        await repo.setStock(id, 5);
      }
      return json(201, { ok: true, count: samples.length }, origin);
    }

    if (path === "/export.csv" && method === "GET") {
      if (!admin) return json(403, { error: "Admin only" }, origin);
      const items = await repo.listItems();
      const requests = await repo.listAllRequests();
      const lines = [
        "itemId,name,category,targetQty,onHand,projected",
        ...(await Promise.all(
          items.map(async (it) => {
            const onHand = await repo.getStock(it.id);
            const projected = projectedQtyForItem(it.id, requests);
            return [it.id, csvEscape(it.name), csvEscape(it.category), it.targetQty, onHand, projected].join(",");
          }),
        )),
      ];
      const csv = lines.join("\n");
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="inventory.csv"',
          ...corsHeaders(origin),
        },
        body: csv,
      };
    }

    return json(404, { error: "Not found" }, origin);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return json(400, { error: msg }, origin);
  }
}

function summarizeLines(lines: { itemId: string; qty: number }[]): string {
  return lines.map((l) => `${l.itemId.slice(0, 8)}… × ${l.qty}`).join(", ");
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
