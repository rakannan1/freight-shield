/** Made-up carriers for the landing-page demo. Nothing here is real, and the page says so. */

export type DemoSeverity = "critical" | "warning" | "ok";

export interface DemoFinding {
  severity: DemoSeverity;
  title: string;
  detail: string;
  /** Where the fact comes from. */
  source: string;
  /** What the record shows now. */
  value: string;
  checked: string;
  next: string;
}

export interface DemoChange {
  when: string;
  field: string;
  before: string;
  after: string;
  why: string;
}

export interface DemoCarrier {
  mc: string;
  dot: string;
  name: string;
  location: string;
  verdict: { level: DemoSeverity; text: string };
  findings: DemoFinding[];
  unverified: string[];
  history: DemoChange[];
  blurb: string;
}

const CHECKED = "Today, 6:02 AM (sample)";

export const DEMO_CARRIERS: DemoCarrier[] = [
  {
    mc: "900001",
    dot: "9000001",
    name: "Prairie Line Freight LLC",
    location: "Omaha, NE",
    blurb: "Clean",
    verdict: { level: "ok", text: "Nothing concerning in the FMCSA records we check" },
    findings: [
      {
        severity: "ok",
        title: "Operating authority is active",
        detail: "Common authority is active and the carrier is allowed to operate.",
        source: "FMCSA registration record",
        value: "Common authority: Active",
        checked: CHECKED,
        next: "No action needed. We keep checking every morning.",
      },
      {
        severity: "ok",
        title: "Liability insurance meets the requirement",
        detail: "$1,000,000 of liability coverage is on file against a $750,000 requirement.",
        source: "FMCSA insurance record",
        value: "On file $1,000,000 · required $750,000",
        checked: CHECKED,
        next: "Still ask for a current certificate if your customer contract requires one.",
      },
      {
        severity: "ok",
        title: "Name, address and phone are unchanged",
        detail: "No change to the carrier's identity details since we started watching.",
        source: "FMCSA registration record",
        value: "No changes in 90 days",
        checked: CHECKED,
        next: "No action needed.",
      },
    ],
    unverified: [
      "Whether the person you are dealing with works for this carrier",
      "Cargo coverage details, which FMCSA does not list for most carriers",
      "Safety performance beyond what is on the registration record",
    ],
    history: [],
  },
  {
    mc: "900002",
    dot: "9000002",
    name: "Bluewater Haulers Inc",
    location: "Tampa, FL",
    blurb: "Authority lapsed",
    verdict: { level: "critical", text: "Don't book until this is resolved" },
    findings: [
      {
        severity: "critical",
        title: "Common authority is no longer active",
        detail: "FMCSA now shows this carrier's common authority as inactive. It cannot lawfully haul freight for others under it.",
        source: "FMCSA registration record",
        value: "Common authority: Inactive (was Active)",
        checked: CHECKED,
        next: "Don't tender new loads. Ask the carrier for current authority paperwork, and check any load already booked with them.",
      },
      {
        severity: "warning",
        title: "A liability insurance cancellation notice is on file",
        detail: "The insurer has filed a cancellation effective in 9 days. No replacement policy is on file.",
        source: "FMCSA insurance filings",
        value: "Cancellation effective in 9 days",
        checked: CHECKED,
        next: "Ask the carrier for proof of replacement coverage before the cancellation date.",
      },
    ],
    unverified: [
      "Whether the authority lapse is a paperwork delay the carrier is already fixing",
      "Whether the carrier has new authority under a different MC number",
    ],
    history: [
      { when: "2 days ago", field: "Common authority", before: "Active", after: "Inactive", why: "Loss of authority means the carrier can't haul for others." },
      { when: "6 days ago", field: "Insurance", before: "No notice", after: "Cancellation effective in 9 days", why: "Coverage may lapse without a replacement." },
    ],
  },
  {
    mc: "900003",
    dot: "9000003",
    name: "Summit Cargo Express",
    location: "Dallas, TX",
    blurb: "Identity change",
    verdict: { level: "critical", text: "Verify before booking: identity details changed together" },
    findings: [
      {
        severity: "critical",
        title: "Phone and address both changed",
        detail: "The carrier's phone number and address changed within the same check. Changes together are a common sign of a hijacked or impersonated carrier.",
        source: "FMCSA registration record",
        value: "Phone and address differ from last week",
        checked: CHECKED,
        next: "Call the carrier on the number you already had on file, not the new one, and confirm the change before booking.",
      },
      {
        severity: "ok",
        title: "Operating authority is active",
        detail: "Authority itself has not changed.",
        source: "FMCSA registration record",
        value: "Common authority: Active",
        checked: CHECKED,
        next: "No action needed.",
      },
    ],
    unverified: [
      "Who now owns the new phone number",
      "Whether the address change is a genuine move",
    ],
    history: [
      { when: "1 day ago", field: "Phone", before: "(555) 010-0142", after: "(555) 010-0987", why: "A new number can send your calls to someone else." },
      { when: "1 day ago", field: "Address", before: "88 Commerce St, Dallas, TX", after: "410 Harbor Way, Reno, NV", why: "Changed in the same check as the phone number." },
    ],
  },
];

/** Matches "MC 900001", "mc-900001", "900001" or a DOT number against the sample carriers. */
export function findDemoCarrier(input: string): DemoCarrier | null {
  const digits = input.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return null;
  return DEMO_CARRIERS.find((c) => c.mc === digits || c.dot === digits) ?? null;
}
