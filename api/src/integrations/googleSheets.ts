import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { JWT } from "google-auth-library";

const sm = new SecretsManagerClient({});

type ServiceAccountCreds = {
  client_email: string;
  private_key: string;
};

let cachedToken: { token: string; expiresAtMs: number } | null = null;
let cachedSa: { arn: string; creds: ServiceAccountCreds } | null = null;

async function loadServiceAccount(secretArn: string): Promise<ServiceAccountCreds> {
  if (cachedSa?.arn === secretArn) return cachedSa.creds;
  const out = await sm.send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );
  const raw = out.SecretString;
  if (!raw) throw new Error("Google Sheets secret is empty");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const client_email = parsed.client_email;
  const private_key = parsed.private_key;
  if (typeof client_email !== "string" || typeof private_key !== "string") {
    throw new Error(
      "Google Sheets secret must be service account JSON (client_email, private_key)",
    );
  }
  const creds: ServiceAccountCreds = { client_email, private_key };
  cachedSa = { arn: secretArn, creds };
  return creds;
}

async function getAccessToken(secretArn: string): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs > now + 60_000) {
    return cachedToken.token;
  }
  const creds = await loadServiceAccount(secretArn);
  const client = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const { access_token: accessToken, expiry_date } = await client.authorize();
  if (!accessToken) throw new Error("Google Sheets auth failed (no access token)");
  const expiresAtMs =
    typeof expiry_date === "number" ? expiry_date : now + 3_500_000;
  cachedToken = { token: accessToken, expiresAtMs };
  return accessToken;
}

function sheetsConfigured(): {
  spreadsheetId: string;
  secretArn: string;
  tabName: string;
} | null {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ?? "";
  const secretArn = process.env.GOOGLE_SHEETS_SECRET_ARN?.trim() ?? "";
  const tabName =
    process.env.GOOGLE_SHEETS_TAB_NAME?.trim() || "Inventory Tracker";
  if (!spreadsheetId || !secretArn) return null;
  return { spreadsheetId, secretArn, tabName };
}

export function getPublicSheetViewUrl(): string | null {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (!id) return null;
  return `https://docs.google.com/spreadsheets/d/${id}/htmlview`;
}

export function isGoogleSheetsSyncEnabled(): boolean {
  return sheetsConfigured() != null;
}

/**
 * Clears a large data block then writes values starting at A2 (header row untouched).
 */
export async function clearAndWriteInventoryRows(
  values: (string | number)[][],
): Promise<void> {
  const cfg = sheetsConfigured();
  if (!cfg) throw new Error("Google Sheets is not configured");

  const token = await getAccessToken(cfg.secretArn);
  const tab = cfg.tabName.replace(/'/g, "''");
  const clearRange = `'${tab}'!A2:Z2000`;
  const writeRange = `'${tab}'!A2`;

  const base = `https://sheets.googleapis.com/v4/spreadsheets/${cfg.spreadsheetId}`;

  const clearRes = await fetch(`${base}/values:batchClear`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ranges: [clearRange] }),
  });
  if (!clearRes.ok) {
    const t = await clearRes.text();
    throw new Error(
      `Sheets batchClear failed: ${clearRes.status} ${t.slice(0, 500)} ` +
        `(spreadsheetId=${cfg.spreadsheetId}, tab=${JSON.stringify(cfg.tabName)}; ` +
        `range ${clearRange})`,
    );
  }

  const q = new URLSearchParams({ valueInputOption: "USER_ENTERED" });
  const updUrl = `${base}/values/${encodeURIComponent(writeRange)}?${q}`;
  const updRes = await fetch(updUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      range: writeRange,
      majorDimension: "ROWS",
      values,
    }),
  });
  if (!updRes.ok) {
    const t = await updRes.text();
    throw new Error(
      `Sheets update failed: ${updRes.status} ${t.slice(0, 500)} ` +
        `(spreadsheetId=${cfg.spreadsheetId}, tab=${JSON.stringify(cfg.tabName)})`,
    );
  }
}
