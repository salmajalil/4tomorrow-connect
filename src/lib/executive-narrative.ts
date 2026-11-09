// Writing rules for every executive-facing narrative: Livrer's Executive
// Report deliverable (deliver.ts) and Décider's scenario executiveBriefing
// (decide.ts), the narrative shown in the CEO and detailed reports. The
// founder's standard for the CEO report: every point raised comes with its
// solution, short sentences, consulting-grade rigor. Prompt text only — the
// AI still never computes a figure.
export const EXECUTIVE_NARRATIVE_RULES = `EXECUTIVE WRITING RULES — mandatory:
- Problem → solution, always: every issue, risk, gap or weakness you raise is IMMEDIATELY followed by a concrete solution/recommendation (who acts, what exactly, when). Never state a problem alone.
- Strict concision: short sentences (≈20 words max), no paragraph longer than 3-4 lines, no filler, no preamble, no restating the question.
- Analytical rigor — consulting-firm level: quantified whenever the context gives a number (reuse the exact figures provided, never compute or invent new ones), specific to THIS project (its organization, sector, constraints, chosen trajectory), never generic advice that would fit any company.`;
