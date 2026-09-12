import { z } from "zod";
import type { EcosystemMember, Language } from "@/types/database";

function languageInstruction(language: Language): string {
  const languageName = language === "en" ? "English" : "French";
  return `Respond in ${languageName}, EXCEPT for the JSON keys themselves which must stay in English exactly as specified below.`;
}

export interface MatchingInput {
  industry: string;
  partnerTypes: string[];
  location: string;
  budget: string;
  co2Target: string;
  description: string;
}

const matchSchema = z.object({
  category: z.enum(["technology", "startup", "expert", "partner", "funding"]),
  name: z.string().min(1),
  reason: z.string().min(1),
  gapAddressed: z.string().min(1),
  website: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  source: z.enum(["registry", "web_search"]),
  ecosystemMemberId: z.string().nullable().optional(),
});

const modelOutputSchema = z.object({
  gaps: z
    .array(z.object({ name: z.string().min(1), reason: z.string().min(1) }))
    .min(1),
  strategicBrief: z.string().min(1),
  goodIdeas: z.array(z.string().min(1)).min(1),
  matches: z.array(matchSchema).min(1),
});

export type ModelOutput = z.infer<typeof modelOutputSchema>;
export type MatchOutput = z.infer<typeof matchSchema>;

const RESULT_START = "<RESULT_JSON>";
const RESULT_END = "</RESULT_JSON>";

/**
 * ---------------------------------------------------------------------
 * IP / traceability note — "living directory" matching mechanism
 * ---------------------------------------------------------------------
 * This is the core mechanism flagged as a potentially distinctive product
 * asset, kept documented here for a future IP review. It is a three-stage
 * loop, each stage implemented by a different function in this module and
 * in src/app/api/match/route.ts:
 *
 *   1. OPEN CONTRIBUTION — any authenticated user can add an entry to the
 *      shared `ecosystem_members` table via the "Join the ecosystem" form
 *      (src/app/ecosystem/join/page.tsx -> src/app/api/ecosystem/join/route.ts),
 *      with no manual moderation step before it becomes usable.
 *
 *   2. CONTEXT RE-INJECTION — on every single matching run, BEFORE calling
 *      the model, the route handler (src/app/api/match/route.ts) queries
 *      the full current `ecosystem_members` table and serializes it into
 *      the system prompt built by buildSystemPrompt() below. The model is
 *      instructed to prefer these known, previously-vetted-by-usage
 *      entries over a fresh web search when one is genuinely relevant —
 *      so every contribution immediately improves every future match for
 *      every user, without retraining or redeploying anything.
 *
 *   3. SOURCE-LABELED OUTPUT — the model is required (via the JSON schema
 *      enforced by parseModelOutput() below) to tag each recommendation
 *      with source: "registry" (came from the injected directory,
 *      optionally carrying the originating ecosystem_members.id) or
 *      "web_search" (came from a live web search performed during this
 *      call). That distinction survives all the way to the UI badge on
 *      each match card, so the growing registry and the live web are
 *      always visibly, auditably separate in the final product surface.
 *
 * This closes a feedback loop most "AI matching" tools don't have: the
 * directory both gates and grows from its own past output.
 * ---------------------------------------------------------------------
 */
export function buildSystemPrompt(registry: EcosystemMember[], language: Language): string {
  const registryBlock =
    registry.length > 0
      ? registry
          .map(
            (m) =>
              `- id=${m.id} | name="${m.name}" | type="${m.type}"${m.website ? ` | website=${m.website}` : ""}${
                m.contact ? ` | contact=${m.contact}` : ""
              }${m.description ? ` | description="${m.description}"` : ""}`
          )
          .join("\n")
      : "(empty — no contributions yet, rely entirely on web search)";

  return `You are the matching engine for "4 Tomorrow / Connect", a B2B platform that connects industrial companies running a transformation project with real, verifiable partners: technologies, startups, experts/consultants, and partners.

KNOWN ECOSYSTEM DIRECTORY (community-contributed, re-injected on every run — prefer these when genuinely relevant to avoid redundant web search, and mark them as source "registry" with their id as ecosystemMemberId):
${registryBlock}

You also have a web_search tool (max 2 uses). Use it efficiently: batch what you need into as few searches as possible, then finalize your answer — do not keep searching for marginal improvements once you have enough real, verifiable matches to answer well. You are working under a hard time budget; a complete, on-time answer beats an exhaustive but late one.

STRICT RULES:
1. Every recommendation MUST explicitly name the gap it addresses (gapAddressed must match one of the "gaps" you output, by its "name").
2. NEVER recommend something generic ("an AI platform", "a consulting firm"). Every match MUST be a real, specific, verifiable organization or named person.
3. Only include a website or contactEmail when you are reasonably confident it is real (found via web_search or present in the directory above). If you cannot verify one, omit the field entirely — never invent a plausible-looking email or URL.
4. category must be one of: "technology", "startup", "expert", "partner", "funding". Use "funding" for real, named grant programs, subsidy schemes, or investors — never a vague "funding is available" statement without naming the specific program or organization.
5. source must be "registry" only when the match came from the KNOWN ECOSYSTEM DIRECTORY above (include its id as ecosystemMemberId); otherwise "web_search".
6. strategicBrief is ONE synthesis paragraph (not a list) naming the specific opportunity and the recommended strategic angle for this exact project.
7. goodIdeas is exactly 3 numbered, actionable, project-specific recommendations — never generic advice.
8. Identify 2-4 concrete gaps from the project description before proposing matches; every match must trace back to one of them.
9. If the user gave a location, take it into account: prefer matches genuinely relevant to that region, but don't invent a fake local presence for an organization — note in "reason" when a strong match operates outside the stated region rather than silently claiming otherwise.
10. Never state a specific number (a percentage, a euro amount, a tonnage of CO2) unless you found it from a real, citable source via web_search or the directory — if you don't have a verified figure, describe the opportunity qualitatively instead of inventing one.

${languageInstruction(language)}

After you finish any research, output your final answer as JSON matching this exact shape, and nothing else after it:
${RESULT_START}
{
  "gaps": [{ "name": string, "reason": string }],
  "strategicBrief": string,
  "goodIdeas": [string, string, string],
  "matches": [
    {
      "category": "technology" | "startup" | "expert" | "partner" | "funding",
      "name": string,
      "reason": string,
      "gapAddressed": string,
      "website": string | null,
      "contactEmail": string | null,
      "source": "registry" | "web_search",
      "ecosystemMemberId": string | null
    }
  ]
}
${RESULT_END}

Produce at least 4 matches across at least 2 different categories when possible. The ${RESULT_START}...${RESULT_END} block must be the last thing in your response, with valid JSON (no trailing commas, no comments) inside it.`;
}

export function buildUserPrompt(input: MatchingInput): string {
  const partnerTypesLine =
    input.partnerTypes.length > 0
      ? input.partnerTypes.join(", ")
      : "(non précisé — propose un mix pertinent de catégories)";

  const descriptionLine = input.description.trim()
    ? input.description.trim()
    : "(non fourni — base-toi uniquement sur l'industrie et les types de partenaires recherchés)";

  const locationLine = input.location.trim() || "(non précisée — pas de contrainte géographique)";
  const budgetLine = input.budget.trim() || "(non précisé)";
  const co2Line = input.co2Target.trim() || "(non précisé)";

  return `Industrie : ${input.industry}
Types de partenaires recherchés : ${partnerTypesLine}
Zone géographique recherchée : ${locationLine}
Budget approximatif : ${budgetLine}
Objectif de réduction CO2 : ${co2Line}
Description du projet :
${descriptionLine}`;
}

function sanitizeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function sanitizeEmail(email: string | null | undefined): string | undefined {
  if (!email) return undefined;
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : undefined;
}

export class MatchingParseError extends Error {}

export function parseModelOutput(rawText: string): ModelOutput {
  const start = rawText.indexOf(RESULT_START);
  const end = rawText.indexOf(RESULT_END);
  if (start === -1 || end === -1 || end < start) {
    throw new MatchingParseError("Le modèle n'a pas renvoyé de résultat structuré exploitable.");
  }

  const jsonText = rawText.slice(start + RESULT_START.length, end).trim();
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new MatchingParseError("Le résultat renvoyé par le modèle n'est pas un JSON valide.");
  }

  const parsed = modelOutputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new MatchingParseError(
      `Le résultat renvoyé par le modèle ne respecte pas le format attendu : ${parsed.error.message}`
    );
  }

  return {
    ...parsed.data,
    matches: parsed.data.matches.map((m) => ({
      ...m,
      website: sanitizeUrl(m.website) ?? null,
      contactEmail: sanitizeEmail(m.contactEmail) ?? null,
    })),
  };
}
