"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@athenax/ui";
import type { Policy } from "@athenax/types";
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Building2,
  CalendarDays,
  Check,
  ClipboardCheck,
  FileText,
  Landmark,
  Leaf,
  ListChecks,
  Loader2,
  MapPin,
  PenLine,
  SlidersHorizontal,
  Sparkles,
  Tags,
  Target,
  Trees,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { doPost, useApi } from "@/_shared/hooks";
import { areaName, type CityArea } from "@/_shared/geo";
import { FactorEditor, type FactorRow } from "@/_shared/forms";
import { fmtEUR } from "@/_shared/format";
import {
  CATEGORY_OPTIONS,
  HORIZON_OPTIONS,
  type BiText,
} from "@/_shared/terms";
import {
  ErrorPanel,
  PageHeader,
  btnPrimary,
  btnSecondary,
  inputCls,
  labelCls,
  mutedText,
} from "@/_shared/ui";

const STR = {
  title: { el: "Νέο σενάριο", en: "New scenario" },
  desc: {
    el: "Ένας οδηγός βήμα-βήμα. Κάθε βήμα ζητά μία μόνο πληροφορία — μπορείτε να γυρίσετε πίσω όποτε θέλετε.",
    en: "A step-by-step guide. Each step asks for one thing only — you can go back at any time.",
  },
  step: { el: "Βήμα", en: "Step" },
  optional: { el: "προαιρετικό", en: "optional" },
  optionalStep: { el: "Προαιρετικό βήμα", en: "Optional step" },
  required: { el: "Απαιτείται", en: "Required" },
  recommended: { el: "Προτείνεται", en: "Recommended" },
  needed: { el: "Τι χρειάζεται", en: "What's needed" },
  back: { el: "Πίσω", en: "Back" },
  next: { el: "Επόμενο", en: "Next" },
  skip: { el: "Παράλειψη", en: "Skip" },
  cancel: { el: "Ακύρωση", en: "Cancel" },
  submit: { el: "Δημιουργία σεναρίου", en: "Create scenario" },
  creating: { el: "Δημιουργία σεναρίου…", en: "Creating scenario…" },
  creatingHint: {
    el: "Η δημιουργία μπορεί να διαρκέσει έως ~30 δευτερόλεπτα. Μην κλείσετε τη σελίδα.",
    en: "Creation can take up to ~30 seconds. Please keep this page open.",
  },
  creatingSlow: {
    el: "Χρειάζεται λίγο περισσότερο από το αναμενόμενο…",
    en: "Taking a little longer than expected…",
  },
  creatingPhase1: { el: "Αποθηκεύω το σενάριο…", en: "Saving the scenario…" },
  creatingPhase2: {
    el: "Προετοιμάζω παραμέτρους και παράγοντες…",
    en: "Preparing parameters and factors…",
  },
  creatingPhase3: { el: "Ολοκληρώνω το σενάριο…", en: "Finishing the scenario…" },
  edit: { el: "Επεξεργασία", en: "Edit" },
  titleLabel: { el: "Όνομα σεναρίου", en: "Scenario name" },
  titlePh: { el: "π.χ. Ζώνη προτεραιότητας για ποδήλατα", en: "e.g. Priority zone for cycling" },
  titleHint: {
    el: "Παράδειγμα: «Ζώνη προτεραιότητας για ποδήλατα στα Εξάρχεια».",
    en: "Example: “Priority cycling zone in Exarchia”.",
  },
  titleError: {
    el: "Ο τίτλος είναι υποχρεωτικός. Γράψτε τουλάχιστον 3 χαρακτήρες.",
    en: "Title is required. Enter at least 3 characters.",
  },
  areaAll: { el: "Ολόκληρη η πόλη", en: "City-wide" },
  areaAllDesc: {
    el: "Το σενάριο εφαρμόζεται σε όλη την Αθήνα.",
    en: "The scenario applies across Athens.",
  },
  areaOther: { el: "Άλλη περιοχή", en: "Other area" },
  areaOtherDesc: {
    el: "Γράψτε την περιοχή με δικά σας λόγια.",
    en: "Type the area in your own words.",
  },
  areaFree: { el: "Όνομα περιοχής", en: "Area name" },
  areaFreePh: { el: "π.χ. Πλάκα", en: "e.g. Plaka" },
  areasLoading: { el: "Φόρτωση περιοχών…", en: "Loading areas…" },
  areasError: {
    el: "Οι περιοχές δεν είναι διαθέσιμες — χρησιμοποιήστε «Άλλη περιοχή».",
    en: "Areas are unavailable — use “Other area”.",
  },
  changesLabel: { el: "Τι αλλάζει;", en: "What changes?" },
  changesPh: {
    el: "π.χ. 120 νέα διαμερίσματα στον Κεραμεικό, μείωση ΕΝΦΙΑ 5%, νέοι χώροι πρασίνου…",
    en: "e.g. 120 new apartments in Kerameikos, 5% property-tax relief, new green spaces…",
  },
  changesHint: {
    el: "Γράψτε με απλά λόγια. Το AI διαβάζει αυτό το κείμενο για να επιλέξει μοντέλο και παραμέτρους.",
    en: "Write in plain language. The AI reads this to choose the model and parameters.",
  },
  budgetLabel: { el: "Διαθέσιμος προϋπολογισμός (€)", en: "Available budget (EUR)" },
  budgetHint: {
    el: "Προαιρετικό. Χρησιμοποιείται για να ελέγξουμε αν το εκτιμώμενο κόστος χωράει στον προϋπολογισμό.",
    en: "Optional. Used to check whether the estimated cost fits the budget.",
  },
  factorsLabel: { el: "Παράγοντες μοντέλου", en: "Model factors" },
  factorsSuggested: { el: "Προτεινόμενοι παράγοντες", en: "Suggested factors" },
  factorsSuggestedDesc: {
    el: "Έτοιμοι παράγοντες για την κατηγορία που επιλέξατε.",
    en: "Ready-made factors for the category you picked.",
  },
  factorsCustom: { el: "Προσαρμογή", en: "Customize" },
  factorsCustomDesc: {
    el: "Ορίστε μόνοι σας ονόματα, εύρη και μονάδες.",
    en: "Set names, ranges and units yourself.",
  },
  factorsWillUse: { el: "Θα χρησιμοποιηθούν", en: "Will use" },
  factorsReset: { el: "Επαναφορά προτεινόμενων", en: "Reset to suggested" },
  factorError: {
    el: "Συμπληρώστε όνομα και έγκυρες αριθμητικές τιμές για κάθε παράγοντα (ελάχιστο ≤ αρχική ≤ μέγιστο).",
    en: "Fill a name and valid numeric values for every factor (min ≤ base ≤ max).",
  },
  factorName: { el: "Παράγοντας", en: "Factor" },
  factorBase: { el: "Αρχική τιμή", en: "Base value" },
  factorMin: { el: "Ελάχιστο", en: "Min" },
  factorMax: { el: "Μέγιστο", en: "Max" },
  factorUnit: { el: "Μονάδα", en: "Unit" },
  addFactor: { el: "Προσθήκη παράγοντα", en: "Add factor" },
  remove: { el: "Αφαίρεση", en: "Remove" },
  assumptionsLabel: { el: "Υποθέσεις", en: "Assumptions" },
  assumptionsHint: {
    el: "Μία υπόθεση ανά γραμμή. Προαιρετικό — το AI συμπληρώνει ό,τι λείπει.",
    en: "One assumption per line. Optional — the AI fills in the gaps.",
  },
  assumptionsPh: {
    el: "Η ζήτηση παραμένει σταθερή\nΔεν αλλάζει το ισχύον νομικό πλαίσιο",
    en: "Demand remains constant\nThe current legal framework does not change",
  },
  kpisLabel: { el: "Δείκτες επιτυχίας", en: "Success indicators" },
  kpisHint: {
    el: "Ένας δείκτης ανά γραμμή. Προαιρετικό.",
    en: "One indicator per line. Optional.",
  },
  kpisPh: {
    el: "Ποσοστό κάλυψης 300 μ\nΜέσος χρόνος μετακίνησης",
    en: "Coverage within 300 m\nAverage travel time",
  },
  reviewName: { el: "Όνομα", en: "Name" },
  reviewCategory: { el: "Κατηγορία", en: "Category" },
  reviewArea: { el: "Περιοχή", en: "Area" },
  reviewChanges: { el: "Αλλαγές", en: "Changes" },
  reviewHorizon: { el: "Ορίζοντας", en: "Horizon" },
  reviewBudget: { el: "Προϋπολογισμός", en: "Budget" },
  reviewFactors: { el: "Παράγοντες", en: "Factors" },
  reviewAssumptions: { el: "Υποθέσεις", en: "Assumptions" },
  reviewKpis: { el: "Δείκτες", en: "KPIs" },
  reviewReady: {
    el: "Όλα έτοιμα. Ελέγξτε τα στοιχεία και δημιουργήστε το σενάριο.",
    en: "All set. Review the details and create the scenario.",
  },
  lines: { el: "γραμμές", en: "lines" },
  empty: { el: "—", en: "—" },
  createError: {
    el: "Αποτυχία δημιουργίας σεναρίου.",
    en: "Failed to create the scenario.",
  },
};

const STEPS = [
  { id: "title", icon: FileText },
  { id: "category", icon: Tags },
  { id: "area", icon: MapPin },
  { id: "changes", icon: Sparkles },
  { id: "horizon", icon: CalendarDays },
  { id: "budget", icon: Wallet },
  { id: "factors", icon: SlidersHorizontal },
  { id: "assumptions", icon: ListChecks },
  { id: "kpis", icon: Target },
  { id: "review", icon: ClipboardCheck },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const STEP_LABELS: Record<StepId, BiText> = {
  title: { el: "Όνομα", en: "Name" },
  category: { el: "Τύπος", en: "Type" },
  area: { el: "Περιοχή", en: "Area" },
  changes: { el: "Αλλαγές", en: "Changes" },
  horizon: { el: "Ορίζοντας", en: "Horizon" },
  budget: { el: "Προϋπολογισμός", en: "Budget" },
  factors: { el: "Παράγοντες", en: "Factors" },
  assumptions: { el: "Υποθέσεις", en: "Assumptions" },
  kpis: { el: "Δείκτες", en: "KPIs" },
  review: { el: "Έλεγχος", en: "Review" },
};

const STEP_INSTRUCTIONS: Record<StepId, BiText> = {
  title: {
    el: "Δώστε ένα σύντομο, συγκεκριμένο όνομα. Θα το βλέπετε σε όλη τη διαδικασία.",
    en: "Give it a short, specific name. You will see it throughout the flow.",
  },
  category: {
    el: "Επιλέξτε την κατηγορία που ταιριάζει καλύτερα. Καθορίζει το μοντέλο και τους προτεινόμενους παράγοντες.",
    en: "Pick the closest category. It drives the model and the suggested factors.",
  },
  area: {
    el: "Πού εφαρμόζεται το σενάριο; Επιλέξτε περιοχή ή ολόκληρη την πόλη.",
    en: "Where does the scenario apply? Pick an area or the whole city.",
  },
  changes: {
    el: "Περιγράψτε με απλά λόγια τι αλλάζει. Το AI θα το μετατρέψει σε παραμέτρους.",
    en: "Describe in plain language what changes. The AI will turn it into parameters.",
  },
  horizon: {
    el: "Σε πόσο χρόνο θέλετε να φανούν τα αποτελέσματα;",
    en: "How soon should the results appear?",
  },
  budget: {
    el: "Προαιρετικό. Βοηθά να ελέγξουμε αν το κόστος χωράει στα διαθέσιμα χρήματα.",
    en: "Optional. Helps check whether the cost fits the available budget.",
  },
  factors: {
    el: "Πώς θέλετε να ορίσετε τους παράγοντες του μοντέλου;",
    en: "How do you want to set the model factors?",
  },
  assumptions: {
    el: "Προαιρετικό. Γράψτε μία υπόθεση ανά γραμμή.",
    en: "Optional. Write one assumption per line.",
  },
  kpis: {
    el: "Προαιρετικό. Γράψτε έναν δείκτη επιτυχίας ανά γραμμή.",
    en: "Optional. Write one success indicator per line.",
  },
  review: {
    el: "Ελέγξτε τα στοιχεία και δημιουργήστε το σενάριο.",
    en: "Review the details and create the scenario.",
  },
};

const OPTIONAL_STEPS: ReadonlySet<StepId> = new Set(["budget", "assumptions", "kpis"]);

type RequirementStatus = "required" | "optional" | "recommended";

const STEP_REQUIREMENTS: Record<StepId, BiText> = {
  title: {
    el: "Όνομα σεναρίου με τουλάχιστον 3 χαρακτήρες.",
    en: "A scenario name with at least 3 characters.",
  },
  category: {
    el: "Μία κατηγορία σεναρίου.",
    en: "One scenario category.",
  },
  area: {
    el: "Περιοχή ή «Ολόκληρη η πόλη».",
    en: "An area, or “City-wide”.",
  },
  changes: {
    el: "Σύντομη περιγραφή των αλλαγών.",
    en: "A short description of the changes.",
  },
  horizon: {
    el: "Χρονικός ορίζοντας (6 μήνες – 5 χρόνια).",
    en: "A time horizon (6 months – 5 years).",
  },
  budget: {
    el: "Ποσό σε ευρώ.",
    en: "An amount in EUR.",
  },
  factors: {
    el: "Τουλάχιστον ένας παράγοντας με έγκυρο εύρος.",
    en: "At least one factor with a valid range.",
  },
  assumptions: {
    el: "Μία υπόθεση ανά γραμμή.",
    en: "One assumption per line.",
  },
  kpis: {
    el: "Ένας δείκτης ανά γραμμή.",
    en: "One indicator per line.",
  },
  review: {
    el: "Έλεγχος όλων των πεδίων πριν τη δημιουργία.",
    en: "Check every field before creating the scenario.",
  },
};

const STEP_REQUIREMENT_STATUS: Record<StepId, RequirementStatus> = {
  title: "required",
  category: "required",
  area: "optional",
  changes: "recommended",
  horizon: "required",
  budget: "optional",
  factors: "required",
  assumptions: "optional",
  kpis: "optional",
  review: "required",
};

const REQUIREMENT_BADGE: Record<RequirementStatus, string> = {
  required: "bg-primary/10 text-primary",
  optional: "bg-zinc-200/70 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  recommended: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
};

const CATEGORY_META: Record<string, { icon: LucideIcon; desc: BiText }> = {
  mobility: {
    icon: Bike,
    desc: {
      el: "Δρόμοι, πεζοδρόμια, ποδήλατα, στάθμευση.",
      en: "Roads, pavements, cycling, parking.",
    },
  },
  green: {
    icon: Trees,
    desc: {
      el: "Πάρκα, δέντρα, αστικό πράσινο.",
      en: "Parks, trees, urban green.",
    },
  },
  housing: {
    icon: Building2,
    desc: {
      el: "Κατοικίες, νέες οικοδομές, προσιτή στέγη.",
      en: "Housing, new buildings, affordability.",
    },
  },
  environment: {
    icon: Leaf,
    desc: {
      el: "Κλίμα, ενέργεια, ρύπανση, θόρυβος.",
      en: "Climate, energy, pollution, noise.",
    },
  },
  services: {
    icon: Landmark,
    desc: {
      el: "Ψηφιακές και δημοτικές υπηρεσίες.",
      en: "Digital and municipal services.",
    },
  },
};

const HORIZON_DESC: Record<string, BiText> = {
  "6m": { el: "Γρήγορο πιλοτικό", en: "Fast pilot" },
  "1y": { el: "Ετήσιος κύκλος", en: "Annual cycle" },
  "3y": { el: "Μεσοπρόθεσμος σχεδιασμός", en: "Medium-term plan" },
  "5y": { el: "Στρατηγικός ορίζοντας", en: "Strategic horizon" },
};

const BASE_FACTORS: FactorRow[] = [
  { name: "new_buildings", baseline: "25", min: "0", max: "500", unit: "buildings" },
  { name: "tax_change_pct", baseline: "0", min: "-50", max: "100", unit: "%" },
  { name: "population", baseline: "10000", min: "100", max: "200000", unit: "people" },
];

const SUGGESTED_FACTORS: Record<string, FactorRow[]> = {
  mobility: BASE_FACTORS,
  green: BASE_FACTORS,
  environment: BASE_FACTORS,
  housing: BASE_FACTORS,
  services: BASE_FACTORS,
};

type FactorPayload = {
  name: string;
  baseline: number;
  min: number;
  max: number;
  unit: string | null;
};

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function ChoiceCard({
  name,
  value,
  checked,
  onChange,
  icon: Icon,
  title,
  description,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <label
      className={`group relative flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all duration-300 focus-within:ring-2 focus-within:ring-ring ${
        checked
          ? "border-primary/60 bg-primary/5 shadow-sm"
          : "border-zinc-200 bg-white hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <span
        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 ${
          checked
            ? "bg-primary text-primary-foreground"
            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
        }`}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {description}
          </span>
        ) : null}
      </span>
      <span
        className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
          checked
            ? "scale-100 border-primary bg-primary text-primary-foreground opacity-100"
            : "scale-75 border-zinc-300 opacity-0 dark:border-zinc-700"
        }`}
      >
        <Check className="h-3 w-3" aria-hidden="true" />
      </span>
    </label>
  );
}

export default function NewPolicyPage() {
  const { t, lang } = useI18n();
  const router = useRouter();

  const areas = useApi<CityArea[]>("/v1/city/areas");

  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mountedRef = useRef(false);
  const submittedRef = useRef(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("mobility");
  const [areaChoice, setAreaChoice] = useState("");
  const [areaFree, setAreaFree] = useState("");
  const [changes, setChanges] = useState("");
  const [horizon, setHorizon] = useState("1y");
  const [budget, setBudget] = useState("");
  const [factorMode, setFactorMode] = useState<"suggested" | "custom">("suggested");
  const [factors, setFactors] = useState<FactorRow[]>(() => SUGGESTED_FACTORS.mobility);
  const [assumptionsText, setAssumptionsText] = useState("");
  const [kpisText, setKpisText] = useState("");

  const [titleError, setTitleError] = useState<string | null>(null);
  const [factorError, setFactorError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const resetWizard = useCallback(() => {
    setStepIndex(0);
    setDirection("forward");
    setTitle("");
    setCategory("mobility");
    setAreaChoice("");
    setAreaFree("");
    setChanges("");
    setHorizon("1y");
    setBudget("");
    setFactorMode("suggested");
    setFactors(SUGGESTED_FACTORS.mobility);
    setAssumptionsText("");
    setKpisText("");
    setTitleError(null);
    setFactorError(null);
    setError(null);
    setSaving(false);
    setElapsed(0);
  }, []);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && submittedRef.current) resetWizard();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [resetWizard]);

  useEffect(() => {
    if (!saving) return;
    const timer = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [saving]);

  const areaList = areas.data ?? [];
  const freeSelected = areaChoice === "__free__";
  const step = STEPS[stepIndex];
  const StepIcon = step.icon;
  const isLast = stepIndex === STEPS.length - 1;
  const isOptional = OPTIONAL_STEPS.has(step.id);
  const requirementStatus = STEP_REQUIREMENT_STATUS[step.id];
  const requirementLabel =
    requirementStatus === "required"
      ? STR.required
      : requirementStatus === "recommended"
        ? STR.recommended
        : STR.optional;
  const progress = stepIndex / (STEPS.length - 1);
  const creatingPhase =
    elapsed < 10 ? STR.creatingPhase1 : elapsed < 20 ? STR.creatingPhase2 : STR.creatingPhase3;

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [stepIndex]);

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, next));
    if (clamped === stepIndex) return;
    setDirection(clamped > stepIndex ? "forward" : "backward");
    setStepIndex(clamped);
  };

  const resolveArea = (): string | null => {
    if (freeSelected) {
      const value = areaFree.trim();
      return value || null;
    }
    if (!areaChoice) return null;
    const found = areaList.find((a) => a.id === areaChoice);
    return found ? areaName(found, lang) : areaChoice;
  };

  const buildFactors = (): FactorPayload[] =>
    factors.map((factor) => ({
      name: factor.name.trim(),
      baseline: Number(factor.baseline),
      min: Number(factor.min),
      max: Number(factor.max),
      unit: factor.unit.trim() || null,
    }));

  const factorsAreValid = (payload: FactorPayload[]): boolean =>
    payload.every(
      (factor) =>
        Boolean(factor.name) &&
        Number.isFinite(factor.baseline) &&
        Number.isFinite(factor.min) &&
        Number.isFinite(factor.max) &&
        factor.min <= factor.baseline &&
        factor.baseline <= factor.max
    );

  const chooseCategory = (value: string) => {
    setCategory(value);
    if (factorMode === "suggested") {
      setFactors(SUGGESTED_FACTORS[value] ?? BASE_FACTORS);
    }
  };

  const chooseFactorMode = (mode: "suggested" | "custom") => {
    setFactorMode(mode);
    setFactorError(null);
    if (mode === "suggested") {
      setFactors(SUGGESTED_FACTORS[category] ?? BASE_FACTORS);
    }
  };

  const validateStep = (): boolean => {
    if (step.id === "title") {
      if (title.trim().length < 3) {
        setTitleError(t(STR.titleError));
        return false;
      }
      setTitleError(null);
    }
    if (step.id === "factors") {
      const payload = buildFactors();
      if (!factorsAreValid(payload)) {
        setFactorError(t(STR.factorError));
        return false;
      }
      setFactorError(null);
    }
    return true;
  };

  const submit = async () => {
    const trimmed = title.trim();
    if (trimmed.length < 3) {
      setTitleError(t(STR.titleError));
      goTo(0);
      return;
    }

    const factorPayload = buildFactors();
    if (!factorsAreValid(factorPayload)) {
      setFactorError(t(STR.factorError));
      goTo(6);
      return;
    }

    setTitleError(null);
    setFactorError(null);
    setError(null);

    const payload: Record<string, unknown> = {
      title: trimmed,
      category,
      horizon,
      parameters: Object.fromEntries(
        factorPayload.map((factor) => [factor.name, factor.baseline])
      ),
      factors: factorPayload,
      assumptions: splitLines(assumptionsText),
      kpis: splitLines(kpisText),
    };
    const changesText = changes.trim();
    if (changesText) payload.changes = changesText;
    const area = resolveArea();
    if (area) payload.area = area;
    const budgetNum = Number(budget);
    if (budget.trim() && Number.isFinite(budgetNum)) payload.budget_eur = budgetNum;

    setSaving(true);
    setElapsed(0);
    const res = await doPost<Policy>("/v1/policies", payload);
    setSaving(false);
    if (res.error || !res.data) {
      setError(res.error ?? t(STR.createError));
      return;
    }
    submittedRef.current = true;
    resetWizard();
    router.push(`/policies/${res.data.id}`);
  };

  const next = () => {
    if (!validateStep()) return;
    if (isLast) {
      void submit();
      return;
    }
    goTo(stepIndex + 1);
  };

  const handleFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    next();
  };

  const renderStep = () => {
    if (step.id === "title") {
      return (
        <div className="space-y-3">
          <label htmlFor="wizard-title" className={labelCls}>
            {t(STR.titleLabel)}
          </label>
          <input
            id="wizard-title"
            className={inputCls}
            value={title}
            placeholder={t(STR.titlePh)}
            autoComplete="off"
            onChange={(event) => {
              setTitle(event.target.value);
              if (titleError) setTitleError(null);
            }}
            aria-invalid={titleError ? true : undefined}
            aria-describedby={titleError ? "wizard-title-error" : "wizard-title-hint"}
          />
          <p id="wizard-title-hint" className={mutedText}>
            {t(STR.titleHint)}
          </p>
          {titleError ? (
            <p
              id="wizard-title-error"
              role="alert"
              className="text-sm font-medium text-red-600 dark:text-red-400"
            >
              {titleError}
            </p>
          ) : null}
        </div>
      );
    }

    if (step.id === "category") {
      return (
        <fieldset>
          <legend className="sr-only">{t(STEP_LABELS.category)}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {CATEGORY_OPTIONS.map((option) => {
              const meta = CATEGORY_META[option.value];
              return (
                <ChoiceCard
                  key={option.value}
                  name="wizard-category"
                  value={option.value}
                  checked={category === option.value}
                  onChange={chooseCategory}
                  icon={meta?.icon ?? Tags}
                  title={t(option.label)}
                  description={meta ? t(meta.desc) : undefined}
                />
              );
            })}
          </div>
        </fieldset>
      );
    }

    if (step.id === "area") {
      return (
        <div className="space-y-4">
          <fieldset>
            <legend className="sr-only">{t(STEP_LABELS.area)}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceCard
                name="wizard-area"
                value=""
                checked={areaChoice === ""}
                onChange={setAreaChoice}
                icon={Landmark}
                title={t(STR.areaAll)}
                description={t(STR.areaAllDesc)}
              />
              {areaList.map((area) => (
                <ChoiceCard
                  key={area.id}
                  name="wizard-area"
                  value={area.id}
                  checked={areaChoice === area.id}
                  onChange={setAreaChoice}
                  icon={MapPin}
                  title={areaName(area, lang)}
                  description={
                    area.radius_m
                      ? t({
                          el: `Ακτίνα ${area.radius_m} μ`,
                          en: `${area.radius_m} m radius`,
                        })
                      : undefined
                  }
                />
              ))}
              <ChoiceCard
                name="wizard-area"
                value="__free__"
                checked={freeSelected}
                onChange={setAreaChoice}
                icon={PenLine}
                title={t(STR.areaOther)}
                description={t(STR.areaOtherDesc)}
              />
            </div>
          </fieldset>

          {areas.loading ? <p className={mutedText}>{t(STR.areasLoading)}</p> : null}
          {areas.error ? <p className={mutedText}>{t(STR.areasError)}</p> : null}

          {freeSelected ? (
            <div className="pl-reveal space-y-2">
              <label htmlFor="wizard-area-free" className={labelCls}>
                {t(STR.areaFree)}
              </label>
              <input
                id="wizard-area-free"
                className={inputCls}
                value={areaFree}
                placeholder={t(STR.areaFreePh)}
                onChange={(event) => setAreaFree(event.target.value)}
              />
            </div>
          ) : null}
        </div>
      );
    }

    if (step.id === "changes") {
      return (
        <div className="space-y-3">
          <label htmlFor="wizard-changes" className={labelCls}>
            {t(STR.changesLabel)}
          </label>
          <textarea
            id="wizard-changes"
            rows={6}
            className={inputCls}
            value={changes}
            placeholder={t(STR.changesPh)}
            onChange={(event) => setChanges(event.target.value)}
            aria-describedby="wizard-changes-hint"
          />
          <p id="wizard-changes-hint" className={mutedText}>
            {t(STR.changesHint)}
          </p>
        </div>
      );
    }

    if (step.id === "horizon") {
      return (
        <fieldset>
          <legend className="sr-only">{t(STEP_LABELS.horizon)}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {HORIZON_OPTIONS.map((option) => (
              <ChoiceCard
                key={option.value}
                name="wizard-horizon"
                value={option.value}
                checked={horizon === option.value}
                onChange={setHorizon}
                icon={CalendarDays}
                title={t(option.label)}
                description={t(
                  HORIZON_DESC[option.value] ?? { el: "", en: "" }
                )}
              />
            ))}
          </div>
        </fieldset>
      );
    }

    if (step.id === "budget") {
      return (
        <div className="space-y-3">
          <label htmlFor="wizard-budget" className={labelCls}>
            {t(STR.budgetLabel)}
          </label>
          <div className="relative max-w-sm">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400"
            >
              €
            </span>
            <input
              id="wizard-budget"
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              className={`${inputCls} pl-8`}
              value={budget}
              placeholder="100000"
              onChange={(event) => setBudget(event.target.value)}
              aria-describedby="wizard-budget-hint"
            />
          </div>
          <p id="wizard-budget-hint" className={mutedText}>
            {t(STR.budgetHint)}
          </p>
        </div>
      );
    }

    if (step.id === "factors") {
      return (
        <div className="space-y-4">
          <fieldset>
            <legend className="sr-only">{t(STEP_LABELS.factors)}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceCard
                name="wizard-factor-mode"
                value="suggested"
                checked={factorMode === "suggested"}
                onChange={() => chooseFactorMode("suggested")}
                icon={Sparkles}
                title={t(STR.factorsSuggested)}
                description={t(STR.factorsSuggestedDesc)}
              />
              <ChoiceCard
                name="wizard-factor-mode"
                value="custom"
                checked={factorMode === "custom"}
                onChange={() => chooseFactorMode("custom")}
                icon={SlidersHorizontal}
                title={t(STR.factorsCustom)}
                description={t(STR.factorsCustomDesc)}
              />
            </div>
          </fieldset>

          {factorMode === "custom" ? (
            <div className="pl-reveal space-y-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {t(STR.factorsLabel)}
                </p>
                <button
                  type="button"
                  className={`${btnSecondary} px-3 py-1.5 text-xs`}
                  onClick={() => setFactors(SUGGESTED_FACTORS[category] ?? BASE_FACTORS)}
                >
                  {t(STR.factorsReset)}
                </button>
              </div>
              <FactorEditor
                idPrefix="policy-factor"
                rows={factors}
                onChange={setFactors}
                nameLabel={t(STR.factorName)}
                baseLabel={t(STR.factorBase)}
                minLabel={t(STR.factorMin)}
                maxLabel={t(STR.factorMax)}
                unitLabel={t(STR.factorUnit)}
                addLabel={t(STR.addFactor)}
                removeLabel={t(STR.remove)}
                namePlaceholder="park_count"
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                {t(STR.factorsWillUse)}
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {factors.map((factor) => (
                  <li
                    key={factor.name}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    {factor.name}
                    <span className="text-zinc-400">
                      {" · "}
                      {factor.baseline}
                      {factor.unit ? ` ${factor.unit}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {factorError ? (
            <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
              {factorError}
            </p>
          ) : null}
        </div>
      );
    }

    if (step.id === "assumptions") {
      return (
        <div className="space-y-3">
          <label htmlFor="wizard-assumptions" className={labelCls}>
            {t(STR.assumptionsLabel)}
          </label>
          <textarea
            id="wizard-assumptions"
            rows={6}
            className={inputCls}
            value={assumptionsText}
            placeholder={t(STR.assumptionsPh)}
            onChange={(event) => setAssumptionsText(event.target.value)}
            aria-describedby="wizard-assumptions-hint"
          />
          <p id="wizard-assumptions-hint" className={mutedText}>
            {t(STR.assumptionsHint)}
          </p>
        </div>
      );
    }

    if (step.id === "kpis") {
      return (
        <div className="space-y-3">
          <label htmlFor="wizard-kpis" className={labelCls}>
            {t(STR.kpisLabel)}
          </label>
          <textarea
            id="wizard-kpis"
            rows={6}
            className={inputCls}
            value={kpisText}
            placeholder={t(STR.kpisPh)}
            onChange={(event) => setKpisText(event.target.value)}
            aria-describedby="wizard-kpis-hint"
          />
          <p id="wizard-kpis-hint" className={mutedText}>
            {t(STR.kpisHint)}
          </p>
        </div>
      );
    }

    const categoryLabel =
      CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? {
        el: category,
        en: category,
      };
    const horizonLabel =
      HORIZON_OPTIONS.find((option) => option.value === horizon)?.label ?? {
        el: horizon,
        en: horizon,
      };
    const budgetValue =
      budget.trim() && Number.isFinite(Number(budget))
        ? fmtEUR(Number(budget), lang)
        : t(STR.empty);
    const assumptionCount = splitLines(assumptionsText).length;
    const kpiCount = splitLines(kpisText).length;

    const reviewItems: {
      label: BiText;
      value: string;
      step: number;
      multiline?: boolean;
    }[] = [
      { label: STR.reviewName, value: title.trim() || t(STR.empty), step: 0 },
      { label: STR.reviewCategory, value: t(categoryLabel), step: 1 },
      { label: STR.reviewArea, value: resolveArea() ?? t(STR.areaAll), step: 2 },
      {
        label: STR.reviewChanges,
        value: changes.trim() || t(STR.empty),
        step: 3,
        multiline: true,
      },
      { label: STR.reviewHorizon, value: t(horizonLabel), step: 4 },
      { label: STR.reviewBudget, value: budgetValue, step: 5 },
      {
        label: STR.reviewFactors,
        value: factors.map((factor) => factor.name).join(", ") || t(STR.empty),
        step: 6,
      },
      {
        label: STR.reviewAssumptions,
        value: assumptionCount
          ? `${assumptionCount} ${t(STR.lines)}`
          : t(STR.empty),
        step: 7,
      },
      {
        label: STR.reviewKpis,
        value: kpiCount ? `${kpiCount} ${t(STR.lines)}` : t(STR.empty),
        step: 8,
      },
    ];

    return (
      <div className="space-y-4">
        <p className={mutedText}>{t(STR.reviewReady)}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {reviewItems.map((item) => (
            <div
              key={item.label.en}
              className="group rounded-2xl border border-zinc-200/80 bg-white p-4 transition-colors duration-200 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                  {t(item.label)}
                </p>
                <button
                  type="button"
                  onClick={() => goTo(item.step)}
                  aria-label={`${t(STR.edit)}: ${t(item.label)}`}
                  className="rounded-full p-1 text-zinc-400 opacity-0 transition-all duration-200 hover:bg-zinc-100 hover:text-zinc-700 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              <p
                className={`mt-1 text-sm text-zinc-800 dark:text-zinc-200 ${
                  item.multiline ? "line-clamp-3 whitespace-pre-line" : ""
                }`}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        title={t(STR.title)}
        description={t(STR.desc)}
        breadcrumbs={[
          { label: t({ el: "Σενάρια", en: "Scenarios" }), href: "/policies" },
          { label: t(STR.title) },
        ]}
      />

      {error ? (
        <div className="mb-6">
          <ErrorPanel message={error} onRetry={() => setError(null)} />
        </div>
      ) : null}

      <form
        onSubmit={handleFormSubmit}
        noValidate
        aria-busy={saving || undefined}
        aria-label={t(STR.title)}
        className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <p className="sr-only" role="status" aria-live="polite">
          {t(STR.step)} {stepIndex + 1} / {STEPS.length}: {t(STEP_LABELS[step.id])}
        </p>

        <div className="grid lg:grid-cols-[15.5rem_1fr]">
          <aside className="hidden border-r border-zinc-200/80 bg-zinc-50/60 p-6 dark:border-zinc-800 dark:bg-zinc-950/40 lg:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              {t(STR.title)}
            </p>
            <div className="relative mt-5">
              <span
                aria-hidden="true"
                className="absolute left-[23.5px] top-2 h-[calc(100%-1rem)] w-px bg-zinc-200 dark:bg-zinc-800"
              />
              <span
                aria-hidden="true"
                className="absolute left-[23.5px] top-2 h-[calc(100%-1rem)] w-px origin-top bg-primary transition-transform duration-500 ease-out"
                style={{ transform: `scaleY(${progress})` }}
              />
              <ol className="relative space-y-1">
                {STEPS.map((item, index) => {
                  const done = index < stepIndex;
                  const current = index === stepIndex;
                  const Icon = item.icon;
                  const reachable = index <= stepIndex;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (reachable) goTo(index);
                        }}
                        disabled={!reachable}
                        aria-current={current ? "step" : undefined}
                        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors duration-200 ${
                          current
                            ? "bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
                            : reachable
                              ? "hover:bg-white/70 dark:hover:bg-zinc-900/60"
                              : "cursor-default opacity-55"
                        }`}
                      >
                        <span
                          className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-all duration-300 ${
                            current
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : done
                                ? "border-primary/30 bg-primary/10 text-primary"
                                : "border-zinc-200 bg-white text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-600"
                          }`}
                        >
                          {done ? (
                            <Check className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span
                            className={`block truncate text-sm ${
                              current
                                ? "font-semibold text-zinc-900 dark:text-zinc-100"
                                : "font-medium text-zinc-600 dark:text-zinc-400"
                            }`}
                          >
                            {t(STEP_LABELS[item.id])}
                          </span>
                          {OPTIONAL_STEPS.has(item.id) ? (
                            <span className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
                              {t(STR.optional)}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          </aside>

          <div className="p-5 sm:p-8">
            <div className="mb-6 lg:hidden">
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <span>
                  {t(STR.step)} {stepIndex + 1} / {STEPS.length}
                </span>
                <span className="text-primary">{t(STEP_LABELS[step.id])}</span>
              </div>
              <progress
                className="pl-wizard-progress"
                value={stepIndex + 1}
                max={STEPS.length}
                aria-label={`${t(STR.step)} ${stepIndex + 1} / ${STEPS.length}`}
              />
            </div>

            <div className="mb-6 hidden items-center justify-between lg:flex">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                {t(STR.step)} {stepIndex + 1} / {STEPS.length}
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {isOptional ? t(STR.optionalStep) : ""}
              </span>
            </div>

            <div
              key={step.id}
              className={
                direction === "forward" ? "pl-wizard-forward" : "pl-wizard-backward"
              }
            >
              <div className="mb-6 flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <StepIcon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2
                    id="wizard-heading"
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-xl font-semibold tracking-tight text-zinc-900 outline-none dark:text-zinc-100 sm:text-2xl"
                  >
                    {t(STEP_LABELS[step.id])}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {t(STEP_INSTRUCTIONS[step.id])}
                  </p>
                </div>
              </div>

              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-zinc-200/70 bg-zinc-50/70 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
                <span
                  className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${REQUIREMENT_BADGE[requirementStatus]}`}
                >
                  {t(requirementLabel)}
                </span>
                <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {t(STR.needed)}:
                  </span>{" "}
                  {t(STEP_REQUIREMENTS[step.id])}
                </p>
              </div>

              <div className="min-h-[220px]">
                {saving ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="flex h-full flex-col gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-6"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {t(STR.creating)}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                          {t(creatingPhase)}
                        </p>
                      </div>
                      <span className="ml-auto shrink-0 font-mono text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
                        {elapsed}s
                      </span>
                    </div>
                    <progress
                      className="pl-wizard-progress"
                      value={Math.min(30, elapsed)}
                      max={30}
                      aria-label={t(STR.creating)}
                    />
                    <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {elapsed >= 35 ? t(STR.creatingSlow) : t(STR.creatingHint)}
                    </p>
                  </div>
                ) : (
                  renderStep()
                )}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200/80 pt-5 dark:border-zinc-800">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => goTo(stepIndex - 1)}
                  disabled={stepIndex === 0 || saving}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  {t(STR.back)}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isOptional && !isLast ? (
                  <button
                    type="button"
                    onClick={() => goTo(stepIndex + 1)}
                    disabled={saving}
                    className={btnSecondary}
                  >
                    {t(STR.skip)}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
                <Link
                  href="/policies"
                  className={`${btnSecondary} ${saving ? "pointer-events-none opacity-50" : ""}`}
                  aria-disabled={saving || undefined}
                  tabIndex={saving ? -1 : undefined}
                >
                  {t(STR.cancel)}
                </Link>
                <button type="submit" className={btnPrimary} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      {t(STR.creating)}
                    </>
                  ) : isLast ? (
                    t(STR.submit)
                  ) : (
                    <>
                      {t(STR.next)}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
