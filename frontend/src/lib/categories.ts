import {
  KeyRound,
  Laptop2,
  LifeBuoy,
  Network,
  Server,
  Shield,
  UserCog,
  Wifi,
  type LucideIcon,
} from "lucide-react";

import type { CategoryKey } from "@/lib/types";

interface CategoryMeta {
  label: string;
  icon: LucideIcon;
  /** Short verb-phrase for buttons/quick actions. */
  shortLabel: string;
  /** A real question that actually gets answered by this category's docs. */
  prompt: string;
}

export const CATEGORY_ORDER: CategoryKey[] = [
  "network",
  "security",
  "microsoft365",
  "hardware",
  "software",
  "accounts",
  "infrastructure",
  "helpdesk",
];

/** Curated subset surfaced as one-click sidebar quick actions. */
export const QUICK_ACTION_CATEGORIES: CategoryKey[] = ["accounts", "network", "security", "hardware"];

export const CATEGORIES: Record<CategoryKey, CategoryMeta> = {
  network: {
    label: "Network & VPN",
    shortLabel: "Fix VPN or network issue",
    icon: Wifi,
    prompt: "How do I connect to the company VPN?",
  },
  security: {
    label: "Security",
    shortLabel: "Report a security concern",
    icon: Shield,
    prompt: "What should I do if I suspect a phishing email?",
  },
  microsoft365: {
    label: "Microsoft 365",
    shortLabel: "Microsoft 365 help",
    icon: Network,
    prompt: "How do I create a shared mailbox in Microsoft 365?",
  },
  hardware: {
    label: "Hardware",
    shortLabel: "Troubleshoot my device",
    icon: Laptop2,
    prompt: "My laptop is running slow. What should I do?",
  },
  software: {
    label: "Software",
    shortLabel: "Software & licensing help",
    icon: LifeBuoy,
    prompt: "How do I request a new software license?",
  },
  accounts: {
    label: "Accounts & Access",
    shortLabel: "Reset my password",
    icon: UserCog,
    prompt: "How do I reset a user's Active Directory password?",
  },
  infrastructure: {
    label: "Servers & Infrastructure",
    shortLabel: "Report an infrastructure issue",
    icon: Server,
    prompt: "What is the escalation process for a P1 incident?",
  },
  helpdesk: {
    label: "Helpdesk & General",
    shortLabel: "General helpdesk question",
    icon: KeyRound,
    prompt: "How do I onboard a new employee?",
  },
};

export function categoryMeta(key: CategoryKey | string): CategoryMeta {
  return CATEGORIES[key as CategoryKey] ?? CATEGORIES.helpdesk;
}
