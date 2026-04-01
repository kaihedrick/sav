import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

export interface AuthUser {
  sub: string;
  email?: string;
  name?: string;
  groups: string[];
}

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

let cachedJwtSecret: Uint8Array | null = null;

async function getJwtSecretBytes(): Promise<Uint8Array> {
  if (cachedJwtSecret) return cachedJwtSecret;
  const arn = process.env.SESSION_JWT_SECRET_ARN;
  if (!arn) throw new Error("SESSION_JWT_SECRET_ARN not set");
  const sm = new SecretsManagerClient({});
  const out = await sm.send(new GetSecretValueCommand({ SecretId: arn }));
  const s = out.SecretString;
  if (!s) throw new Error("Empty session JWT secret");
  cachedJwtSecret = new TextEncoder().encode(s);
  return cachedJwtSecret;
}

/** Verify Google Sign-In ID token (GIS credential JWT). */
export async function verifyGoogleIdToken(idToken: string): Promise<{
  sub: string;
  email: string;
  name?: string;
  givenName?: string;
  familyName?: string;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID not set");
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });
  const email = typeof payload.email === "string" ? payload.email : "";
  if (!email) throw new Error("Google token missing email");
  return {
    sub: String(payload.sub),
    email,
    name: typeof payload.name === "string" ? payload.name : undefined,
    givenName:
      typeof payload.given_name === "string" ? payload.given_name : undefined,
    familyName:
      typeof payload.family_name === "string" ? payload.family_name : undefined,
  };
}

/** One or more admin emails: `ADMIN_EMAIL` may be comma- or semicolon-separated. */
function adminEmailList(): string[] {
  const raw = process.env.ADMIN_EMAIL ?? "";
  return raw
    .split(/[,;]/)
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean);
}

export async function mintSessionJwt(input: {
  sub: string;
  email: string;
  name?: string;
  /** Preferred display name (e.g. from saved profile). */
  displayName?: string;
}): Promise<string> {
  const admins = adminEmailList();
  const email = input.email.toLowerCase().trim();
  const role =
    admins.length > 0 && admins.includes(email) ? "admin" : "contributor";
  const secret = await getJwtSecretBytes();
  const display =
    input.displayName?.trim() || input.name?.trim() || "";
  return new SignJWT({
    email: input.email,
    name: display,
    role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.sub)
    .setIssuer("bags-api")
    .setAudience("bags-web")
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyBearerToken(token: string): Promise<AuthUser> {
  const secret = await getJwtSecretBytes();
  const { payload } = await jwtVerify(token, secret, {
    issuer: "bags-api",
    audience: "bags-web",
    algorithms: ["HS256"],
  });
  const role = typeof payload.role === "string" ? payload.role : "contributor";
  return {
    sub: String(payload.sub),
    email: typeof payload.email === "string" ? payload.email : undefined,
    name: typeof payload.name === "string" ? String(payload.name) : undefined,
    groups: role === "admin" ? ["admin"] : [],
  };
}

export function isAdmin(user: AuthUser): boolean {
  if (user.groups.includes("admin")) return true;
  const email = user.email?.toLowerCase().trim();
  if (!email) return false;
  const admins = adminEmailList();
  return admins.length > 0 && admins.includes(email);
}
