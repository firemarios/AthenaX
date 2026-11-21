import {
  Activity,
  BarChart3,
  Building2,
  Database,
  FlaskConical,
  Landmark,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Terminal,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Lang } from "@athenax/types";

export type Copy = Record<Lang, string>;

export interface HomeModule {
  href: string;
  icon: LucideIcon;
  title: Copy;
  description: Copy;
  badge?: string;
}

export interface HomeChapter {
  id: string;
  number: string;
  tag: Copy;
  title: Copy;
  body: Copy;
  href: string;
  linkLabel: Copy;
}

export interface HomeStop {
  id: string;
  label: Copy;
}

export interface HomePlan {
  id: string;
  name: Copy;
  price: Copy;
  period: Copy;
  summary: Copy;
  features: Copy[];
  cta: Copy;
  href: string;
  featured?: boolean;
}

export const EXAMPLE_QUESTIONS = [
  "Πόσες πράσινες υποδομές υπάρχουν στο κέντρο της Αθήνας;",
  "Ποια έργα υλοποιούνται στη Γλυφάδα;",
  "Πώς επηρεάζει η κίνηση τον αέρα στο κέντρο;",
  "Τι θα συνέβαινε αν αυξηθούν τα πράσινα κατά 20%;",
];

export const HERO = {
  eyebrow: {
    el: "Open GovTech · Πειραματισμός πολιτικών",
    en: "Open GovTech · Policy experimentation",
  },
  lead: {
    el: "Η Αθήνα που φανταζόμαστε.",
    en: "The city we envision.",
  },
  accent: {
    el: "Η Αθήνα που δημηουργούμε.",
    en: "The future we create.",
  },
  body: {
    el: "Ανοιχτά δεδομένα, προσομοιώσεις και αποδείξεις — σε μία πλατφόρμα.",
    en: "Open data, simulations and evidence — in one platform.",
  },
  tryLabel: {
    el: "Δοκίμασε μια ερώτηση",
    en: "Try a question",
  },
  ctaPrimary: {
    el: "Δημιούργησε πολιτική",
    en: "Create a policy",
  },
  ctaSecondary: {
    el: "Ρώτα την πόλη",
    en: "Ask the city",
  },
  scrollCue: {
    el: "Κύλισε για να μπεις στην πόλη",
    en: "Scroll to enter the city",
  },
  twin: {
    el: "Ψηφιακό δίδυμο · Αθήνα",
    en: "Digital twin · Athens",
  },
  liveModel: {
    el: "Ζωντανό μοντέλο",
    en: "Live model",
  },
  liveValue: {
    el: "Σήματα πόλης → αντίκτυπος πολιτικής",
    en: "City signals → policy impact",
  },
  drag: {
    el: "Σύρε για εξερεύνηση",
    en: "Drag to explore",
  },
  pause: {
    el: "Παύση 3D",
    en: "Pause 3D",
  },
  play: {
    el: "Συνέχισε 3D",
    en: "Resume 3D",
  },
  sync: {
    el: "Συγχρονισμός",
    en: "Syncing",
  },
  offline: {
    el: "Εκτός σύνδεσης",
    en: "Offline",
  },
};

export const WHO = {
  eyebrow: {
    el: "S.01 · Ποιοι είμαστε",
    en: "S.01 · Who we are",
  },
  title: {
    el: "Μια ανοιχτή υποδομή για αποφάσεις με στοιχεία.",
    en: "An open infrastructure for evidence-based decisions.",
  },
  body: {
    el: "Το ATHENAX ενώνει δημόσια δεδομένα, μοντέλα προσομοίωσης και τη φωνή των πολιτών σε ένα ενιαίο περιβάλλον. Σχεδιάζουμε για δήμους που θέλουν να δοκιμάζουν ιδέες πριν δεσμεύσουν πόρους — με διαφάνεια, προέλευση και μετρήσιμο αντίκτυπο.",
    en: "ATHENAX brings public data, simulation models and citizen voices into one environment. We build for cities that want to test ideas before committing resources — with transparency, provenance and measurable impact.",
  },
  pillars: [
    {
      icon: Database,
      title: { el: "Ανοιχτά δεδομένα", en: "Open data" },
      body: {
        el: "Πηγές με προέλευση, ποιότητα και ιστορικό.",
        en: "Sources with provenance, quality and history.",
      },
    },
    {
      icon: ShieldCheck,
      title: { el: "Αποδείξεις πρώτα", en: "Evidence first" },
      body: {
        el: "Κάθε απάντηση συνοδεύεται από πηγές.",
        en: "Every answer comes with citations.",
      },
    },
    {
      icon: Building2,
      title: { el: "Για τις πόλεις", en: "Built for cities" },
      body: {
        el: "Από το ερώτημα στην απόφαση, χωρίς τριβές.",
        en: "From question to decision, without friction.",
      },
    },
  ],
};

export const CHAPTERS: HomeChapter[] = [
  {
    id: "S.02.01",
    number: "01",
    tag: { el: "Επίπεδο δεδομένων", en: "Data layer" },
    title: { el: "Συνδέουμε", en: "Connect" },
    body: {
      el: "Δημόσια δεδομένα και αστικά σήματα σε έναν κατάλογο. Τα σημεία φωτίζονται και οι πηγές ενώνονται.",
      en: "Public data and city signals in one catalogue. Points illuminate and sources link together.",
    },
    href: "/data",
    linkLabel: { el: "Εξερεύνησε τον κατάλογο", en: "Explore the catalogue" },
  },
  {
    id: "S.02.02",
    number: "02",
    tag: { el: "Αποδείξεις", en: "Evidence" },
    title: { el: "Κατανοούμε", en: "Understand" },
    body: {
      el: "Ερωτήσεις σε φυσική γλώσσα με τεκμηριωμένες απαντήσεις. Η κάμερα πλησιάζει μια γειτονιά και οι πηγές γίνονται ετικέτες.",
      en: "Natural-language questions with grounded answers. The camera dives into a district and sources become tags.",
    },
    href: "/ask",
    linkLabel: { el: "Ρώτα την πόλη", en: "Ask the city" },
  },
  {
    id: "S.02.03",
    number: "03",
    tag: { el: "Σενάρια", en: "Scenarios" },
    title: { el: "Προσομοιώνουμε", en: "Simulate" },
    body: {
      el: "Σενάρια πολιτικής με παραμέτρους και αβεβαιότητα. Εναλλακτικές μάζες και επίπεδα επιπτώσεων εμφανίζονται πάνω στην πόλη.",
      en: "Policy scenarios with parameters and uncertainty. Alternate massing and impact layers appear over the city.",
    },
    href: "/simulations",
    linkLabel: { el: "Τρέξε προσομοίωση", en: "Run a simulation" },
  },
  {
    id: "S.02.04",
    number: "04",
    tag: { el: "Αντίκτυπος", en: "Impact" },
    title: { el: "Αποφασίζουμε", en: "Decide" },
    body: {
      el: "Συγκρίνετε αντίκτυπο, κόστος και ρίσκο πριν την απόφαση. Οι δείκτες κλείνουν και η πόλη απομακρύνεται.",
      en: "Compare impact, cost and risk before deciding. Markers resolve and the city pulls away.",
    },
    href: "/impact",
    linkLabel: { el: "Δες τον αντίκτυπο", en: "Review impact" },
  },
];

export const STOPS: HomeStop[] = [
  { id: "S.00", label: { el: "Είσοδος", en: "Enter" } },
  { id: "S.01", label: { el: "Η πόλη", en: "The city" } },
  { id: "S.02.01", label: { el: "Σύνδεση", en: "Connect" } },
  { id: "S.02.02", label: { el: "Κατανόηση", en: "Understand" } },
  { id: "S.02.03", label: { el: "Προσομοίωση", en: "Simulate" } },
  { id: "S.02.04", label: { el: "Απόφαση", en: "Decide" } },
];

export const MODULES: HomeModule[] = [
  {
    href: "/data",
    icon: Database,
    title: { el: "Δεδομένα", en: "Data" },
    description: {
      el: "Αναζήτηση συνόλων, ποιότητα και προέλευση",
      en: "Dataset search, quality and provenance",
    },
  },
  {
    href: "/govtech",
    icon: Landmark,
    title: { el: "GovTech", en: "GovTech" },
    description: {
      el: "Αποφάσεις και δημόσια έργα",
      en: "Decisions and public projects",
    },
  },
  {
    href: "/ask",
    icon: Sparkles,
    title: { el: "Ρώτα την Πόλη", en: "Ask the City" },
    description: {
      el: "Ερωτήσεις με πηγές και αποδείξεις",
      en: "Questions backed by cited sources",
    },
  },
  {
    href: "/policies",
    icon: ScrollText,
    title: { el: "Πολιτικές", en: "Policies" },
    description: {
      el: "Σχεδιασμός πολιτικών και παραλλαγές",
      en: "Policy design and variants",
    },
  },
  {
    href: "/simulations",
    icon: Activity,
    title: { el: "Προσομοιώσεις", en: "Simulations" },
    description: {
      el: "Μοντέλα με διασφάλιση προέλευσης",
      en: "Models with provenance passports",
    },
  },
  {
    href: "/citizen",
    icon: Users,
    title: { el: "Εργαστήρι Πολιτών", en: "Citizen Lab" },
    description: {
      el: "Διαβούλευση και προτάσεις πολιτών",
      en: "Consultations and citizen proposals",
    },
  },
  {
    href: "/impact",
    icon: BarChart3,
    title: { el: "Αντίκτυπος", en: "Impact" },
    description: {
      el: "Αξιολόγηση σε έξι διαστάσεις",
      en: "Assessment across six dimensions",
    },
  },
  {
    href: "/research",
    icon: FlaskConical,
    title: { el: "Έρευνα", en: "Research" },
    description: {
      el: "Πειράματα και εξαγωγή αναφορών",
      en: "Experiments and report exports",
    },
  },
  {
    href: "/developers",
    icon: Terminal,
    title: { el: "Developers", en: "Developers" },
    description: {
      el: "API, παραδείγματα και τεκμηρίωση",
      en: "API, examples and documentation",
    },
  },
];

export const MODULE_SECTION = {
  eyebrow: { el: "S.03 · Τι κάνουμε", en: "S.03 · What we do" },
  title: {
    el: "Από τα δεδομένα στην απόφαση.",
    en: "From data to decision.",
  },
  body: {
    el: "Εννέα συνδεδεμένες ενότητες που καλύπτουν όλο τον κύκλο: εύρεση, κατανόηση, σχεδιασμός, προσομοίωση και αξιολόγηση.",
    en: "Nine connected modules covering the full loop: discovery, understanding, design, simulation and evaluation.",
  },
  open: { el: "Άνοιγμα", en: "Open" },
};

export const METRICS_SECTION = {
  eyebrow: {
    el: "S.04 · Το σύστημα σε αριθμούς",
    en: "S.04 · The system in numbers",
  },
  title: {
    el: "Ζωντανά σήματα από την υποδομή.",
    en: "Live signals from the infrastructure.",
  },
  refresh: { el: "Ανανέωση", en: "Refresh" },
  failure: {
    el: "Δεν ήταν δυνατή η σύνδεση με τον διακομιστή. Δοκιμάστε ξανά.",
    en: "Could not reach the API server. Please retry.",
  },
  cards: {
    sources: {
      label: { el: "Πηγές δεδομένων", en: "Data sources" },
      hint: {
        el: "Ενεργοί συνδέτες & κατάλογοι",
        en: "Active connectors and catalogues",
      },
    },
    datasets: {
      label: { el: "Σύνολα δεδομένων", en: "Datasets" },
      hint: {
        el: "Καταχωρημένα στο αποθετήριο",
        en: "Registered in the catalogue",
      },
    },
    connectors: {
      label: { el: "Συνδέτες", en: "Connectors" },
      hint: {
        el: "Μητρώο σύνδεσης πηγών",
        en: "Source connector registry",
      },
    },
    health: {
      label: { el: "Κατάσταση συστήματος", en: "System status" },
      hint: {
        el: "Βάση δεδομένων, LLM, αποθήκευση",
        en: "Database, LLM, storage",
      },
    },
  },
};

export const PRICING_SECTION = {
  eyebrow: { el: "S.05 · Πλάνα", en: "S.05 · Plans" },
  title: {
    el: "Ένα πλάνο για κάθε κλίμακα.",
    en: "A plan for every scale.",
  },
  body: {
    el: "Ξεκινήστε δωρεάν και κλιμακώστε όταν η πόλη γίνει μέρος της καθημερινής σας εργασίας.",
    en: "Start free and scale when the city becomes part of your daily work.",
  },
  badge: { el: "Δημοφιλές", en: "Most popular" },
  note: {
    el: "Χωρίς δέσμευση · Ακύρωση οποτεδήποτε",
    en: "No commitment · Cancel anytime",
  },
};

export const PRICING: HomePlan[] = [
  {
    id: "free",
    name: { el: "Free", en: "Free" },
    price: { el: "€0", en: "€0" },
    period: { el: "για πάντα", en: "forever" },
    summary: {
      el: "Για μεμονωμένους ερευνητές και πρώτες δοκιμές.",
      en: "For individual researchers and first experiments.",
    },
    features: [
      { el: "3 ερωτήσεις την ημέρα", en: "3 questions per day" },
      { el: "Δημόσια σύνολα δεδομένων", en: "Public datasets" },
      { el: "Βασικές προσομοιώσεις", en: "Core simulations" },
      { el: "Κοινότητα και τεκμηρίωση", en: "Community and docs" },
    ],
    cta: { el: "Ξεκινήστε δωρεάν", en: "Start free" },
    href: "/ask",
  },
  {
    id: "premium",
    name: { el: "Premium", en: "Premium" },
    price: { el: "€49", en: "€49" },
    period: { el: "/ μήνα", en: "/ month" },
    summary: {
      el: "Για ομάδες ανάλυσης και σχεδιασμού πολιτικών.",
      en: "For analysis and policy design teams.",
    },
    features: [
      { el: "Απεριόριστες ερωτήσεις", en: "Unlimited questions" },
      { el: "Όλοι οι σύνδετες και οι πηγές", en: "All connectors and sources" },
      { el: "Παραλλαγές πολιτικών", en: "Policy variants" },
      { el: "Αναφορές αντίκτυπου", en: "Impact reports" },
    ],
    cta: { el: "Αναβάθμιση", en: "Upgrade" },
    href: "/policies",
    featured: true,
  },
  {
    id: "deluxe",
    name: { el: "Deluxe", en: "Deluxe" },
    price: { el: "€149", en: "€149" },
    period: { el: "/ μήνα", en: "/ month" },
    summary: {
      el: "Για δήμους και οργανισμούς με ειδικές ανάγκες.",
      en: "For municipalities and organisations with custom needs.",
    },
    features: [
      { el: "Όλα του Premium", en: "Everything in Premium" },
      { el: "Αποκλειστική χωρητικότητα LLM", en: "Dedicated LLM capacity" },
      { el: "SSO και αρχεία ελέγχου", en: "SSO and audit logs" },
      {
        el: "Προσαρμοσμένοι σύνδετες & SLA",
        en: "Custom connectors and SLA",
      },
    ],
    cta: { el: "Μιλήστε μαζί μας", en: "Talk to us" },
    href: "/developers",
  },
];

export const FINALE = {
  eyebrow: { el: "S.06 · Ξεκινήστε τώρα", en: "S.06 · Start now" },
  title: {
    el: "Ρωτήστε την πόλη. Δοκιμάστε μια πολιτική.",
    en: "Ask the city. Test a policy.",
  },
  body: {
    el: "Ένα ερώτημα αρκεί για να δείτε πώς τα δεδομένα γίνονται απόφαση — με πηγές, σενάρια και μετρήσιμο αντίκτυπο.",
    en: "One question is enough to see how data becomes a decision — with sources, scenarios and measurable impact.",
  },
  primary: { el: "Ρώτα την πόλη", en: "Ask the city" },
  secondary: { el: "Δες προσομοιώσεις", en: "View simulations" },
};

export const FOOTER = {
  license: {
    el: "Ανοιχτού κώδικα λογισμικό · Άδεια Apache-2.0",
    en: "Open-source software · Apache-2.0 license",
  },
  promise: {
    el: "Δεδομένα με προέλευση · Απαντήσεις με αποδείξεις",
    en: "Data with provenance · Answers with evidence",
  },
};

export const HOME_ARIA = {
  journey: {
    el: "Διαδραστική ξενάγηση στην ψηφιακή Αθήνα",
    en: "Interactive tour of digital Athens",
  },
  hero: {
    el: "Εισαγωγή",
    en: "Introduction",
  },
  chapters: {
    el: "Τα τέσσερα βήματα",
    en: "The four steps",
  },
  modules: {
    el: "Ενότητες πλατφόρμας",
    en: "Platform modules",
  },
};
