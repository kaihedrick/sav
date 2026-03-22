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
  return handleRequest(event);
}
