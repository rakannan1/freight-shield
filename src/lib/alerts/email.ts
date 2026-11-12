import type { Finding } from "@/lib/rules/detect";

export interface AlertEmail {
  to: string;
  carrierName: string;
  dotNumber: string;
  summary: string;
  findings: Finding[];
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderEmail(a: AlertEmail): { subject: string; html: string; text: string } {
  const worst = a.findings.some((f) => f.severity === "critical")
    ? "Critical"
    : a.findings.some((f) => f.severity === "warning")
      ? "Warning"
      : "Notice";
  const subject = `${worst}: change detected for ${a.carrierName} (DOT ${a.dotNumber})`;

  const rows = a.findings
    .map(
      (f) =>
        `<li><strong>${esc(f.severity.toUpperCase())}</strong> ${esc(f.title)}<br/>` +
        `<span style="color:#555">${esc(f.detail)}</span></li>`,
    )
    .join("");

  const html =
    `<div style="font-family:system-ui,sans-serif;max-width:560px">` +
    `<h2 style="margin:0 0 8px">${esc(a.carrierName)} <small>(DOT ${esc(a.dotNumber)})</small></h2>` +
    `<p>${esc(a.summary).replace(/\n/g, "<br/>")}</p>` +
    `<ul>${rows}</ul>` +
    `<p style="color:#777;font-size:12px">Based on FMCSA public records. This is a monitoring alert, ` +
    `not a guarantee that a carrier is safe or unsafe.</p></div>`;

  const text =
    `${a.carrierName} (DOT ${a.dotNumber})\n\n${a.summary}\n\n` +
    a.findings.map((f) => `- [${f.severity}] ${f.title}: ${f.detail}`).join("\n") +
    `\n\nBased on FMCSA public records. Not a guarantee that a carrier is safe or unsafe.`;

  return { subject, html, text };
}

/** Sends through Resend; logs to the console when RESEND_API_KEY is not set. Returns true if sent. */
export async function postEmail(
  m: { to: string; subject: string; html: string; text: string },
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL;

  if (!key || !from) {
    console.log(`[email:dry-run] to=${m.to} subject="${m.subject}"\n${m.text}`);
    return false;
  }

  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ from, to: m.to, subject: m.subject, html: m.html, text: m.text }),
  });
  return res.ok;
}

export async function sendEmail(a: AlertEmail, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  return postEmail({ to: a.to, ...renderEmail(a) }, fetchImpl);
}
