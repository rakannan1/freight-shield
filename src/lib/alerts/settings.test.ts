import { describe, expect, it } from "vitest";
import { routeFinding } from "./routing";
import { DEFAULT_SETTINGS, fromRow, parseSettingsForm, toE164, type AlertSettings } from "./settings";
import { smsBody } from "./sms";
import { postSlack } from "./slack";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const S = (o: Partial<AlertSettings> = {}): AlertSettings => ({ ...DEFAULT_SETTINGS, ...o });

describe("routeFinding", () => {
  it("digest on: only critical is emailed now, everything is in the digest", () => {
    expect(routeFinding(S(), "critical")).toMatchObject({ emailNow: true, inDigest: true });
    expect(routeFinding(S(), "warning")).toMatchObject({ emailNow: false, inDigest: true });
    expect(routeFinding(S(), "info")).toMatchObject({ emailNow: false, inDigest: true });
  });
  it("digest off: everything is emailed now", () => {
    expect(routeFinding(S({ emailDigest: false }), "info")).toMatchObject({ emailNow: true, inDigest: false });
  });
  it("sms follows the threshold and needs a number", () => {
    const on = S({ smsEnabled: true, smsPhone: "+15551112222" });
    expect(routeFinding(on, "critical").sms).toBe(true);
    expect(routeFinding(on, "warning").sms).toBe(false);
    expect(routeFinding({ ...on, smsThreshold: "critical_review" }, "warning").sms).toBe(true);
    expect(routeFinding({ ...on, smsThreshold: "critical_review" }, "info").sms).toBe(false);
    expect(routeFinding({ ...on, smsPhone: null }, "critical").sms).toBe(false);
    expect(routeFinding(S({ smsPhone: "+15551112222" }), "critical").sms).toBe(false);
  });
  it("slack needs a valid webhook and skips info", () => {
    const url = "https://hooks.slack.com/services/T0/B0/xyz";
    expect(routeFinding(S({ slackEnabled: true, slackWebhookUrl: url }), "warning").slack).toBe(true);
    expect(routeFinding(S({ slackEnabled: true, slackWebhookUrl: url }), "info").slack).toBe(false);
    expect(routeFinding(S({ slackEnabled: true, slackWebhookUrl: "https://evil.example/x" }), "critical").slack).toBe(false);
  });
});

describe("parseSettingsForm", () => {
  it("parses a full form", () => {
    const r = parseSettingsForm(
      form({ email_digest: "on", digest_cadence: "daily", sms_enabled: "on", sms_phone: "(555) 111-2222", sms_threshold: "critical_review", extra_recipients: "A@x.com, b@x.com\nme@x.com" }),
      "me@x.com",
    );
    expect(r).toEqual({
      ok: true,
      settings: { emailDigest: true, digestCadence: "daily", smsEnabled: true, smsPhone: "+15551112222", smsThreshold: "critical_review", slackEnabled: false, slackWebhookUrl: null, extraRecipients: ["a@x.com", "b@x.com"] },
    });
  });
  it("unchecked switches are off", () => {
    const r = parseSettingsForm(form({}));
    expect(r.ok && r.settings.emailDigest).toBe(false);
  });
  it("rejects bad input with a clear message", () => {
    expect(parseSettingsForm(form({ sms_enabled: "on" }))).toMatchObject({ ok: false });
    expect(parseSettingsForm(form({ sms_phone: "123" }))).toMatchObject({ ok: false });
    expect(parseSettingsForm(form({ slack_enabled: "on", slack_webhook_url: "https://evil.example/hook" }))).toMatchObject({ ok: false });
    expect(parseSettingsForm(form({ extra_recipients: "nope" }))).toMatchObject({ ok: false });
    expect(parseSettingsForm(form({ extra_recipients: "a@x.com b@x.com c@x.com d@x.com e@x.com f@x.com" }))).toMatchObject({ ok: false });
  });
});

describe("helpers", () => {
  it("toE164 handles US formats", () => {
    expect(toE164("1 (555) 111-2222")).toBe("+15551112222");
    expect(toE164("555-1112")).toBeNull();
  });
  it("fromRow falls back to defaults", () => {
    expect(fromRow(null)).toEqual(DEFAULT_SETTINGS);
    expect(fromRow({ digest_cadence: "bogus", extra_recipients: ["a@x.com", 5] }).extraRecipients).toEqual(["a@x.com"]);
  });
  it("smsBody is short and names the carrier", () => {
    const b = smsBody("ACME", [{ rule: "authority_lost", severity: "critical", title: "Authority lost", detail: "", before: null, after: null }, { rule: "x", severity: "warning", title: "t", detail: "", before: null, after: null }]);
    expect(b).toContain("ACME");
    expect(b).toContain("+1 more");
    expect(b.length).toBeLessThan(320);
  });
  it("postSlack refuses non-Slack hosts without calling out", async () => {
    let called = false;
    const f = (async () => { called = true; return new Response("ok"); }) as unknown as typeof fetch;
    expect(await postSlack("https://evil.example/x", "hi", f)).toBe(false);
    expect(called).toBe(false);
  });
});
