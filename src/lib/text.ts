// Shared "derive a display title from raw free-text" helper — every
// module falls back to the project's raw challenges/objectives text when
// no generated title exists yet, and a blind slice(0, n) cuts mid-word
// (e.g. "...commercialisation S"). Cutting at the last word boundary and
// only adding an ellipsis when something was actually dropped keeps that
// fallback readable everywhere it's used.
export function projectTitle(text: string, maxLength = 72): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  const cut = trimmed.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  const safe = lastSpace > maxLength * 0.4 ? cut.slice(0, lastSpace) : cut;
  return `${safe.trimEnd()}…`;
}
