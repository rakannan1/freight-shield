import type { Finding } from "@/lib/rules/detect";

export const smsConfigured = () =>
  Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);

export function smsBody(carrierName: string, findings: Finding[]): string {
  const top = findings[0];
  const more = findings.length > 1 ? ` (+${findings.length - 1} more)` : "";
  const text = `FreightShield ${top.severity.toUpperCase()}: ${top.title}${more}. Check your dashboard before your next load.`;
  return (carrierName && !top.title.includes(carrierName) ? `${carrierName}: ` : "") + text.slice(0, 300);
}

/** Sends through Twilio; logs to the console when Twilio is not configured. Returns true if sent. */
export async function sendSms(to: string, body: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    console.log(`[sms:dry-run] to=${to} ${body}`);
    return false;
  }
  const res = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });
  return res.ok;
}
