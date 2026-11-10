import type { InsurancePolicy } from "@/lib/fmcsa/types";
import type { Finding } from "./detect";

export const todayIso = (now: Date = new Date()) => now.toISOString().slice(0, 10);

export const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);

/**
 * Liability policies in force today: started, and not yet cancelled. Returns null when policy data is not
 * available at all, which is different from an empty list (the source answered and found none).
 */
export function currentLiability(
  policies: InsurancePolicy[] | null | undefined,
  today: string,
): InsurancePolicy[] | null {
  if (!policies) return null;
  return policies.filter(
    (p) =>
      p.kind === "liability" &&
      (p.effectiveDate === null || p.effectiveDate <= today) &&
      (p.cancelDate === null || p.cancelDate > today),
  );
}

const policyKey = (p: InsurancePolicy) => `${p.policyNumber ?? p.insurer ?? "?"}|${p.cancelDate}`;

/** Policies in force that carry a cancellation date and were not already flagged before. */
export function newCancellations(
  before: InsurancePolicy[],
  now: InsurancePolicy[],
): InsurancePolicy[] {
  const known = new Set(before.filter((p) => p.cancelDate).map(policyKey));
  return now.filter((p) => p.cancelDate && !known.has(policyKey(p)));
}

/** Builds the finding for a cancellation notice. `active` is every liability policy in force, `noticed` the new notices. */
export function cancellationFinding(
  name: string,
  active: InsurancePolicy[],
  noticed: InsurancePolicy[],
  today: string,
): Finding | null {
  if (!noticed.length) return null;
  const earliest = noticed.map((p) => p.cancelDate as string).sort()[0];
  const days = daysBetween(today, earliest);
  const insurers = [...new Set(noticed.map((p) => p.insurer).filter(Boolean))].join(", ") || "the insurer";
  // Coverage lapses only if every policy in force is being cancelled.
  const lapses = active.every((p) => p.cancelDate !== null);
  const when = days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;

  return {
    rule: "insurance_cancellation_notice",
    severity: lapses && days <= 14 ? "critical" : "warning",
    title: `Liability insurance cancellation notice for ${name}`,
    detail:
      `A cancellation notice is on file for the liability policy with ${insurers}, effective ${earliest} (${when}). ` +
      (lapses
        ? "No other active liability policy is on file, so coverage will lapse unless it is replaced. Ask the carrier for a new certificate."
        : "Another active liability policy is on file, but confirm it covers the loads you plan to tender."),
    before: null,
    after: `cancels ${earliest}`,
  };
}
