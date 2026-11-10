const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/**
 * "Today", "Yesterday", "3 days ago", or "Oct 14" (with the year when it is not the current one).
 * Calendar days are counted in UTC so server-rendered output does not depend on the host time zone.
 */
export function relativeDay(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "None yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "None yet";
  const days = Math.round((utcDay(now) - utcDay(d)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const label = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return d.getUTCFullYear() === now.getUTCFullYear() ? label : `${label}, ${d.getUTCFullYear()}`;
}

/** "Oct 22, 2026" for billing dates. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
