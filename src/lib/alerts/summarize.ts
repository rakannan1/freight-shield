import type { Finding } from "@/lib/rules/detect";

/** Deterministic fallback, also used when no Claude key is set. */
export function plainSummary(carrierName: string, findings: Finding[]): string {
  const lines = findings.map((f) => `- [${f.severity.toUpperCase()}] ${f.title}: ${f.detail}`);
  return `Changes detected for ${carrierName}:\n${lines.join("\n")}`;
}

/**
 * Ask Claude to explain the findings to a freight broker in a few plain sentences.
 * Claude only explains what the rules already decided; it never adds facts or decides severity.
 * Falls back to plainSummary on any failure.
 */
export async function summarizeFindings(
  carrierName: string,
  findings: Finding[],
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || findings.length === 0) return plainSummary(carrierName, findings);

  const facts = findings.map((f) => ({
    severity: f.severity,
    title: f.title,
    detail: f.detail,
  }));

  try {
    const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
        max_tokens: 400,
        system:
          "You write short alerts for freight brokers about changes to a carrier's FMCSA record. " +
          "Use only the facts provided. Do not speculate about fraud, do not invent details, and do not " +
          "change the severity. In 2 to 4 plain sentences, say what changed, why it matters when " +
          "tendering a load, and one concrete next step (for example, verify by calling a known number). " +
          "No headings, no markdown, no bullet points.",
        messages: [
          {
            role: "user",
            content: `Carrier: ${carrierName}\nFindings (JSON):\n${JSON.stringify(facts)}`,
          },
        ],
      }),
    });
    if (!res.ok) return plainSummary(carrierName, findings);
    const body = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = body.content?.find((c) => c.type === "text")?.text?.trim();
    return text ? text : plainSummary(carrierName, findings);
  } catch {
    return plainSummary(carrierName, findings);
  }
}
