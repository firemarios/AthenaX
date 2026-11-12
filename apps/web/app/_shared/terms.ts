export type BiText = { el: string; en: string };

export const CATEGORY_LABELS: Record<string, BiText> = {
  mobility: { el: "Μετακινητικότητα", en: "Mobility" },
  green: { el: "Πράσινο", en: "Green" },
  housing: { el: "Κατοικία", en: "Housing" },
  environment: { el: "Περιβάλλον", en: "Environment" },
  services: { el: "Υπηρεσίες", en: "Services" },
};

export const CATEGORY_OPTIONS: { value: string; label: BiText }[] = [
  { value: "mobility", label: CATEGORY_LABELS.mobility },
  { value: "green", label: CATEGORY_LABELS.green },
  { value: "housing", label: CATEGORY_LABELS.housing },
  { value: "environment", label: CATEGORY_LABELS.environment },
  { value: "services", label: CATEGORY_LABELS.services },
];

export const POLICY_STATUS_LABELS: Record<string, BiText> = {
  draft: { el: "Σχέδιο", en: "Draft" },
  active: { el: "Ενεργή", en: "Active" },
  archived: { el: "Αρχειοθετημένη", en: "Archived" },
  retired: { el: "Αποσύρθηκε", en: "Retired" },
};

export function categoryLabel(category: string | null | undefined): BiText | null {
  if (!category) return null;
  return CATEGORY_LABELS[category] ?? { el: category, en: category };
}

export function statusLabel(
  status: string | null | undefined,
  map: Record<string, BiText>
): BiText {
  if (!status) return { el: "—", en: "—" };
  return map[status] ?? { el: status, en: status };
}

export type Tone = "neutral" | "success" | "warning" | "error" | "info";

export function statusTone(
  status: string | null | undefined,
  successKeys: string[] = ["active", "open", "succeeded", "healthy"],
  warningKeys: string[] = ["draft", "pending", "running", "queued", "degraded"],
  errorKeys: string[] = ["failed", "down", "invalid"]
): Tone {
  if (!status) return "neutral";
  if (successKeys.includes(status)) return "success";
  if (warningKeys.includes(status)) return "warning";
  if (errorKeys.includes(status)) return "error";
  if (status === "closed") return "neutral";
  return "neutral";
}

export const HORIZON_OPTIONS: { value: string; label: BiText }[] = [
  { value: "6m", label: { el: "6 μήνες", en: "6 months" } },
  { value: "1y", label: { el: "1 έτος", en: "1 year" } },
  { value: "3y", label: { el: "3 έτη", en: "3 years" } },
  { value: "5y", label: { el: "5 έτη", en: "5 years" } },
];
