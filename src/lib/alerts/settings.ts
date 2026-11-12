export type Cadence = "weekly" | "daily";
export type SmsThreshold = "critical" | "critical_review";

export interface AlertSettings {
  emailDigest: boolean;
  digestCadence: Cadence;
  smsEnabled: boolean;
  /** E.164, e.g. +15551234567 */
  smsPhone: string | null;
  smsThreshold: SmsThreshold;
  slackEnabled: boolean;
  slackWebhookUrl: string | null;
  extraRecipients: string[];
}

/** What a user gets before they open the settings page. */
export const DEFAULT_SETTINGS: AlertSettings = {
  emailDigest: true,
  digestCadence: "weekly",
  smsEnabled: false,
  smsPhone: null,
  smsThreshold: "critical",
  slackEnabled: false,
  slackWebhookUrl: null,
  extraRecipients: [],
};

/** Used for watchers with no settings object (older callers): every alert is emailed at once, as before. */
export const IMMEDIATE_ALL: AlertSettings = { ...DEFAULT_SETTINGS, emailDigest: false };

export const MAX_EXTRA_RECIPIENTS = 5;
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;
const SLACK_URL = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_/-]+$/;

export const isSlackWebhook = (u: string | null | undefined): u is string => Boolean(u && SLACK_URL.test(u));

/** Database row (snake_case) to settings, tolerating a missing row or odd values. */
export function fromRow(row: Record<string, unknown> | null | undefined): AlertSettings {
  if (!row) return { ...DEFAULT_SETTINGS };
  const d = DEFAULT_SETTINGS;
  return {
    emailDigest: typeof row.email_digest === "boolean" ? row.email_digest : d.emailDigest,
    digestCadence: row.digest_cadence === "daily" ? "daily" : "weekly",
    smsEnabled: row.sms_enabled === true,
    smsPhone: typeof row.sms_phone === "string" && row.sms_phone ? row.sms_phone : null,
    smsThreshold: row.sms_threshold === "critical_review" ? "critical_review" : "critical",
    slackEnabled: row.slack_enabled === true,
    slackWebhookUrl: typeof row.slack_webhook_url === "string" && row.slack_webhook_url ? row.slack_webhook_url : null,
    extraRecipients: Array.isArray(row.extra_recipients) ? (row.extra_recipients as unknown[]).filter((x): x is string => typeof x === "string") : [],
  };
}

export function toRow(s: AlertSettings) {
  return {
    email_digest: s.emailDigest,
    digest_cadence: s.digestCadence,
    sms_enabled: s.smsEnabled,
    sms_phone: s.smsPhone,
    sms_threshold: s.smsThreshold,
    slack_enabled: s.slackEnabled,
    slack_webhook_url: s.slackWebhookUrl,
    extra_recipients: s.extraRecipients,
  };
}

/** US mobile number to E.164, or null. */
export function toE164(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.length === 10 ? `+1${d}` : null;
}

export function parseRecipients(raw: string): { emails: string[]; invalid: string[] } {
  const parts = raw.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  const emails: string[] = [];
  const invalid: string[] = [];
  for (const p of parts) {
    if (!EMAIL.test(p)) invalid.push(p);
    else if (!emails.includes(p)) emails.push(p);
  }
  return { emails, invalid };
}

export type ParseResult = { ok: true; settings: AlertSettings } | { ok: false; error: string };

/** Validates the settings form. `ownEmail` is dropped from the extras, since the user already gets every email. */
export function parseSettingsForm(form: FormData, ownEmail?: string | null): ParseResult {
  const on = (k: string) => form.get(k) === "on";
  const str = (k: string) => String(form.get(k) ?? "").trim();

  const smsEnabled = on("sms_enabled");
  let smsPhone: string | null = null;
  if (str("sms_phone")) {
    smsPhone = toE164(str("sms_phone"));
    if (!smsPhone) return { ok: false, error: "Enter a 10-digit US mobile number for text alerts." };
  } else if (smsEnabled) {
    return { ok: false, error: "Add a mobile number to turn on text alerts." };
  }

  const slackEnabled = on("slack_enabled");
  const slackUrl = str("slack_webhook_url");
  if (slackUrl && !isSlackWebhook(slackUrl)) {
    return { ok: false, error: "That doesn't look like a Slack webhook. It should start with https://hooks.slack.com/services/" };
  }
  if (slackEnabled && !slackUrl) return { ok: false, error: "Paste a Slack webhook URL to turn on Slack alerts." };

  const { emails, invalid } = parseRecipients(str("extra_recipients"));
  if (invalid.length) return { ok: false, error: `These don't look like email addresses: ${invalid.join(", ")}` };
  const extras = emails.filter((e) => e !== (ownEmail ?? "").toLowerCase());
  if (extras.length > MAX_EXTRA_RECIPIENTS) return { ok: false, error: `Add up to ${MAX_EXTRA_RECIPIENTS} extra recipients.` };

  return {
    ok: true,
    settings: {
      emailDigest: on("email_digest"),
      digestCadence: str("digest_cadence") === "daily" ? "daily" : "weekly",
      smsEnabled,
      smsPhone,
      smsThreshold: str("sms_threshold") === "critical_review" ? "critical_review" : "critical",
      slackEnabled,
      slackWebhookUrl: slackUrl || null,
      extraRecipients: extras,
    },
  };
}
