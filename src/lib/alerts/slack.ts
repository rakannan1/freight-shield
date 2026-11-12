import type { Finding } from "@/lib/rules/detect";
import { isSlackWebhook } from "./settings";

export function slackText(carrierName: string, dot: string, summary: string, findings: Finding[]): string {
  const lines = findings.map((f) => `• *${f.severity.toUpperCase()}* ${f.title}`);
  return `*${carrierName}* (DOT ${dot})\n${lines.join("\n")}\n${summary}`.slice(0, 3000);
}

/** Posts to an incoming webhook. Only Slack's own webhook host is allowed. Returns true if posted. */
export async function postSlack(url: string, text: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!isSlackWebhook(url)) return false;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return res.ok;
}
