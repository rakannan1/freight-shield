import { sendEmail } from "@/lib/alerts/email";
import { routeFinding } from "@/lib/alerts/routing";
import { IMMEDIATE_ALL, type AlertSettings } from "@/lib/alerts/settings";
import { postSlack, slackText } from "@/lib/alerts/slack";
import { sendSms, smsBody } from "@/lib/alerts/sms";
import { summarizeFindings } from "@/lib/alerts/summarize";
import { carryForward } from "@/lib/fmcsa/carry-forward";
import type { CarrierSnapshot, FmcsaProvider } from "@/lib/fmcsa/types";
import { bySeverity, detectChanges, type Finding } from "@/lib/rules/detect";

export interface Watcher {
  userId: string;
  email: string;
  /** Missing means: email every alert immediately. */
  settings?: AlertSettings;
}

/** Storage boundary so the job can be tested without a database. */
export interface Store {
  listWatchedDotNumbers(): Promise<string[]>;
  latestSnapshot(dotNumber: string): Promise<CarrierSnapshot | null>;
  saveSnapshot(dotNumber: string, snapshot: CarrierSnapshot): Promise<void>;
  saveAlert(dotNumber: string, finding: Finding): Promise<string>;
  watchersOf(dotNumber: string): Promise<Watcher[]>;
  recordDelivery(alertId: string, userId: string, emailed: boolean, summary: string): Promise<void>;
}

export interface JobResult {
  carriers: number;
  notFound: string[];
  errors: { dotNumber: string; message: string }[];
  alerts: number;
  emailsSent: number;
}

export interface JobDeps {
  store: Store;
  provider: FmcsaProvider;
  summarize?: typeof summarizeFindings;
  send?: typeof sendEmail;
  sendSms?: typeof sendSms;
  postSlack?: typeof postSlack;
  concurrency?: number;
}

async function processCarrier(dot: string, d: Required<JobDeps>, r: JobResult) {
  const fetched = await d.provider.getCarrierByDot(dot);
  if (!fetched) {
    r.notFound.push(dot);
    return;
  }
  const prev = await d.store.latestSnapshot(dot);
  const curr = carryForward(prev, fetched);
  await d.store.saveSnapshot(dot, curr);
  r.carriers++;

  // First snapshot is the baseline: nothing to compare against, so no alerts.
  if (!prev) return;

  const findings = detectChanges(prev, curr).sort(bySeverity);
  if (findings.length === 0) return;

  const alertIds: string[] = [];
  for (const f of findings) alertIds.push(await d.store.saveAlert(dot, f));
  r.alerts += findings.length;

  const name = curr.legalName || `DOT ${dot}`;
  const summary = await d.summarize(name, findings);
  const watchers = await d.store.watchersOf(dot);

  for (const w of watchers) {
    const settings = w.settings ?? IMMEDIATE_ALL;
    const routes = findings.map((f) => ({ f, route: routeFinding(settings, f.severity) }));
    const fail = (what: string, e: unknown) =>
      r.errors.push({ dotNumber: dot, message: `${what} for ${w.userId} failed: ${(e as Error).message}` });

    // Email: only what is due now. The rest waits for the digest. Extra recipients get copies.
    let emailed = false;
    const nowFindings = routes.filter((x) => x.route.emailNow).map((x) => x.f);
    if (nowFindings.length) {
      for (const to of [w.email, ...settings.extraRecipients]) {
        try {
          const ok = await d.send({ to, carrierName: name, dotNumber: dot, summary, findings: nowFindings });
          if (ok) r.emailsSent++;
          if (to === w.email) emailed = ok;
        } catch (e) {
          fail(`email to ${to}`, e);
        }
      }
    }

    const smsFindings = routes.filter((x) => x.route.sms).map((x) => x.f);
    if (smsFindings.length && settings.smsPhone) {
      try {
        await d.sendSms(settings.smsPhone, smsBody(name, smsFindings));
      } catch (e) {
        fail("text message", e);
      }
    }

    const slackFindings = routes.filter((x) => x.route.slack).map((x) => x.f);
    if (slackFindings.length && settings.slackWebhookUrl) {
      try {
        await d.postSlack(settings.slackWebhookUrl, slackText(name, dot, summary, slackFindings));
      } catch (e) {
        fail("Slack post", e);
      }
    }

    for (const id of alertIds) await d.store.recordDelivery(id, w.userId, emailed, summary);
  }
}

export async function runSnapshotJob(deps: JobDeps): Promise<JobResult> {
  const d: Required<JobDeps> = {
    summarize: summarizeFindings,
    send: sendEmail,
    sendSms,
    postSlack,
    concurrency: 5,
    ...deps,
  };
  const result: JobResult = { carriers: 0, notFound: [], errors: [], alerts: 0, emailsSent: 0 };
  const dots = await d.store.listWatchedDotNumbers();

  // Small worker pool; one carrier failing never stops the rest.
  let i = 0;
  const worker = async () => {
    while (i < dots.length) {
      const dot = dots[i++];
      try {
        await processCarrier(dot, d, result);
      } catch (e) {
        result.errors.push({ dotNumber: dot, message: (e as Error).message });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(d.concurrency, dots.length) }, worker));
  return result;
}
