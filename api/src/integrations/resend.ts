import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

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

  const to = process.env.ADMIN_EMAIL;
  const from = process.env.RESEND_FROM ?? "Bags of Blessings <onboarding@resend.dev>";
  const base = process.env.APP_BASE_URL ?? "http://localhost:5173";
  const link = `${base.replace(/\/$/, "")}/admin/requests`;

  if (!to) return { ok: false, error: "ADMIN_EMAIL not set" };

  const { Resend } = await import("resend");
  const resend = new Resend(key);
  const subject = `Bags of Blessings: update from ${params.contributorName}`;
  const html = `
    <p><strong>${escapeHtml(params.contributorName)}</strong> submitted or updated a request.</p>
    <p>${escapeHtml(params.summary)}</p>
    <p><a href="${link}">Open request inbox</a></p>
  `;

  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject,
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
