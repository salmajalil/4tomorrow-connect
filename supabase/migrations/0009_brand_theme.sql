-- 4 Tomorrow — client brand theming
--
-- Lets a consultant re-skin the app in their client's own colors: the AI
-- reads the client's website (web_search) or an uploaded brand document
-- and extracts a palette, which is then saved here and reapplied on every
-- visit — "one organization per user" (see every API route's org lookup)
-- means this lives on organizations, not transformations: one brand per
-- account, matching how the rest of the app already treats "organization"
-- as the user's current working context rather than a per-project record.
alter table organizations add column if not exists brand_theme jsonb; -- { bg, surface, surfaceAlt, border, ink, muted, accent, accentStrong, accentInk, sourceLabel, generatedAt }
