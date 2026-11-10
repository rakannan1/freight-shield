import type { CarrierSnapshot } from "@/lib/fmcsa/types";
import { bySeverity, type Finding } from "./detect";
import { cancellationFinding, currentLiability, todayIso } from "./policies";

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

/**
 * One-time check of a single snapshot, run when a carrier is added so a broker sees problems right away
 * instead of waiting for something to change. Same rule: deterministic, no LLM involved.
 *
 * Missing data is reported as unknown, never as a problem.
 */
export function assessCarrier(s: CarrierSnapshot): Finding[] {
  const out: Finding[] = [];
  const name = s.legalName || `DOT ${s.dotNumber}`;

  if (!s.allowedToOperate) {
    out.push({
      rule: "not_allowed_to_operate",
      severity: "critical",
      title: `${name} is not allowed to operate`,
      detail: "FMCSA lists this carrier as not allowed to operate. Do not tender loads.",
      before: null,
      after: false,
    });
  }

  // Only judge authority when FMCSA actually returned a status for common or contract.
  const authorityKnown = s.commonAuthority !== null || s.contractAuthority !== null;
  if (authorityKnown && s.commonAuthority !== "A" && s.contractAuthority !== "A") {
    out.push({
      rule: "no_active_authority",
      severity: "critical",
      title: `No active carrier authority for ${name}`,
      detail:
        "FMCSA shows no active common or contract authority. Most for-hire carriers need one of them to haul " +
        "freight for others, so confirm why before tendering a load.",
      before: null,
      after: { common: s.commonAuthority, contract: s.contractAuthority },
    });
  }

  const today = todayIso(new Date(s.fetchedAt));
  const active = currentLiability(s.policies, today);
  const forHire = s.commonAuthority === "A" || s.contractAuthority === "A";
  const insuranceMandatory = (s.bipdRequired ?? 0) > 0 || forHire;

  if (s.bipdOnFile === 0 && insuranceMandatory) {
    out.push({
      rule: "no_insurance",
      severity: "critical",
      title: `No liability insurance on file for ${name}`,
      detail: "FMCSA shows $0 of liability insurance on file. Do not tender loads until the carrier shows a current certificate.",
      before: null,
      after: 0,
    });
  } else if (s.bipdOnFile !== null && s.bipdRequired !== null && s.bipdOnFile < s.bipdRequired) {
    out.push({
      rule: "insurance_below_required",
      severity: "critical",
      title: `Insurance below the required minimum for ${name}`,
      detail: `On file ${usd(s.bipdOnFile)}, required ${usd(s.bipdRequired)}.`,
      before: null,
      after: s.bipdOnFile,
    });
  } else if (s.bipdOnFile === null && active && active.length === 0 && forHire) {
    // The policy source answered and found no liability filing in force. Data we could not get is not reported.
    out.push({
      rule: "no_insurance",
      severity: "warning",
      title: `No active liability filing found for ${name}`,
      detail: "The insurance filings list shows no liability policy in force. Ask the carrier for a current certificate.",
      before: null,
      after: 0,
    });
  }

  if (active) {
    const f = cancellationFinding(name, active, active.filter((p) => p.cancelDate), today);
    if (f) out.push(f);
  }

  // Cargo cover is only required of household-goods carriers, so it is flagged only when FMCSA says it is required.
  if (s.cargoRequired === true && s.cargoOnFile === false) {
    out.push({
      rule: "no_cargo_insurance",
      severity: "warning",
      title: `No cargo insurance on file for ${name}`,
      detail: "Cargo insurance is required for this carrier and FMCSA shows none on file.",
      before: null,
      after: false,
    });
  }

  if (s.outOfServiceDate) {
    out.push({
      rule: "out_of_service",
      severity: "critical",
      title: `${name} has an out-of-service date`,
      detail: `FMCSA lists an out-of-service date of ${s.outOfServiceDate}.`,
      before: null,
      after: s.outOfServiceDate,
    });
  }

  return out.sort(bySeverity);
}
