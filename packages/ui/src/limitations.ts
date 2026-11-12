const LIMITATION_LABELS: Record<string, { el: string; en: string }> = {
  "insufficient data": { el: "Ανεπαρκή δεδομένα", en: "Insufficient data" },
  "llm unavailable": { el: "Μη διαθέσιμο μοντέλο γλώσσας", en: "Language model unavailable" },
  "llm partial": { el: "Μερική απάντηση από το μοντέλο", en: "Partial model answer" },
  "internal error": { el: "Εσωτερικό σφάλμα", en: "Internal error" },
};

export function formatLimitation(
  item: string,
  t: (value: { el: string; en: string }) => string
): string {
  const known = LIMITATION_LABELS[item];
  if (known) return t(known);
  if (item.startsWith("truncated to ")) {
    const limit = item.slice("truncated to ".length);
    return t({ el: `Περικοπή στα ${limit} αποτελέσματα`, en: `Truncated to ${limit} records` });
  }
  return item;
}
