import type {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from "aws-lambda";
import { handleRequest } from "./handlers/routes.js";

export async function handler(
  event: APIGatewayProxyEventV2 | APIGatewayProxyEvent,
  _context: Context,
): Promise<APIGatewayProxyResultV2> {
  try {
    return await handleRequest(event);
  } catch (e) {
    const origin =
      event.headers?.origin ?? event.headers?.Origin ?? undefined;
    const msg = e instanceof Error ? e.message : "Error";
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": origin || "*",
        "Access-Control-Allow-Headers": "authorization,content-type",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      },
      body: JSON.stringify({ error: msg }),
    };
  }
}
