import * as repo from "../data/repository.js";

/** `ADMIN_EMAIL` env (comma/semicolon-separated). */
export function adminEmailsFromEnv(): string[] {
  const raw = process.env.ADMIN_EMAIL ?? "";
  return raw
    .split(/[,;]/)
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean);
}

/** Env admins + Dynamo-granted admins (unique, sorted). */
export async function allAdminEmails(): Promise<string[]> {
  const dynamo = await repo.getOrgAdminEmails();
  const merged = new Set<string>([...adminEmailsFromEnv(), ...dynamo]);
  return [...merged].sort((a, b) => a.localeCompare(b));
}

export async function isAdminEmail(email: string): Promise<boolean> {
  const e = email.toLowerCase().trim();
  if (!e) return false;
  const all = await allAdminEmails();
  return all.includes(e);
}
