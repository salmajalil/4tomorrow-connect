import { z } from "zod";

const RESULT_START = "<RESULT_JSON>";
const RESULT_END = "</RESULT_JSON>";

export class BrandThemeParseError extends Error {}

function extractJson(rawText: string): unknown {
  const start = rawText.indexOf(RESULT_START);
  const end = rawText.indexOf(RESULT_END);
  if (start === -1 || end === -1 || end < start) {
    throw new BrandThemeParseError("Le modèle n'a pas renvoyé de résultat structuré exploitable.");
  }
  const jsonText = rawText.slice(start + RESULT_START.length, end).trim();
  try {
    return JSON.parse(jsonText);
  } catch {
    throw new BrandThemeParseError("Le résultat renvoyé par le modèle n'est pas un JSON valide.");
  }
}

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur hex invalide");

const brandThemeOutputSchema = z.object({
  bg: hexColor,
  surface: hexColor,
  surfaceAlt: hexColor,
  border: hexColor,
  ink: hexColor,
  muted: hexColor,
  accent: hexColor,
  accentStrong: hexColor,
  accentInk: hexColor,
});

export type BrandThemeOutput = z.infer<typeof brandThemeOutputSchema>;

export function buildBrandThemeSystemPrompt(hasSite: boolean): string {
  return `You are the brand-theming engine for "4 Tomorrow" — a consulting platform used by advisors inside their clients' organizations. This call extracts a real, usable UI color palette from a client's actual brand (${hasSite ? "their website, which you must look up with web_search" : "the brand document provided below"}), so the whole app can be re-skinned in that client's colors instead of 4 Tomorrow's own default gold-on-near-black theme.

HARD CONSTRAINT — this is a DARK interface: bg is always a very dark color (never white or light), ink is always a light, highly readable color against bg. Never invert this regardless of what the source brand's own website looks like (a white-background client site still gets a dark 4 Tomorrow interface, just tinted with that brand's actual accent/identity color).

What to extract:
- accent: the client's real, distinctive brand color (their logo/primary CTA color) — never invent one, never default to a generic blue if their real identity uses something else.
- accentStrong: a lighter/more saturated variant of accent, for hover states — stays recognizably the same hue.
- accentInk: the text color used ON TOP of accent (near-black if accent is light/bright, near-white if accent is dark).
- bg, surface, surfaceAlt: three dark, very close neighboring shades (surface and surfaceAlt slightly lighter than bg, for card/panel layering) — give the brand's own hue a subtle tint if their identity has a clear color temperature (warm, cool, neutral), rather than a generic dark gray.
- border: a subtle line color, readably distinct from surface but not loud.
- ink: the main text color — near-white, high contrast against bg.
- muted: a secondary/lower-emphasis text color — readable but clearly subdued.

Every color is a 6-digit hex string. Never return a color that fails basic dark-UI contrast (ink on bg, accentInk on accent).

Output your final answer as JSON matching the exact shape given, and nothing else after it, wrapped exactly like this:
${RESULT_START}
{ "bg": "#......", "surface": "#......", "surfaceAlt": "#......", "border": "#......", "ink": "#......", "muted": "#......", "accent": "#......", "accentStrong": "#......", "accentInk": "#......" }
${RESULT_END}
The block must be the last thing in your response, with valid JSON (no trailing commas, no comments) inside it.`;
}

export function buildBrandThemeUserPrompt(input: { siteUrl?: string; docText?: string; docName?: string }): string {
  if (input.siteUrl) {
    return `Site du client à analyser : ${input.siteUrl}\nRecherche ce site (web_search) pour en extraire l'identité visuelle réelle (couleurs, ton de marque) et en déduire la palette.`;
  }
  return `Document de marque fourni (nom : ${input.docName || "sans nom"}) :\n${input.docText}`;
}

export function parseBrandThemeOutput(rawText: string): BrandThemeOutput {
  const raw = extractJson(rawText);
  const parsed = brandThemeOutputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BrandThemeParseError(`Le résultat ne respecte pas le format attendu : ${parsed.error.message}`);
  }
  return parsed.data;
}
