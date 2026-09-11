// Mirrors the categories the schema and the matching prompt use
// (see supabase/migrations/0001_init.sql, ecosystem_members.type). Presented
// as suggestions on the join form, never a hard constraint — the field
// itself stays free text so a category like "Certifier" or "R&D Lab" isn't
// blocked either.
export const ECOSYSTEM_MEMBER_TYPES = ["Startup", "Technology", "Expert", "Partner", "Funding"];
