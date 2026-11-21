import {
  Code2,
  Database,
  FileText,
  FlaskConical,
  Home,
  Landmark,
  MessagesSquare,
  Plus,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Lang } from "@athenax/types";

export interface NavLink {
  href: string;
  label: Record<Lang, string>;
  shortLabel?: Record<Lang, string>;
  description?: Record<Lang, string>;
  keywords?: string[];
  icon: LucideIcon;
}

export const PRIMARY_LINKS: NavLink[] = [
  {
    href: "/data",
    icon: Database,
    label: { el: "Δεδομένα", en: "Data" },
    description: {
      el: "Σύνολα δεδομένων, πηγές και ποιότητα",
      en: "Datasets, sources and quality",
    },
    keywords: ["data", "datasets", "sources", "δεδομενα", "πηγες"],
  },
  {
    href: "/ask",
    icon: MessagesSquare,
    label: { el: "Ρώτησε την Πόλη", en: "Ask the City" },
    shortLabel: { el: "Ρώτησε", en: "Ask" },
    description: {
      el: "Απαντήσεις με πηγές από τα δεδομένα της πόλης",
      en: "Answers with sources from the city's data",
    },
    keywords: ["ask", "question", "ai", "ρωτα", "ερωτηση"],
  },
  {
    href: "/policies",
    icon: FileText,
    label: { el: "Σενάρια", en: "Scenarios" },
    description: {
      el: "Δημιουργία, σύγκριση και προσομοίωση σεναρίων",
      en: "Create, compare and simulate scenarios",
    },
    keywords: ["scenarios", "scenario", "σενάρια", "σεναριο", "policies", "policy", "πολιτικες", "πολιτικη"],
  },
];

export const MORE_LINKS: NavLink[] = [
  {
    href: "/govtech",
    icon: Landmark,
    label: { el: "GovTech", en: "GovTech" },
    description: {
      el: "Συνδέσεις και σήματα δημόσιου τομέα",
      en: "Connectors and public-sector signals",
    },
    keywords: ["govtech", "connectors", "data sources"],
  },
  {
    href: "/citizen",
    icon: Users,
    label: { el: "Προτάσεις", en: "Proposals" },
    description: {
      el: "Προτάσεις πολιτών με αξιολόγηση AI",
      en: "Citizen proposals evaluated with AI",
    },
    keywords: ["citizens", "proposals", "πολιτες", "προτασεις", "αξιολογηση", "ai"],
  },
  {
    href: "/research",
    icon: FlaskConical,
    label: { el: "Έρευνα", en: "Research" },
    description: {
      el: "Πειράματα και μεθοδολογία",
      en: "Experiments and methodology",
    },
    keywords: ["research", "experiments", "ερευνα", "πειραματα"],
  },
  {
    href: "/developers",
    icon: Code2,
    label: { el: "Developers", en: "Developers" },
    description: {
      el: "API, συμβόλαια δεδομένων και ενσωμάτωση",
      en: "API, data contracts and integration",
    },
    keywords: ["developers", "api", "integration"],
  },
  {
    href: "/admin",
    icon: Settings,
    label: { el: "Διαχείριση", en: "Admin" },
    description: {
      el: "Πηγές, υγεία συστήματος και λειτουργίες",
      en: "Sources, health and operations",
    },
    keywords: ["admin", "operations", "διαχειριση"],
  },
];

export const NEW_POLICY_LINK: NavLink = {
  href: "/policies/new",
  icon: Plus,
  label: { el: "Νέο σενάριο", en: "New scenario" },
  description: {
    el: "Ξεκινήστε ένα νέο σενάριο από την αρχή",
    en: "Start a new scenario from scratch",
  },
  keywords: ["new", "create", "scenario", "policy", "νεο", "σεναριο", "δημιουργια"],
};

export const ALL_LINKS: NavLink[] = [...PRIMARY_LINKS, ...MORE_LINKS];

export const MOBILE_LINKS: NavLink[] = [
  { href: "/", icon: Home, label: { el: "Αρχική", en: "Home" } },
  { href: "/data", icon: Database, label: { el: "Δεδομένα", en: "Data" } },
  { href: "/ask", icon: MessagesSquare, label: { el: "Ρώτησε", en: "Ask" } },
  { href: "/policies", icon: FileText, label: { el: "Σενάρια", en: "Scenarios" } },
];

export interface NavGroup {
  label: Record<Lang, string>;
  links: NavLink[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: { el: "Δημόσιος τομέας", en: "Public sector" },
    links: [MORE_LINKS[0]],
  },
  {
    label: { el: "Συμμετοχή & έρευνα", en: "Engage & research" },
    links: [MORE_LINKS[1], MORE_LINKS[2]],
  },
  {
    label: { el: "Πλατφόρμα", en: "Platform" },
    links: [MORE_LINKS[3], MORE_LINKS[4]],
  },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isAnyActive(pathname: string, links: NavLink[]): boolean {
  return links.some((link) => isActive(pathname, link.href));
}
