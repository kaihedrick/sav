/** True if this looks like our API-issued session JWT (not e.g. a leftover Cognito RS256 token). */
export function isAppSessionToken(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const headerJson = atob(parts[0].replace(/-/g, "+").replace(/_/g, "/"));
    const header = JSON.parse(headerJson) as { alg?: string };
    if (header.alg !== "HS256") return false;
    const payload = decodeJwtPayload(token);
    return payload.iss === "bags-api";
  } catch {
    return false;
  }
}

/** Decode app session JWT payload (unsigned — only for UI hints; API re-verifies). */
export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) return {};
  const p = parts[1];
  const json = atob(p.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json) as Record<string, unknown>;
}

/** `adminEmail` may be comma/semicolon-separated (same idea as Lambda `ADMIN_EMAIL`). */
export function isAdminFromToken(token: string, adminEmail?: string): boolean {
  const pl = decodeJwtPayload(token);
  if (pl.role === "admin") return true;
  const email = String(pl.email ?? "").toLowerCase().trim();
  if (!email || !adminEmail?.trim()) return false;
  const admins = adminEmail
    .split(/[,;]/)
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean);
  return admins.includes(email);
}
