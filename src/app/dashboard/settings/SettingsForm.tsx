"use client";

import { useActionState, useState } from "react";
import { saveSettings, type SettingsState } from "../actions";
import type { AlertSettings } from "@/lib/alerts/settings";

function Switch({ name, checked, onChange, label, disabled }: { name: string; checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="st-switch">
      <input type="checkbox" name={name} role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="st-track" aria-hidden />
      <span className="sr-only">{label}</span>
    </label>
  );
}

function Row({ title, hint, children, extra }: { title: string; hint: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="st-row">
      <div className="st-row-main">
        <div>
          <div className="st-row-title">{title}</div>
          <p className="muted">{hint}</p>
        </div>
        {children}
      </div>
      {extra}
    </div>
  );
}

function Radios({ name, value, onChange, options }: { name: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="st-radios" role="radiogroup">
      {options.map(([v, label]) => (
        <label key={v} className="st-radio">
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

export default function SettingsForm({
  initial,
  smsAvailable,
  billing,
}: {
  initial: AlertSettings;
  smsAvailable: boolean;
  billing: { line: string; enforced: boolean; subscribed: boolean; hasCustomer: boolean };
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, { ok: false, message: "" });
  const [digest, setDigest] = useState(initial.emailDigest);
  const [cadence, setCadence] = useState<string>(initial.digestCadence);
  const [sms, setSms] = useState(initial.smsEnabled);
  const [threshold, setThreshold] = useState<string>(initial.smsThreshold);
  const [slack, setSlack] = useState(initial.slackEnabled);

  const cadenceWord = cadence === "daily" ? "Daily" : "Weekly";

  return (
    <div className="card st-card">
    <form action={action} className="st-form">
      <div className="stack">
        <h1>Alert settings</h1>
        <p className="muted">
          Sensible defaults for a small brokerage: critical changes reach you right away, everything else arrives in one digest.
        </p>
      </div>

      <section className="st-section" aria-labelledby="st-channels">
        <h2 id="st-channels" className="st-h">Channels</h2>

        <Row
          title={`${cadenceWord} email digest`}
          hint={`${cadence === "daily" ? "Every morning" : "Fridays"}: a summary of everything that changed. Critical changes are still emailed right away. With this off, every change is emailed as it happens.`}
        >
          <Switch name="email_digest" checked={digest} onChange={setDigest} label="Email digest" />
        </Row>

        <Row
          title="SMS for critical alerts"
          hint={smsAvailable ? "Authority revocations, insurance problems and other critical changes, as soon as the daily check finds them." : "Text messages aren't switched on for this site yet. You can save a number now."}
          extra={
            sms ? (
              <div className="st-sub">
                <label htmlFor="sms_phone" className="label">Mobile number</label>
                <input id="sms_phone" name="sms_phone" type="tel" inputMode="tel" autoComplete="tel" className="input" placeholder="(555) 123-4567" defaultValue={initial.smsPhone?.replace(/^\+1/, "") ?? ""} />
              </div>
            ) : (
              <input type="hidden" name="sms_phone" value={initial.smsPhone?.replace(/^\+1/, "") ?? ""} />
            )
          }
        >
          <Switch name="sms_enabled" checked={sms} onChange={setSms} label="Text alerts" />
        </Row>

        <Row
          title="Slack webhook"
          hint="Post critical and warning alerts to a channel, for example #fraud-watch."
          extra={
            slack ? (
              <div className="st-sub">
                <label htmlFor="slack_webhook_url" className="label">Webhook URL</label>
                <input id="slack_webhook_url" name="slack_webhook_url" type="url" className="input" placeholder="https://hooks.slack.com/services/..." defaultValue={initial.slackWebhookUrl ?? ""} />
              </div>
            ) : (
              <input type="hidden" name="slack_webhook_url" value={initial.slackWebhookUrl ?? ""} />
            )
          }
        >
          <Switch name="slack_enabled" checked={slack} onChange={setSlack} label="Slack alerts" />
        </Row>
      </section>

      <section className="st-section" aria-labelledby="st-sms">
        <h2 id="st-sms" className="st-h">What triggers an SMS</h2>
        <Radios name="sms_threshold" value={threshold} onChange={setThreshold} options={[["critical", "Critical only"], ["critical_review", "Critical and review-level"]]} />
      </section>

      <section className="st-section" aria-labelledby="st-cadence">
        <h2 id="st-cadence" className="st-h">Digest cadence</h2>
        <Radios name="digest_cadence" value={cadence} onChange={setCadence} options={[["weekly", "Weekly (Friday)"], ["daily", "Daily (mornings)"]]} />
      </section>

      <section className="st-section" aria-labelledby="st-extra">
        <h2 id="st-extra" className="st-h">Also email these people</h2>
        <p className="muted">Teammates who should get your alerts and digests. They don&apos;t need an account. Up to 5 addresses, separated by commas or new lines.</p>
        <textarea name="extra_recipients" rows={3} className="input" defaultValue={initial.extraRecipients.join("\n")} placeholder="dispatcher@yourbrokerage.com" aria-labelledby="st-extra" />
      </section>

      <div className="st-save">
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? "Saving..." : "Save settings"}
        </button>
        {state.message ? (
          <p role={state.ok ? "status" : "alert"} className={state.ok ? "st-ok" : "error"}>
            {state.message}
          </p>
        ) : null}
      </div>

    </form>

      <div className="st-billing">
        <p>{billing.line}</p>
        {billing.enforced ? (
          <form action={billing.subscribed || billing.hasCustomer ? "/api/billing/portal" : "/api/billing/checkout"} method="post">
            <button type="submit" className="btn">{billing.subscribed || billing.hasCustomer ? "Manage billing" : "Subscribe"}</button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
