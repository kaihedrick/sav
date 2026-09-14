# Bags of Blessings

Ministry inventory app: contributors commit items to bring; Savannah gets **Resend** email alerts and manages requests in an **admin inbox**. **AWS** hosts **API Gateway HTTP API**, **Lambda (Node.js 20)**, **DynamoDB**, and **Secrets Manager** (session signing + optional Resend). **React + Vite + Tailwind + Motion** frontend with a mobile-first, pink paper-bag aesthetic.

Sign-in is **Google Identity Services** (the Google button on your app). The API verifies the Google ID token, then issues a short-lived **app JWT** (HS256). **Admin** is whoever matches **`ADMIN_EMAIL`** in deploy parameters (also `role: admin` in the token).

## Repo layout (separation of concerns)

| Area | Path |
|------|------|
| HTTP handlers (thin) | `api/src/handlers/` |
| Domain rules | `api/src/domain/` |
| DynamoDB repositories | `api/src/data/` |
| Resend adapter | `api/src/integrations/` |
| Auth (Google verify + app JWT) | `api/src/lib/auth.ts` |
| Web UI | `web/src/` |

## Prerequisites

- Node 20+ and npm
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- AWS credentials (`aws sso login` or `aws configure`)
- Google Cloud **OAuth 2.0 Web client** (for GIS): under **Authorized JavaScript origins**, add every origin you use (e.g. `http://localhost:5173` and your production URL). No Cognito redirect URI is required for the GIS credential flow.

## Deploy backend (SAM)

```bash
cd infra
sam build
sam deploy --guided
```

Parameters:

- **GoogleClientId** — Web client ID (same value as `VITE_GOOGLE_CLIENT_ID` in the SPA).
- **AdminEmail** — matches Lambda `ADMIN_EMAIL` (Resend recipient + `role: admin` when the Google account email matches).
- **AppBaseUrl** — e.g. `http://localhost:5173` for dev (CORS); include `http://localhost:5173` in Google origins even when this is your production URL.
- **ResendApiKey** — optional at first; email notifications stay no-op until set.
- **ResendSecretArn** — use an existing Secrets Manager secret instead of passing
  a key during deployment. Store `{"apiKey":"YOUR_RESEND_KEY"}` (or a raw key).
  This takes precedence over ResendApiKey and grants the API read access to that
  secret only. Keep this parameter in your deployment configuration.
- **ResendFrom** — defaults to `Bags of Blessings <notifications@bagsofblessings.net>`;
  the sender domain must be verified in Resend. The key stays in the backend,
  never in frontend or `VITE_` variables.

The stack creates a **Secrets Manager** secret for the **HS256 session key** (`SESSION_JWT_SECRET_ARN` is wired to Lambda automatically).

Copy stack output **HttpApiUrl** into `web/.env` as `VITE_API_URL`.

### Admin access in the UI

Set **`VITE_ADMIN_EMAIL`** in `web/.env` to the same value as **AdminEmail** so the SPA shows admin navigation. The API still enforces admin from the JWT + `ADMIN_EMAIL`.

## Frontend env

Create `web/.env` from `web/.env.example`:

```
VITE_API_URL=https://xxxx.execute-api....amazonaws.com
VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
VITE_ADMIN_EMAIL=savannah@example.com
```

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:5173` and use **Sign in with Google**.

## After first deploy

1. As admin, open **Admin** → **Seed sample items** (or add catalog manually).
2. Contributors sign in, submit requests; Savannah receives **Resend** mail if the key and **ADMIN_EMAIL** are set.
3. **Inbox** (`/admin/requests`) auto-refetches every **20s** (light polling).

## Stack updates (removed Cognito)

If an older stack had **Cognito**, deploying this template **removes** those resources. That can fail if something outside the template still references the user pool, or take a while while Cognito deletes. Prefer a clean stack name or remove dependent resources first if you hit update errors.

## Refresh inventory from the shared Google Sheet

Excel file imports replace the whole catalog (clear, then insert). Rows are
validated and matched before clearing. Matched items retain their IDs and saved
image URLs when the file omits them; new items receive new IDs. Items omitted
from the file are removed. This is separate from the live-sheet refresh below.

Admins can use **Catalog → Refresh from live sheet** to read the configured
Google Sheet into DynamoDB, then refresh the website inventory. This uses the
existing spreadsheet ID, tab name, and service account secret; no new credentials
are required. The API reads evaluated values using
[Google Sheets values.get](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get).

- Keep **Item ID** unchanged. Refresh updates existing items only; create new items
  in Catalog. Missing sheet rows do not delete database records.
- Editable columns: Item name, Type, Price, Stock, Notes, Target, Image, Hidden.
- **Pack type** describes packaging, such as Single, 12-pack, or Case of 24.
  Admins can edit it in Catalog or the sheet. It appears on item cards, the Commit
  form, exports, and notification emails. Omitted Pack type columns preserve saved
  values. This is a descriptive label; quantities are not automatically multiplied.
  Missing columns preserve existing values. Blank Stock/Target is an error (use 0).
  Blank Price/Notes/Image clears that field; blank Hidden means visible.
- **Target** is the remaining amount needed. New commitments reduce it (minimum 0)
  and push the result to the sheet. Increasing a commitment subtracts only the
  additional quantity. Reductions, deletions, and status changes do not restore it.
  For manual rollback, edit Target in the sheet and use Refresh from live sheet.
  Existing targets are not retroactively adjusted for old commitments.
- **Projected** has been removed from displays and exports. Legacy Projected and
  Status columns are ignored on import.
- All rows are validated before saving. Updates use conditional transactions in
  batches of 50 items. Concurrent database changes stop the affected batch;
  a failure response reports how many items were already saved. Refresh is safe to retry.
- This is a manual pull, not background synchronization. Existing website-to-sheet
  writes still rewrite the sheet. Finish sheet edits and refresh from Catalog
  before making website changes; other users' website activity can also overwrite
  unsynced edits. Simultaneous editing in both places is not conflict-merged.
- The pull endpoint is `POST /admin/inventory/pull-google-sheet` (admin session
  required). The existing `sync-google-sheet` endpoint continues to push outward.

Deploy both API and frontend for the button to work. No live data is imported by deployment.

## Local API (optional)

Lambda-shaped handler can be run with a small local server later; for now use the deployed API or SAM local:

```bash
cd infra && sam local start-api
```

(Ensure env vars match `template.yaml`.)

## Security notes

- Do **not** commit `.env` or API keys.
- **Resend** key is stored in **Secrets Manager** when provided at deploy.
- The SPA stores the **app JWT** in `localStorage` for persistence (MVP). Tighten with httpOnly cookies + BFF when hardening.
