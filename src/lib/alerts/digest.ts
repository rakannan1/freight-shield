import type { Cadence, AlertSettings } from "./settings";
import { postEmail } from "./email";

export interface DigestAlert {
  dotNumber: string;
  carrierName: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  createdAt: string;
}

export interface DigestRecipient {
  userId: string;
  email: string;
  settings: AlertSettings;
  lastDigestAt: string | null;
}

/** Storage needed to send digests, kept apart from the snapshot job's store. */
export interface DigestStore {
  digestRecipients(): Promise<DigestRecipient[]>;
  alertsForUser(userId: string, sinceIso: string): Promise<DigestAlert[]>;
  markDigestSent(userId: string, atIso: string): Promise<void>;
}

const DAY = 86_400_000;
const FRIDAY = 5;

/** Daily digests go out on every run. Weekly digests go out on Fridays (UTC). A digest is never sent twice in its period. */
export function digestDue(cadence: Cadence, lastIso: string | null, now: Date): boolean {
  const last = lastIso ? Date.parse(lastIso) : null;
  if (cadence === "daily") return last === null || now.getTime() - last > 20 * 3_600_000;
  return now.getUTCDay() === FRIDAY && (last === null || now.getTime() - last > 6 * DAY);
}

export function digestSince(cadence: Cadence, lastIso: string | null, now: Date): string {
  return lastIso ?? new Date(now.getTime() - (cadence === "daily" ? 1 : 7) * DAY).toISOString();
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const RANK = { critical: 0, warning: 1, info: 2 } as const;

export function renderDigest(alerts: DigestAlert[], cadence: Cadence) {
  const sorted = [...alerts].sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.carrierName.localeCompare(b.carrierName));
  const carriers = new Set(alerts.map((a) => a.dotNumber)).size;
  const crit = alerts.filter((a) => a.severity === "critical").length;
  const subject = `FreightShield ${cadence} digest: ${alerts.length} change${alerts.length === 1 ? "" : "s"} across ${carriers} carrier${carriers === 1 ? "" : "s"}${crit ? ` (${crit} critical)` : ""}`;

  const items = sorted
    .map(
      (a) =>
        `<li><strong>${esc(a.severity.toUpperCase())}</strong> ${esc(a.carrierName)} (DOT ${esc(a.dotNumber)}): ${esc(a.title)}<br/>` +
        `<span style="color:#555">${esc(a.detail)}</span></li>`,
    )
    .join("");
  const html =
    `<div style="font-family:system-ui,sans-serif;max-width:600px"><h2 style="margin:0 0 8px">Your ${cadence} carrier digest</h2>` +
    `<ul>${items}</ul><p style="color:#777;font-size:12px">Based on FMCSA public records. Not a guarantee that a carrier is safe or unsafe.</p></div>`;
  const text =
    sorted.map((a) => `- [${a.severity}] ${a.carrierName} (DOT ${a.dotNumber}): ${a.title}. ${a.detail}`).join("\n") +
    `\n\nBased on FMCSA public records. Not a guarantee that a carrier is safe or unsafe.`;
  return { subject, html, text };
}

export interface DigestResult {
  recipients: number;
  sent: number;
  errors: string[];
}

export async function runDigests(
  store: DigestStore,
  now: Date = new Date(),
  send: typeof postEmail = postEmail,
): Promise<DigestResult> {
  const result: DigestResult = { recipients: 0, sent: 0, errors: [] };
  for (const r of await store.digestRecipients()) {
    if (!r.settings.emailDigest) continue;
    if (!digestDue(r.settings.digestCadence, r.lastDigestAt, now)) continue;
    result.recipients++;
    try {
      const alerts = await store.alertsForUser(r.userId, digestSince(r.settings.digestCadence, r.lastDigestAt, now));
      if (alerts.length) {
        const mail = renderDigest(alerts, r.settings.digestCadence);
        let delivered = false;
        for (const to of [r.email, ...r.settings.extraRecipients]) {
          const ok = await send({ to, ...mail });
          if (to === r.email) delivered = ok;
          if (ok) result.sent++;
        }
        // Leave the window open when the main email did not go out, so the next run retries.
        if (!delivered) continue;
      }
      await store.markDigestSent(r.userId, now.toISOString());
    } catch (e) {
      result.errors.push(`${r.userId}: ${(e as Error).message}`);
    }
  }
  return result;
}
