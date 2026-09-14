import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { allAdminEmails } from "../domain/adminService.js";
import { adminEmailsWantingRequestNotify, getItem, getOrgSettings } from "../data/repository.js";
import type { ContributionRequest } from "../domain/types.js";
import { buildRequestEmail } from "../lib/requestEmail.js";

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
  request: ContributionRequest;
  updated?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const key = await getApiKey();
  if (!key) return { ok: false, error: "Resend not configured" };

  const admins = await allAdminEmails();
  const to = await adminEmailsWantingRequestNotify(admins);
  if (to.length === 0) {
    return { ok: true, error: "No admins opted in for request emails" };
  }

  const from = process.env.RESEND_FROM ?? "Bags of Blessings <notifications@bagsofblessings.net>";
  const base = process.env.APP_BASE_URL ?? "http://localhost:5173";
  const link = `${base.replace(/\/$/, "")}/admin/requests`;

  const { Resend } = await import("resend");
  const resend = new Resend(key);
  const request = params.request;
  const [settings, items] = await Promise.all([
    getOrgSettings(),
    Promise.all(request.lines.map(async (line) => {
      const item = await getItem(line.itemId);
      return { name: item?.name ?? line.itemName ?? "Item no longer in catalog",
        quantity: line.qty, category: item?.category, imageUrl: item?.imageUrl, packType: item?.packType };
    })),
  ]);
  const content = buildRequestEmail({
    contributorName: request.userName,
    contributorEmail: request.userEmail,
    requestId: request.id,
    updated: params.updated === true,
    eventDate: settings?.eventDate,
    inboxUrl: link,
    items,
  });

  const { error } = await resend.emails.send({
    from,
    to,
    ...content,
    ...(request.userEmail ? { replyTo: request.userEmail } : {}),
  });

  if (error) return { ok: false, error: String(error.message ?? error) };
  return { ok: true };
}
