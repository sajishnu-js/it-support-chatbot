import { categoryMeta } from "@/lib/categories";
import type { Conversation } from "@/lib/types";

/** Builds a plain-text ticket summary from a real conversation — every line
 * is derived from actual messages/sources, nothing invented. */
export function buildTicketSummary(conversation: Conversation): string {
  const { title, messages } = conversation;

  const citedFilenames = new Set<string>();
  const categoryCounts = new Map<string, number>();
  for (const m of messages) {
    for (const s of m.sources ?? []) {
      citedFilenames.add(s.filename);
      // Category of what actually answered the question — not the tangential
      // "related" suggestions, which by definition exclude the cited docs.
      categoryCounts.set(s.category, (categoryCounts.get(s.category) ?? 0) + 1);
    }
  }
  const topCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const categoryLabel = topCategory ? categoryMeta(topCategory).label : "General";

  const lines: string[] = [];
  lines.push(`Subject: ${title}`);
  lines.push(`Category: ${categoryLabel}`);
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("");
  lines.push("--- Conversation ---");
  lines.push("");

  for (const m of messages) {
    if (m.role === "user") {
      lines.push(`Q: ${m.content}`);
    } else if (m.status === "done" && m.content) {
      lines.push(`A: ${m.content}`);
    } else {
      continue;
    }
    lines.push("");
  }

  if (citedFilenames.size > 0) {
    lines.push("--- Sources referenced ---");
    for (const name of citedFilenames) lines.push(`- ${name}`);
    lines.push("");
  }

  lines.push("(Generated from the chat transcript above — paste into your ticketing system.)");

  return lines.join("\n");
}

export function ticketSummaryFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `ticket-summary-${slug || "conversation"}.txt`;
}
