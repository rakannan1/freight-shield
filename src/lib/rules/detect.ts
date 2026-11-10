import type { CarrierSnapshot } from "@/lib/fmcsa/types";
import { formatPhone } from "@/lib/phone";
import { cancellationFinding, currentLiability, newCancellations, todayIso } from "./policies";

export type Severity = "info" | "warning" | "critical";

export interface Finding {
  rule: string;
  severity: Severity;
  title: string;
  detail: string;
  before: unknown;
  after: unknown;
}

const usd = (n: number | null) => (n === null ? "unknown" : `$${n.toLocaleString("en-US")}`);
const isActive = (s: string | null) => s === "A";
const authLabel = (s: string | null) =>
  s === "A" ? "active" : s === "I" ? "inactive" : s === "N" ? "none" : "unknown";

const AUTHORITIES = [
  ["commonAuthority", "Common"],
  ["contractAuthority", "Contract"],
  ["brokerAuthority", "Broker"],
] as const;

/**
 * Compare two snapshots of the same carrier and return findings.
 * Pure and deterministic: all alert decisions are made here, never by an LLM.
 */
export function detectChanges(prev: CarrierSnapshot, curr: CarrierSnapshot): Finding[] {
  const out: Finding[] = [];
  const name = curr.legalName || prev.legalName || `DOT ${curr.dotNumber}`;

  // 1. Cleared to operate
  if (prev.allowedToOperate && !curr.allowedToOperate) {
    out.push({
      rule: "not_allowed_to_operate",
      severity: "critical",
      title: `${name} is no longer allowed to operate`,
      detail: "FMCSA now lists this carrier as not allowed to operate. Do not tender loads until resolved.",
      before: prev.allowedToOperate,
      after: curr.allowedToOperate,
    });
  }

  // 2. Operating authority lost
  for (const [field, label] of AUTHORITIES) {
    // An unknown status today (null) is a data gap, not a loss.
    if (isActive(prev[field]) && curr[field] !== null && !isActive(curr[field])) {
      out.push({
        rule: "authority_lost",
        severity: "critical",
        title: `${label} authority is no longer active for ${name}`,
        detail: `${label} authority changed from ${authLabel(prev[field])} to ${authLabel(curr[field])}.`,
        before: prev[field],
        after: curr[field],
      });
    }
  }

  // 2b. Authority newly active or reactivated. Authority that has just come back, or just been granted,
  // is a known pattern in carrier fraud, so it is worth a look even though it is not bad news by itself.
  const gained = AUTHORITIES.filter(([field]) => prev[field] !== null && !isActive(prev[field]) && isActive(curr[field]));
  if (gained.length) {
    const reactivated = gained.some(([field]) => prev[field] === "I");
    const labels = gained.map(([, label]) => label).join(", ");
    out.push({
      rule: "authority_activated",
      severity: "warning",
      title: reactivated ? `Authority reactivated for ${name}` : `New authority granted for ${name}`,
      detail:
        `${labels} authority is now active (was ${gained.map(([field]) => authLabel(prev[field])).join(", ")}). ` +
        `Check how long this carrier has really been operating, and confirm its identity before tendering loads.`,
      before: gained.map(([field, label]) => `${label}: ${authLabel(prev[field])}`).join(", "),
      after: gained.map(([, label]) => `${label}: active`).join(", "),
    });
  }

  // 3. Insurance
  if (prev.bipdOnFile !== null && curr.bipdOnFile !== null) {
    if (curr.bipdOnFile === 0 && prev.bipdOnFile > 0) {
      out.push({
        rule: "insurance_dropped",
        severity: "critical",
        title: `Liability insurance dropped off for ${name}`,
        detail: `Liability insurance on file went from ${usd(prev.bipdOnFile)} to $0.`,
        before: prev.bipdOnFile,
        after: curr.bipdOnFile,
      });
    } else if (curr.bipdOnFile < prev.bipdOnFile) {
      out.push({
        rule: "insurance_decreased",
        severity: "warning",
        title: `Liability insurance decreased for ${name}`,
        detail: `Liability insurance on file went from ${usd(prev.bipdOnFile)} to ${usd(curr.bipdOnFile)}.`,
        before: prev.bipdOnFile,
        after: curr.bipdOnFile,
      });
    }
  }
  if (
    curr.bipdRequired !== null &&
    curr.bipdOnFile !== null &&
    curr.bipdOnFile < curr.bipdRequired &&
    !(prev.bipdOnFile !== null && prev.bipdRequired !== null && prev.bipdOnFile < prev.bipdRequired)
  ) {
    out.push({
      rule: "insurance_below_required",
      severity: "critical",
      title: `Insurance below the required minimum for ${name}`,
      detail: `On file ${usd(curr.bipdOnFile)}, required ${usd(curr.bipdRequired)}.`,
      before: prev.bipdOnFile,
      after: curr.bipdOnFile,
    });
  }
  // Cancellation notices from the insurance source (only when both days have policy data).
  if (prev.policies && curr.policies) {
    const today = todayIso(new Date(curr.fetchedAt));
    const active = currentLiability(curr.policies, today) ?? [];
    const f = cancellationFinding(
      name,
      active,
      newCancellations(currentLiability(prev.policies, todayIso(new Date(prev.fetchedAt))) ?? [], active),
      today,
    );
    if (f) out.push(f);
  }
  if (prev.cargoOnFile === true && curr.cargoOnFile === false) {
    out.push({
      rule: "cargo_insurance_dropped",
      severity: "warning",
      title: `Cargo insurance no longer on file for ${name}`,
      detail: "Cargo insurance was on file before and no longer is.",
      before: true,
      after: false,
    });
  }

  // 4. Identity changes: name, address and phone. One alone is a warning. Two or more at once match the
  // identity-takeover pattern, so they are combined into a single critical finding.
  const nameChanged = prev.legalName !== curr.legalName && prev.legalName !== "" && curr.legalName !== "";
  const addressChanged = prev.address !== curr.address && prev.address !== "" && curr.address !== "";
  // A missing phone (null, or not stored in an older snapshot) is "unknown", never a change.
  const phoneChanged = Boolean(prev.phone) && Boolean(curr.phone) && prev.phone !== curr.phone;
  const dbaChanged = (prev.dbaName ?? "") !== (curr.dbaName ?? "");

  const changedKinds = [nameChanged && "name", addressChanged && "address", phoneChanged && "phone"].filter(
    Boolean,
  ) as string[];

  if (changedKinds.length >= 2) {
    const before: Record<string, string> = {};
    const after: Record<string, string> = {};
    const parts: string[] = [];
    if (nameChanged) {
      before.legalName = prev.legalName;
      after.legalName = curr.legalName;
      parts.push(`legal name from "${prev.legalName}" to "${curr.legalName}"`);
    }
    if (addressChanged) {
      before.address = prev.address;
      after.address = curr.address;
      parts.push(`address from "${prev.address}" to "${curr.address}"`);
    }
    if (phoneChanged) {
      before.phone = prev.phone as string;
      after.phone = curr.phone as string;
      parts.push(`phone from ${formatPhone(prev.phone)} to ${formatPhone(curr.phone)}`);
    }
    const list =
      changedKinds.length === 2
        ? `${changedKinds[0]} and ${changedKinds[1]} both`
        : `${changedKinds.slice(0, -1).join(", ")} and ${changedKinds.at(-1)} all`;
    out.push({
      rule: "identity_change",
      severity: "critical",
      title: `${list.charAt(0).toUpperCase()}${list.slice(1)} changed for DOT ${curr.dotNumber}`,
      detail:
        `Changed: ${parts.join("; ")}. Changing several identifying details at once is a common ` +
        `identity-takeover pattern; verify the carrier by phone using a number you already trust, not the new one.`,
      before,
      after,
    });
  } else {
    if (nameChanged) {
      out.push({
        rule: "name_changed",
        severity: "warning",
        title: `Legal name changed for DOT ${curr.dotNumber}`,
        detail: `Legal name changed from "${prev.legalName}" to "${curr.legalName}".`,
        before: prev.legalName,
        after: curr.legalName,
      });
    }
    if (addressChanged) {
      out.push({
        rule: "address_changed",
        severity: "warning",
        title: `Address changed for ${name}`,
        detail: `Address changed from "${prev.address}" to "${curr.address}".`,
        before: prev.address,
        after: curr.address,
      });
    }
    if (phoneChanged) {
      out.push({
        rule: "phone_changed",
        severity: "warning",
        title: `Phone number changed for ${name}`,
        detail:
          `The phone number on the FMCSA record changed from ${formatPhone(prev.phone)} to ${formatPhone(curr.phone)}. ` +
          `Confirm the new number really belongs to the carrier before using it to verify a load or a driver.`,
        before: prev.phone,
        after: curr.phone,
      });
    }
  }
  if (dbaChanged && !nameChanged) {
    out.push({
      rule: "dba_changed",
      severity: "info",
      title: `DBA name changed for ${name}`,
      detail: `DBA changed from "${prev.dbaName ?? "none"}" to "${curr.dbaName ?? "none"}".`,
      before: prev.dbaName,
      after: curr.dbaName,
    });
  }

  // 5. Out of service
  if (!prev.outOfServiceDate && curr.outOfServiceDate) {
    out.push({
      rule: "out_of_service",
      severity: "critical",
      title: `${name} has an out-of-service date`,
      detail: `FMCSA lists an out-of-service date of ${curr.outOfServiceDate}.`,
      before: prev.outOfServiceDate,
      after: curr.outOfServiceDate,
    });
  }

  // 6. Fleet size swing (more than doubled, or fell by more than half, with a meaningful base)
  if (prev.powerUnits !== null && curr.powerUnits !== null && prev.powerUnits >= 5) {
    if (curr.powerUnits >= prev.powerUnits * 2 || curr.powerUnits <= prev.powerUnits / 2) {
      out.push({
        rule: "fleet_size_swing",
        severity: "info",
        title: `Fleet size changed sharply for ${name}`,
        detail: `Power units went from ${prev.powerUnits} to ${curr.powerUnits}.`,
        before: prev.powerUnits,
        after: curr.powerUnits,
      });
    }
  }

  return out;
}

const ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
export const bySeverity = (a: Finding, b: Finding) => ORDER[a.severity] - ORDER[b.severity];
