import type { IconName } from "@/components/icons";

export interface IndustryOption {
  value: string;
  label: string;
  icon: IconName;
}

// Predefined tiles for step 1. Never exhaustive on purpose — the "type your
// own" field on the step itself is what actually guarantees no sector is
// blocked.
export const INDUSTRIES: IndustryOption[] = [
  { value: "Aerospace", label: "Aerospace", icon: "plane" },
  { value: "Automotive", label: "Automotive", icon: "car" },
  { value: "Manufacturing", label: "Manufacturing", icon: "factory" },
  { value: "Energy", label: "Energy", icon: "bolt" },
  { value: "Chemicals", label: "Chemicals", icon: "flask" },
  { value: "Healthcare & Pharma", label: "Healthcare & Pharma", icon: "health" },
  { value: "Agriculture", label: "Agriculture", icon: "leaf" },
  { value: "Construction", label: "Construction", icon: "building" },
  { value: "Logistics", label: "Logistics", icon: "truck" },
  { value: "Electronics", label: "Electronics", icon: "plug" },
];

// Suggested tags for step 2. Multi-select; a free-text "add your own" input
// on the step extends this list per-session.
export const PARTNER_TYPES: string[] = [
  "Suppliers",
  "Logistics Providers",
  "Experts",
  "Investors",
  "Distributors",
  "Startups",
  "Certifiers",
  "R&D Labs",
  "Networks",
];

