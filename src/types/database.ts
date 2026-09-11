// Hand-written types mirroring supabase/migrations/0001_init.sql.
// Regenerate with `supabase gen types typescript` once the project is linked
// to a Supabase CLI project if these drift from the live schema.
//
// These are deliberately `type` aliases, not `interface` declarations: the
// generic Supabase client checks `Row extends Record<string, unknown>` to
// resolve table types, and an `interface` does not structurally satisfy an
// index-signature type in that kind of conditional check (a `type` object
// alias does) — using `interface` here silently collapses every Insert /
// Update generic to `never`.

export type EcosystemMemberSource = "registry" | "web_search";

export type Organization = {
  id: string;
  owner_id: string;
  name: string;
  industry: string | null;
  created_at: string;
};

export type Transformation = {
  id: string;
  organization_id: string;
  challenges: string | null;
  objectives: string | null;
  constraints: string | null;
  status: string;
  created_at: string;
};

export type Gap = {
  id: string;
  transformation_id: string;
  name: string;
  reason: string | null;
  created_at: string;
};

export type Priority = {
  id: string;
  transformation_id: string;
  name: string;
  reason: string | null;
  created_at: string;
};

export type EcosystemMember = {
  id: string;
  created_by: string | null;
  name: string;
  type: string;
  website: string | null;
  description: string | null;
  contact: string | null;
  created_at: string;
};

export type Match = {
  id: string;
  transformation_id: string;
  category: string;
  name: string;
  reason: string | null;
  gap_addressed: string | null;
  website: string | null;
  contact_email: string | null;
  ecosystem_member_id: string | null;
  source: EcosystemMemberSource;
  created_at: string;
};

export type TechStackEntry = {
  name: string;
  maturity: string;
};

export type TrajectoryScores = {
  cost?: number;
  co2?: number;
  risk?: number;
  roi?: number;
  feasibility?: number;
};

export type Trajectory = {
  id: string;
  transformation_id: string;
  name: string;
  stance: string | null;
  description: string | null;
  cost_delta: number | null;
  co2_reduction: number | null;
  roi_years: number | null;
  tech_stack: TechStackEntry[];
  scores: TrajectoryScores;
  created_at: string;
};

export type Risk = {
  id: string;
  transformation_id: string;
  name: string;
  reason: string | null;
  created_at: string;
};

// @supabase/postgrest-js requires every table entry to also carry a
// `Relationships` array (used for typed embedded-resource joins, which this
// project doesn't use) and the schema to declare `Views`/`Functions`, even
// when empty.
type Table<Row, Insert> = { Row: Row; Insert: Insert; Update: Partial<Row>; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      organizations: Table<Organization, Partial<Organization> & Pick<Organization, "name" | "owner_id">>;
      transformations: Table<Transformation, Partial<Transformation> & Pick<Transformation, "organization_id">>;
      gaps: Table<Gap, Partial<Gap> & Pick<Gap, "transformation_id" | "name">>;
      priorities: Table<Priority, Partial<Priority> & Pick<Priority, "transformation_id" | "name">>;
      ecosystem_members: Table<EcosystemMember, Partial<EcosystemMember> & Pick<EcosystemMember, "name" | "type">>;
      matches: Table<Match, Partial<Match> & Pick<Match, "transformation_id" | "category" | "name" | "source">>;
      trajectories: Table<Trajectory, Partial<Trajectory> & Pick<Trajectory, "transformation_id" | "name">>;
      risks: Table<Risk, Partial<Risk> & Pick<Risk, "transformation_id" | "name">>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
