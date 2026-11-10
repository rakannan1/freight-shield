import type { CarrierSnapshot } from "@/lib/fmcsa/types";
import { formatPhone } from "@/lib/phone";
import type { Severity } from "@/lib/rules/detect";

export interface WatchRow {
  dot_number: string;
  carriers: { legal_name: string | null; mc_number: string | null } | null;
}
export interface SnapRow {
  dot_number: string;
  data: CarrierSnapshot;
  fetched_at: string;
}
export interface AlertRow {
  id: string;
  dot_number: string;
  rule: string;
  severity: Severity;
  title: string;
  detail: string;
  before_value: unknown;
  after_value: unknown;
  created_at: string;
}
export interface DeliveryRow {
  alert_id: string;
  summary: string | null;
}

export interface Change {
  label: string;
  before: string;
  after: string;
}

export interface AlertGroup {
  key: string;
  dot: string;
  carrierName: string;
  severity: Severity;
  title: string;
  summary: string;
  changes: Change[];
  alertIds: string[];
  createdAt: string;
  reviewed: boolean;
}

export type RowStatus = "critical" | "warning" | "ok";

export interface CarrierRow {
  dot: string;
  name: string;
  status: RowStatus;
  statusLabel: string;
  authority: string;
  insurance: string;
  lastChangeAt: string | null;
}

export interface Stats {
  watched: number;
  openAlerts: number;
  critical: number;
  lastCheckAt: string | null;
}

export interface DashboardModel {
  stats: Stats;
  groups: AlertGroup[];
  rows: CarrierRow[];
}

const RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

const RULE_LABEL: Record<string, string> = {
  not_allowed_to_operate: "Allowed to operate",
  authority_lost: "Authority status",
  authority_activated: "Authority status",
  phone_changed: "Phone number",
  insurance_dropped: "Liability insurance on file",
  insurance_decreased: "Liability insurance on file",
  insurance_below_required: "Liability insurance on file",
  insurance_cancellation_notice: "Liability insurance policy",
  cargo_insurance_dropped: "Cargo insurance on file",
  name_changed: "Legal name",
  address_changed: "Address",
  dba_changed: "DBA name",
  out_of_service: "Out-of-service date",
  fleet_size_swing: "Power units",
};

function fmt(rule: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "none";
  if (rule === "phone_changed") return formatPhone(String(v));
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") return rule.startsWith("insurance") ? usd(v) : String(v);
  if (rule === "authority_lost") return v === "A" ? "Active" : v === "I" ? "Inactive" : v === "N" ? "None" : String(v);
  return String(v);
}

export function changesFor(a: AlertRow): Change[] {
  if (a.rule === "identity_change") {
    type Parts = { legalName?: string; address?: string; phone?: string };
    const b = (a.before_value ?? {}) as Parts;
    const n = (a.after_value ?? {}) as Parts;
    const rows: Change[] = [];
    // Only the details that actually changed are stored, so only those get a row.
    if (b.legalName !== undefined || n.legalName !== undefined) {
      rows.push({ label: "Legal name", before: fmt(a.rule, b.legalName), after: fmt(a.rule, n.legalName) });
    }
    if (b.address !== undefined || n.address !== undefined) {
      rows.push({ label: "Address", before: fmt(a.rule, b.address), after: fmt(a.rule, n.address) });
    }
    if (b.phone !== undefined || n.phone !== undefined) {
      rows.push({ label: "Phone number", before: formatPhone(b.phone), after: formatPhone(n.phone) });
    }
    return rows;
  }
  return [
    {
      label: RULE_LABEL[a.rule] ?? a.rule,
      before: fmt(a.rule, a.before_value),
      after: fmt(a.rule, a.after_value),
    },
  ];
}

export function authoritySummary(s: CarrierSnapshot | undefined): string {
  if (!s) return "Not checked yet";
  const active = [
    s.commonAuthority === "A" ? "Common" : null,
    s.contractAuthority === "A" ? "Contract" : null,
    s.brokerAuthority === "A" ? "Broker" : null,
  ].filter(Boolean);
  return active.length ? active.join(", ") : "None active";
}

export function insuranceSummary(s: CarrierSnapshot | undefined): string {
  if (!s || s.bipdOnFile === null) return "Unknown";
  return usd(s.bipdOnFile);
}

export function buildDashboard(input: {
  watches: WatchRow[];
  snapshots: SnapRow[];
  alerts: AlertRow[];
  deliveries: DeliveryRow[];
  reviewedAlertIds: string[];
}): DashboardModel {
  const reviewed = new Set(input.reviewedAlertIds);
  const summaryById = new Map(input.deliveries.map((d) => [d.alert_id, d.summary ?? ""]));
  const snapByDot = new Map(input.snapshots.map((s) => [s.dot_number, s]));
  const nameByDot = new Map(
    input.watches.map((w) => [
      w.dot_number,
      w.carriers?.legal_name || snapByDot.get(w.dot_number)?.data.legalName || `DOT ${w.dot_number}`,
    ]),
  );
  const watched = new Set(input.watches.map((w) => w.dot_number));

  // Group findings from the same run (same carrier, same email summary) into one card.
  const grouped = new Map<string, AlertRow[]>();
  for (const a of input.alerts) {
    if (!watched.has(a.dot_number)) continue;
    const key = `${a.dot_number}|${summaryById.get(a.id) || a.created_at.slice(0, 16)}`;
    grouped.set(key, [...(grouped.get(key) ?? []), a]);
  }

  const groups: AlertGroup[] = [...grouped.entries()].map(([key, items]) => {
    const sorted = [...items].sort((a, b) => RANK[a.severity] - RANK[b.severity]);
    const worst = sorted[0];
    const more = sorted.length - 1;
    return {
      key,
      dot: worst.dot_number,
      carrierName: nameByDot.get(worst.dot_number) ?? `DOT ${worst.dot_number}`,
      severity: worst.severity,
      title: more > 0 ? `${worst.title} (+${more} more)` : worst.title,
      summary: summaryById.get(worst.id) || sorted.map((i) => i.detail).join(" "),
      changes: sorted.flatMap(changesFor),
      alertIds: sorted.map((i) => i.id),
      createdAt: sorted.reduce((m, i) => (i.created_at > m ? i.created_at : m), sorted[0].created_at),
      reviewed: sorted.every((i) => reviewed.has(i.id)),
    };
  });
  groups.sort((a, b) => RANK[a.severity] - RANK[b.severity] || b.createdAt.localeCompare(a.createdAt));

  const open = groups.filter((g) => !g.reviewed);

  const rows: CarrierRow[] = input.watches.map((w) => {
    const snap = snapByDot.get(w.dot_number)?.data;
    const mine = open.filter((g) => g.dot === w.dot_number);
    const all = groups.filter((g) => g.dot === w.dot_number);
    const worst = mine.length ? mine.reduce((m, g) => (RANK[g.severity] < RANK[m.severity] ? g : m)) : null;
    const status: RowStatus = !worst ? "ok" : worst.severity === "critical" ? "critical" : "warning";
    return {
      dot: w.dot_number,
      name: snap?.legalName || nameByDot.get(w.dot_number) || `DOT ${w.dot_number}`,
      status,
      statusLabel: status === "critical" ? "Critical" : status === "warning" ? "Warning" : "No changes",
      authority: authoritySummary(snap),
      insurance: insuranceSummary(snap),
      lastChangeAt: all.length ? all.reduce((m, g) => (g.createdAt > m ? g.createdAt : m), all[0].createdAt) : null,
    };
  });
  const sev: Record<RowStatus, number> = { critical: 0, warning: 1, ok: 2 };
  rows.sort((a, b) => sev[a.status] - sev[b.status] || a.name.localeCompare(b.name));

  const lastCheckAt = input.snapshots.reduce<string | null>(
    (m, s) => (m === null || s.fetched_at > m ? s.fetched_at : m),
    null,
  );

  return {
    stats: {
      watched: input.watches.length,
      openAlerts: open.length,
      critical: open.filter((g) => g.severity === "critical").length,
      lastCheckAt,
    },
    groups,
    rows,
  };
}
