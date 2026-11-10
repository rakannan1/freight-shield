/** Reduces a phone number to digits so formatting changes never look like a real change. Null when there is none. */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  let digits = String(raw).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1); // US country code
  return digits.length >= 7 ? digits : null;
}

/** "5551234567" becomes "(555) 123-4567". Other lengths are returned unchanged. */
export function formatPhone(digits: string | null | undefined): string {
  if (!digits) return "none";
  return digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : digits;
}
