import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { allAdminEmails } from "../domain/adminService.js";
import { adminEmailsWantingRequestNotify } from "../data/repository.js";

let cachedKey: string | null = null;

async function getApiKey(): Promise<string | null> {
  if (process.env.RESEND_API_KEY) return process.env.RESEND_API_KEY;
  const arn = process.env.RESEND_SECRET_ARN;
  if (!arn || arn === "none") return null;
  if (cachedKey) return cachedKey;
  const sm = new SecretsManagerClient({});
  const out = await sm.send(new GetSecretValueCommand({ SecretId: arn }));
  const s = out.SecretString;
  if (!s) return null;
  try {
    const j = JSON.parse(s) as { apiKey?: string };
    cachedKey = j.apiKey ?? s;
  } catch {
    cachedKey = s;
  }
  return cachedKey;
}

export async function notifyAdminRequest(params: {
  contributorName: string;
  contributorEmail?: string;
  summary: string;
}): Promise<{ ok: boolean; error?: string }> {
  const key = await getApiKey();
  if (!key) return { ok: false, error: "Resend not configured" };

  const admins = await allAdminEmails();
  const to = await adminEmailsWantingRequestNotify(admins);
  if (to.length === 0) {
    return { ok: true, error: "No admins opted in for request emails" };
  }

  const from = process.env.RESEND_FROM ?? "Bags of Blessings <onboarding@resend.dev>";
  const base = process.env.APP_BASE_URL ?? "http://localhost:5173";
  const link = `${base.replace(/\/$/, "")}/admin/requests`;

  const { Resend } = await import("resend");
  const resend = new Resend(key);
  const who = params.contributorEmail
    ? `${params.contributorName} (${params.contributorEmail})`
    : params.contributorName;
  const subject = `Bags of Blessings: ${params.contributorName} — ${params.summary}`;
  const html = `
    <p><strong>${escapeHtml(who)}</strong> submitted or updated a purchase request.</p>
    <p><strong>Items:</strong> ${escapeHtml(params.summary)}</p>
    <p><a href="${link}">Open request inbox</a></p>
  `;

  const { error } = await resend.emails.send({
    from,
    to,
    subject: subject.length > 120 ? subject.slice(0, 117) + "…" : subject,
    html,
  });

  if (error) return { ok: false, error: String(error.message ?? error) };
  return { ok: true };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
