export interface IndustryOption {
  value: string;
  label: string;
  icon: string;
}

// Predefined tiles for step 1. Never exhaustive on purpose — the "type your
// own" field on the step itself is what actually guarantees no sector is
// blocked.
export const INDUSTRIES: IndustryOption[] = [
  { value: "Aerospace", label: "Aerospace", icon: "✈️" },
  { value: "Automotive", label: "Automotive", icon: "🚗" },
  { value: "Manufacturing", label: "Manufacturing", icon: "🏭" },
  { value: "Energy", label: "Energy", icon: "⚡" },
  { value: "Chemicals", label: "Chemicals", icon: "🧪" },
  { value: "Healthcare & Pharma", label: "Healthcare & Pharma", icon: "🩺" },
  { value: "Agriculture", label: "Agriculture", icon: "🌾" },
  { value: "Construction", label: "Construction", icon: "🏗️" },
  { value: "Logistics", label: "Logistics", icon: "🚚" },
  { value: "Electronics", label: "Electronics", icon: "🔌" },
];

// Suggested tags for step 2. Multi-select; a free-text "add your own" input
// on the step extends this list per-session.
export const PARTNER_TYPES: string[] = [
  "Suppliers",
  "Experts",
  "Investors",
  "Distributors",
  "Startups",
  "Certifiers",
  "R&D Labs",
  "Networks",
];

