/**
 * Google Sheets API v4 (REST), service-account JWT auth.
 *
 * Docs (Context7 / Google Workspace):
 * - batchClear: developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/batchClear
 * - values.update (PUT): developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/update
 *
 * Flow: POST `.../spreadsheets/{id}/values:batchClear` with `{ ranges: [A1 notation, ...] }` (values only;
 * formatting remains), then PUT `.../spreadsheets/{id}/values/{range}?valueInputOption=USER_ENTERED` with a
 * ValueRange JSON body (`values`, `majorDimension: ROWS`, `range` matching the path).
 * Scope: `https://www.googleapis.com/auth/spreadsheets`.
 */
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

function invalidateSheetsAccessTokenCache(): void {
  cachedToken = null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableHttpStatus(status: number): boolean {
  return (
    status === 408 ||
    status === 429 ||
    (status >= 500 && status <= 504)
  );
}

function backoffMs(attemptIndex: number): number {
  return Math.min(2500, 120 * 2 ** attemptIndex);
}

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
 * Clears a fixed grid on the tab, then writes a full ValueRange (header row + data) from A1.
 * Ranges use A1 notation; sheet titles with spaces/special chars are wrapped in single quotes,
 * with embedded `'` escaped as `''` per Sheets A1 rules.
 *
 * Retries transient failures (429, 5xx, timeouts) and refreshes the OAuth token on 401.
 */
export async function clearAndWriteInventoryRows(
  values: (string | number)[][],
): Promise<void> {
  const cfg = sheetsConfigured();
  if (!cfg) throw new Error("Google Sheets is not configured");

  const tab = cfg.tabName.replace(/'/g, "''");
  const clearRange = `'${tab}'!A1:Z2000`;
  const writeRange = `'${tab}'!A1`;
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${cfg.spreadsheetId}`;

  const maxAttempts = 4;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const token = await getAccessToken(cfg.secretArn);

      const clearRes = await fetch(`${base}/values:batchClear`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ranges: [clearRange] }),
      });

      if (clearRes.status === 401) {
        invalidateSheetsAccessTokenCache();
        lastError = new Error(
          `Sheets batchClear: 401 (token refreshed, retrying) tab=${JSON.stringify(cfg.tabName)}`,
        );
        continue;
      }

      if (!clearRes.ok) {
        const t = await clearRes.text();
        const err = new Error(
          `Sheets batchClear failed: ${clearRes.status} ${t.slice(0, 500)} ` +
            `(spreadsheetId=${cfg.spreadsheetId}, tab=${JSON.stringify(cfg.tabName)}; ` +
            `range ${clearRange})`,
        );
        if (isRetryableHttpStatus(clearRes.status) && attempt < maxAttempts - 1) {
          lastError = err;
          await sleep(backoffMs(attempt));
          continue;
        }
        throw err;
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

      if (updRes.status === 401) {
        invalidateSheetsAccessTokenCache();
        lastError = new Error(
          `Sheets update: 401 (token refreshed, retrying) tab=${JSON.stringify(cfg.tabName)}`,
        );
        continue;
      }

      if (!updRes.ok) {
        const t = await updRes.text();
        const err = new Error(
          `Sheets update failed: ${updRes.status} ${t.slice(0, 500)} ` +
            `(spreadsheetId=${cfg.spreadsheetId}, tab=${JSON.stringify(cfg.tabName)})`,
        );
        if (isRetryableHttpStatus(updRes.status) && attempt < maxAttempts - 1) {
          lastError = err;
          await sleep(backoffMs(attempt));
          continue;
        }
        throw err;
      }

      return;
    } catch (e) {
      const isNetwork =
        e instanceof TypeError ||
        (e instanceof Error && /fetch|network|ECONNRESET|ETIMEDOUT/i.test(e.message));
      if (isNetwork && attempt < maxAttempts - 1) {
        lastError = e instanceof Error ? e : new Error(String(e));
        await sleep(backoffMs(attempt));
        continue;
      }
      throw e;
    }
  }

  throw lastError ?? new Error("Google Sheets sync failed after retries");
}
