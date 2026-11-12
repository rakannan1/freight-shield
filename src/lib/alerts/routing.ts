import type { AlertSettings } from "./settings";
import { isSlackWebhook } from "./settings";

export type Severity = "info" | "warning" | "critical";

export interface Route {
  /** Send by email right now. */
  emailNow: boolean;
  /** Listed in the scheduled digest. */
  inDigest: boolean;
  sms: boolean;
  slack: boolean;
}

/**
 * Where one finding goes.
 * - Critical findings are emailed immediately. With the digest on, everything else waits for the digest,
 *   and with it off, everything is emailed immediately.
 * - The digest lists everything that changed, criticals included.
 * - Text messages: critical, plus warnings when "critical and review-level" is chosen.
 * - Slack: critical and warnings.
 */
export function routeFinding(s: AlertSettings, severity: Severity): Route {
  return {
    emailNow: severity === "critical" || !s.emailDigest,
    inDigest: s.emailDigest,
    sms: s.smsEnabled && Boolean(s.smsPhone) && (severity === "critical" || (s.smsThreshold === "critical_review" && severity === "warning")),
    slack: s.slackEnabled && isSlackWebhook(s.slackWebhookUrl) && severity !== "info",
  };
}
