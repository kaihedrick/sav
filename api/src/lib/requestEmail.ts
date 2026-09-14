export interface RequestEmailInput {
  contributorName: string;
  contributorEmail?: string;
  requestId: string;
  updated: boolean;
  eventDate?: string;
  inboxUrl: string;
  items: { name: string; quantity: number; category?: string; imageUrl?: string }[];
}

function escape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function imageUrl(value?: string): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return escape(url.href);
  } catch { /* Missing or invalid photos use the same neutral placeholder. */ }
}

export function buildRequestEmail(input: RequestEmailInput): { subject: string; html: string; text: string } {
  const total = input.items.reduce((sum, item) => sum + item.quantity, 0);
  const title = input.updated ? "Contribution updated" : "A little kindness is on its way";
  const label = input.updated ? "UPDATED CONTRIBUTION" : "NEW CONTRIBUTION";
  const name = escape(input.contributorName);
  const link = escape(input.inboxUrl);
  const summary = `${input.contributorName} ${input.updated ? "updated their contribution" : "is bringing items"}: ${total} total across ${input.items.length} item${input.items.length === 1 ? "" : "s"}.`;
  const rows = input.items.map((item) => {
    const photo = imageUrl(item.imageUrl);
    return `<tr>
      <td width="76" valign="middle" style="padding:16px 12px 16px 0;border-bottom:1px solid #eadfd9;">
        ${photo ? `<img src="${photo}" alt="${escape(item.name)}" width="64" height="64" style="display:block;width:64px;height:64px;object-fit:contain;border-radius:12px;background:#f6f1ea;border:0;" />`
          : '<div style="width:64px;height:64px;line-height:64px;text-align:center;border-radius:12px;background:#f6f1ea;font-size:28px;" aria-label="No item photo">&#128230;</div>'}
      </td>
      <td valign="middle" style="padding:16px 8px 16px 0;border-bottom:1px solid #eadfd9;word-break:break-word;">
        <div style="font-size:16px;font-weight:bold;color:#3b2923;">${escape(item.name)}</div>
        ${item.category ? `<div style="padding-top:5px;font-size:12px;color:#78655b;">${escape(item.category)}</div>` : ""}
      </td>
      <td width="65" align="right" valign="middle" style="padding:16px 0;border-bottom:1px solid #eadfd9;">
        <div style="font-size:10px;letter-spacing:1px;color:#78655b;">QTY</div>
        <div style="font-size:24px;font-weight:bold;color:#78414e;">${item.quantity}</div>
      </td>
    </tr>`;
  }).join("");
  const subject = `Bags of Blessings: ${input.updated ? "Updated" : "New"} contribution from ${input.contributorName}`.replace(/[\r\n]/g, " ").slice(0, 120);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head>
  <body style="margin:0;padding:0;background:#f6f1ea;font-family:Arial,Helvetica,sans-serif;color:#3b2923;">
    <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escape(summary)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f1ea;"><tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fffdf9;border:1px solid #eadfd9;border-radius:20px;">
        <tr><td style="padding:28px 24px;background:#5d4037;border-radius:20px 20px 0 0;color:#ffffff;">
          <div style="font-family:Georgia,serif;font-size:28px;">Bags of Blessings</div>
          <div style="padding-top:8px;font-size:12px;color:#f4dce1;">Small acts. A caring community.</div>
        </td></tr>
        <tr><td style="padding:28px 24px 8px;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#914e61;">${label}</div>
          <h1 style="margin:12px 0;font-size:26px;line-height:1.25;font-family:Georgia,serif;">${title}</h1>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6;"><strong>${name}</strong> ${input.updated ? "updated what they plan to bring. The list below shows their current contribution." : "has shared what they plan to bring. Here’s everything in their contribution."}</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8edf0;border-radius:12px;"><tr><td style="padding:16px;font-size:14px;line-height:1.6;">
            <strong>${total} total items</strong> &nbsp; &middot; &nbsp; ${input.items.length} item ${input.items.length === 1 ? "type" : "types"}<br>
            Status: <strong>Pending arrival</strong>
            ${input.eventDate ? `<br>Event date: <strong>${escape(input.eventDate)}</strong>` : ""}
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:12px 24px 0;"><h2 style="margin:8px 0 0;font-size:18px;">What they’re bringing</h2>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed;">${rows}</table>
        </td></tr>
        <tr><td style="padding:24px;font-size:14px;line-height:1.6;word-break:break-word;">
          <strong>Contributor</strong><br>${name}${input.contributorEmail ? `<br>${escape(input.contributorEmail)}` : ""}
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:22px;"><tr><td bgcolor="#78414e" style="border-radius:10px;"><a href="${link}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;">Open request inbox &rarr;</a></td></tr></table>
          <p style="margin:16px 0 0;font-size:12px;color:#78655b;">Sign in with your admin account to review this contribution.${input.contributorEmail ? " You can reply to this email to contact the contributor." : ""}</p>
          <p style="margin:12px 0 0;font-size:11px;color:#78655b;">Request reference: ${escape(input.requestId)}</p>
        </td></tr>
      </table>
      <p style="max-width:540px;margin:18px 0 0;font-size:11px;line-height:1.6;color:#78655b;">You receive these updates because request notifications are enabled for your admin account. Manage your preference in Admin access.</p>
    </td></tr></table>
  </body></html>`;
  const text = ["Bags of Blessings", input.updated ? "Contribution updated" : "New contribution", "", summary,
    "Status: Pending arrival", ...(input.eventDate ? [`Event date: ${input.eventDate}`] : []), "", "What they’re bringing:",
    ...input.items.map(item => `- ${item.quantity} × ${item.name}${item.category ? ` (${item.category})` : ""}`), "",
    `Contributor: ${input.contributorName}`, ...(input.contributorEmail ? [input.contributorEmail] : []),
    `Request reference: ${input.requestId}`, "", `Open request inbox: ${input.inboxUrl}`,
    "Manage request notifications in Admin access."].join("\n");
  return { subject, html, text };
}
