import type { CarrierSnapshot } from "@/lib/fmcsa/types";

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
  for (const [field, label] of [
    ["commonAuthority", "Common"],
    ["contractAuthority", "Contract"],
    ["brokerAuthority", "Broker"],
  ] as const) {
    if (isActive(prev[field]) && !isActive(curr[field])) {
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

  // 4. Identity changes
  const nameChanged = prev.legalName !== curr.legalName && prev.legalName !== "" && curr.legalName !== "";
  const addressChanged = prev.address !== curr.address && prev.address !== "" && curr.address !== "";
  const dbaChanged = (prev.dbaName ?? "") !== (curr.dbaName ?? "");

  if (nameChanged && addressChanged) {
    out.push({
      rule: "identity_change",
      severity: "critical",
      title: `Name and address both changed for DOT ${curr.dotNumber}`,
      detail:
        `Legal name changed from "${prev.legalName}" to "${curr.legalName}" and address from ` +
        `"${prev.address}" to "${curr.address}". Changing both at once is a common identity-takeover pattern; ` +
        `verify the carrier by phone using a number you already trust.`,
      before: { legalName: prev.legalName, address: prev.address },
      after: { legalName: curr.legalName, address: curr.address },
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
