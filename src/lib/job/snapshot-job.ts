import { sendEmail } from "@/lib/alerts/email";
import { summarizeFindings } from "@/lib/alerts/summarize";
import { carryForward } from "@/lib/fmcsa/carry-forward";
import type { CarrierSnapshot, FmcsaProvider } from "@/lib/fmcsa/types";
import { bySeverity, detectChanges, type Finding } from "@/lib/rules/detect";

export interface Watcher {
  userId: string;
  email: string;
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
    let emailed = false;
    try {
      emailed = await d.send({
        to: w.email,
        carrierName: name,
        dotNumber: dot,
        summary,
        findings,
      });
    } catch (e) {
      r.errors.push({ dotNumber: dot, message: `email to ${w.userId} failed: ${(e as Error).message}` });
    }
    if (emailed) r.emailsSent++;
    for (const id of alertIds) await d.store.recordDelivery(id, w.userId, emailed, summary);
  }
}

export async function runSnapshotJob(deps: JobDeps): Promise<JobResult> {
  const d: Required<JobDeps> = {
    summarize: summarizeFindings,
    send: sendEmail,
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
