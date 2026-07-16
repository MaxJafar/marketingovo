// CSV export. Flat, Sheets/Excel friendly. One row per (issue, url)
// pair. CSV is a data export, so it includes the complete affected-URL cohort;
// only human-facing HTML/Markdown views sample long lists.
//
// Columns: priority, category, issue_id, message, url, fix

import type { Report } from "./index.js";

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(...cells: string[]): string {
  return cells.map(csvEscape).join(",");
}

export function reportToCsv(r: Report): string {
  const lines: string[] = [];
  lines.push(row("priority", "category", "issue_id", "message", "url", "fix"));
  for (const i of r.issues) {
    if (i.urls.length === 0) {
      lines.push(row(i.priority, i.category, i.id, i.message, "", i.fix ?? ""));
    } else {
      for (const u of i.urls) {
        lines.push(
          row(i.priority, i.category, i.id, i.message, u, i.fix ?? ""),
        );
      }
    }
  }
  // Trailing newline so the file ends cleanly.
  return lines.join("\n") + "\n";
}
