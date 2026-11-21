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
    el: "Open GovTech · Πειραματισμός σεναρίων",
    en: "Open GovTech · Scenario experimentation",
  },
  lead: {
    el: "Η Αθήνα που φανταζόμαστε.",
    en: "The city we envision.",
  },
  accent: {
    el: "Η Αθήνα που δημιουργούμε.",
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
    el: "Δημιούργησε σενάριο",
    en: "Create a scenario",
  },
  ctaSecondary: {
    el: "Ρώτησε την πόλη",
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
    el: "Σήματα πόλης → αντίκτυπος σεναρίου",
    en: "City signals → scenario impact",
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
    el: "S.01 · Το όραμα",
    en: "S.01 · Our vision",
  },
  title: {
    el: "Μια πλατφόρμα που προβλέπει τις συνέπειες των αποφάσεων του δήμου και προτείνει βελτιώσεις.",
    en: "A platform that simulates the impact of municipal decisions and suggests ways to improve them.",
  },
  body: {
    el: "Το ATHENAX ενώνει δημόσια δεδομένα, μοντέλα προσομοίωσης και τη φωνή των πολιτών σε ένα ενιαίο περιβάλλον. Σχεδιάζουμε για δήμους που θέλουν να δοκιμάζουν ιδέες πριν δεσμεύσουν πόρους — με διαφάνεια, προέλευση και μετρήσιμο αντίκτυπο, ενώ παράλληλα προείνουμε λύσεις για αύξηση της αποτελεσματικότητας και μείωση των επιπτώσεων.",
    en: "ATHENAX brings together public data, simulation models, and the voice of citizens in one unified platform. We empower municipalities to test ideas before committing resources — with transparency, traceability, and measurable impact. At the same time, we propose solutions that improve efficiency and minimize negative outcomes.",
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
    tag: { el: "Προσομοίωση", en: "Simulation" },
    title: { el: "Προσομοιώνουμε σενάρια", en: "Scenario simulation" },
    body: {
      el: "Προσομοίνουμε σενάρια πολιτικών νομοθεσιών και πολεοδομικών έργων.",
      en: "We simulate policy, legislative, and urban development scenarios.",
    },
    href: "/policies",
    linkLabel: { el: "Τρέξε προσομοίωση", en: "Run a simulation" },
  },
  {
    id: "S.02.02",
    number: "02",
    tag: { el: "Αναλύουμε", en: "Analysation" },
    title: { el: "Αναλύουμε το σενάριο", en: "Scenario analysation" },
    body: {
      el: "Εντοπίζουμε θετικά και αρνητικά και αναγνωρίζουμε το πρόβλημα.",
      en: "We assess benefits and drawbacks to identify the underlying problem.",
    },
    href: "/data",
    linkLabel: { el: "Δες τα δεδομένα μας", en: "Meet our data" },
  },
  {
    id: "S.02.03",
    number: "03",
    tag: { el: "Βελτιστοποίηση", en: "Optimisation" },
    title: { el: "Βελτιστοποιούμε το σενάριο", en: "Scenario optimisation" },
    body: {
      el: "Προτείνουμε λύσεις, αυξάνοντας την αποτελεσματικότητα και αντιμετωπίζοντας τα προβλήματα.",
      en: "We propose solutions that improve efficiency and address existing challenges.",
    },
    href: "/policies",
    linkLabel: { el: "Τρέξε προσομοίωση", en: "Run a simulation" },
  },
  {
    id: "S.02.04",
    number: "04",
    tag: { el: "Συμπέρασμα", en: "Conclusion" },
    title: { el: "Αποφασίζουμε", en: "Decision" },
    body: {
      el: "Με την βοήθεια της Τεχνητής Νοημοσύνης καταλήγουμε σε μια απόφαση.",
      en: "AI-powered insights help us make informed decisions.",
    },
    href: "/impact",
    linkLabel: { el: "Δες τον αντίκτυπο", en: "Review impact" },
  },
];

export const STOPS: HomeStop[] = [
  { id: "S.00", label: { el: "Είσοδος", en: "Enter" } },
  { id: "S.01", label: { el: "Όραμα", en: "Vision" } },
  { id: "S.02.01", label: { el: "Προσομοίωση", en: "Simulation" } },
  { id: "S.02.02", label: { el: "Αναλύουμε", en: "Analysation" } },
  { id: "S.02.03", label: { el: "Βελτιστοποίηση", en: "Optimisation" } },
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
    title: { el: "Ρώτησε την Πόλη", en: "Ask the City" },
    description: {
      el: "Ερωτήσεις με πηγές και αποδείξεις",
      en: "Questions backed by cited sources",
    },
  },
  {
    href: "/policies",
    icon: ScrollText,
    title: { el: "Σενάρια", en: "Scenarios" },
    description: {
      el: "Σχεδιασμός σεναρίων και παραλλαγές",
      en: "Scenario design and variants",
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
    title: { el: "Προτάσεις", en: "Proposals" },
    description: {
      el: "Προτάσεις πολιτών με αξιολόγηση AI",
      en: "Citizen proposals evaluated with AI",
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
    el: "Ξεκινήστε δωρεάν και αναβαθμήστε όταν η πόλη γίνει μέρος της καθημερινής σας εργασίας.",
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
    name: { el: "Αρχική", en: "Starting" },
    price: { el: "€0", en: "€0" },
    period: { el: "/ Μήνα", en: "/month" },
    summary: {
      el: "Για μεμονωμένους ερευνητές και πρώτες δοκιμές.",
      en: "For individual researchers and first experiments.",
    },
    features: [
      { el: "7 ερωτήσεις την ημέρα στο ΑI", en: "7 AI-powered queries per day" },
      { el: "Βασικά δεδομένων", en: "Basic datasets" },
      { el: "Βασικές προσομοιώσεις", en: "Core simulations" },
    ],
    cta: { el: "Ξεκινήστε δωρεάν", en: "Start free" },
    href: "/",
  },
  {
    id: "premium",
    name: { el: "Premium", en: "Premium" },
    price: { el: "€6,79", en: "€6.79" },
    period: { el: "/ μήνα", en: "/ month" },
    summary: {
      el: "Για ομάδες ανάλυσης και σχεδιασμού σεναρίων.",
      en: "For analysis and scenario design teams.",
    },
    features: [
      { el: "30 ερωτήσεις στο AI την ημέρα", en: "30 AI-powered queries per day" },
      { el: "Πρόσβαση σε ανοιχτά δεδομένα", en: "Access to open data" },
      { el: "10/ημέρα σενάρια με όλες τις παραμέτρους", en: "10 scenarios per day with all parameters" },
    ],
    cta: { el: "Αναβάθμιση", en: "Upgrade" },
    href: "/",
    featured: true,
  },
  {
    id: "deluxe",
    name: { el: "Deluxe", en: "Deluxe" },
    price: { el: "€13,99", en: "€13.99" },
    period: { el: "/ μήνα", en: "/ month" },
    summary: {
      el: "Για δήμους και οργανισμούς με ειδικές ανάγκες.",
      en: "For municipalities and organisations with custom needs.",
    },
    features: [
      { el: "Απεριόριστες χρήσεις", en: "Unlimited usage" },
    ],
    cta: { el: "Μιλήστε μαζί μας", en: "Talk to us" },
    href: "/",
  },
];

export const FINALE = {
  eyebrow: { el: "S.06 · Ξεκινήστε τώρα", en: "S.06 · Start now" },
  title: {
    el: "Ρωτήστε την πόλη. Δοκιμάστε ένα σενάριο.",
    en: "Ask the city. Test a scenario.",
  },
  body: {
    el: "Ένα ερώτημα αρκεί για να δείτε πώς τα δεδομένα γίνονται απόφαση — με πηγές, σενάρια και μετρήσιμο αντίκτυπο.",
    en: "One question is enough to see how data becomes a decision — with sources, scenarios and measurable impact.",
  },
  primary: { el: "Ρώτησε την πόλη", en: "Ask the city" },
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
