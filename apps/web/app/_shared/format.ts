export type Lang = "el" | "en";

function locale(lang: Lang): string {
  return lang === "el" ? "el-GR" : "en-GB";
}

export function fmtDate(value: string | null | undefined, lang: Lang): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  try {
    return new Intl.DateTimeFormat(locale(lang), { dateStyle: "medium" }).format(d);
  } catch {
    return value;
  }
}

export function fmtDateTime(value: string | null | undefined, lang: Lang): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  try {
    return new Intl.DateTimeFormat(locale(lang), {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return value;
  }
}

export function fmtEUR(value: number | null | undefined, lang: Lang): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat(locale(lang), {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} €`;
  }
}

export function fmtNum(value: number | null | undefined, lang: Lang): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat(locale(lang), { maximumFractionDigits: 2 }).format(value);
  } catch {
    return String(value);
  }
}

export function pctValue(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  const v = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${pctValue(value)}%`;
}

export function fmtConfidence(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const v = value <= 1 ? Math.round(value * 100) : Math.round(value);
  return `${v}%`;
}

export function fmtBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
}

export function fmtRange(range: [number, number] | null | undefined, lang: Lang): string {
  if (!range || range.length < 2) return "—";
  return `${fmtNum(range[0], lang)}–${fmtNum(range[1], lang)}`;
}

export function fmtDelta(value: number | null | undefined, lang: Lang): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${fmtNum(value, lang)}`;
}

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(
  rows: Record<string, unknown>[],
  columns: { key: string; header: string }[]
): string {
  const head = columns.map((c) => csvEscape(c.header)).join(",");
  const body = rows.map((row) =>
    columns.map((c) => csvEscape(row[c.key])).join(",")
  );
  return [head, ...body].join("\r\n");
}

export function downloadBlob(
  content: string | Blob,
  filename: string,
  mime: string
): void {
  const blob =
    typeof content === "string" ? new Blob([content], { type: mime }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
