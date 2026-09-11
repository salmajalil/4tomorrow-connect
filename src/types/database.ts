// Hand-written types mirroring supabase/migrations/0001_init.sql and
// 0002_decide.sql. Regenerate with `supabase gen types typescript` once the
// project is linked to a Supabase CLI project if these drift from the live
// schema.
//
// These are deliberately `type` aliases, not `interface` declarations: the
// generic Supabase client checks `Row extends Record<string, unknown>` to
// resolve table types, and an `interface` does not structurally satisfy an
// index-signature type in that kind of conditional check (a `type` object
// alias does) — using `interface` here silently collapses every Insert /
// Update generic to `never`.

export type EcosystemMemberSource = "registry" | "web_search";
export type ModuleName = "decide" | "connect" | "deliver" | "learn";
export type RecommendableModule = "connect" | "deliver" | "learn";
export type ModuleRelevance = "relevant" | "possible" | "not_relevant";
export type ModuleStatusValue = "not_started" | "in_progress" | "done";
export type Language = "fr" | "en";

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
  domains: string[];
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
  trajectory_id: string | null;
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
  maturityScale?: string; // e.g. "TRL 1-9", "validated / pilot / hypothesis" — whatever fits the item
  detail?: string;
  benefit?: string;
  verified?: boolean; // true when maturity/detail came from a cited source, not an estimate
};

export type TrajectoryScores = {
  cost?: number;
  co2?: number;
  risk?: number;
  roi?: number;
  feasibility?: number;
  [axis: string]: number | undefined; // 5th axis adapts per domain (e.g. speed, scalability)
};

export type TrajectoryIndicators = Record<string, string | number>;

export type RegulationEntry = {
  name: string;
  description: string;
  sourceUrl?: string | null;
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
  indicators: TrajectoryIndicators;
  regulations: RegulationEntry[];
  executive_briefing: string | null;
  roadmap_start_date: string | null;
  priority_cost: number | null;
  priority_co2: number | null;
  priority_risk: number | null;
  priority_speed: number | null;
  created_at: string;
};

export type Risk = {
  id: string;
  transformation_id: string;
  trajectory_id: string | null;
  name: string;
  reason: string | null;
  created_at: string;
};

export type Opportunity = {
  id: string;
  transformation_id: string;
  trajectory_id: string | null;
  name: string;
  reason: string | null;
  module_origin: string;
  created_at: string;
};

export type RoadmapPhaseEntry = {
  id: string;
  transformation_id: string;
  trajectory_id: string;
  phase_name: string;
  start_date: string;
  end_date: string;
  deliverables: string[];
  actions: string[];
  kpis: string[];
  order_index: number;
  created_at: string;
};

export type ModuleRecommendation = {
  id: string;
  transformation_id: string;
  module: RecommendableModule;
  relevance: ModuleRelevance;
  reason: string | null;
  user_override: boolean;
  created_at: string;
};

export type ModuleStatusRow = {
  id: string;
  transformation_id: string;
  module: ModuleName;
  status: ModuleStatusValue;
  updated_at: string;
};

export type Profile = {
  id: string;
  language: Language;
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
      opportunities: Table<Opportunity, Partial<Opportunity> & Pick<Opportunity, "transformation_id" | "name">>;
      roadmap_phases: Table<
        RoadmapPhaseEntry,
        Partial<RoadmapPhaseEntry> &
          Pick<RoadmapPhaseEntry, "transformation_id" | "trajectory_id" | "phase_name" | "start_date" | "end_date">
      >;
      module_recommendations: Table<
        ModuleRecommendation,
        Partial<ModuleRecommendation> & Pick<ModuleRecommendation, "transformation_id" | "module" | "relevance">
      >;
      module_status: Table<
        ModuleStatusRow,
        Partial<ModuleStatusRow> & Pick<ModuleStatusRow, "transformation_id" | "module">
      >;
      profiles: Table<Profile, Partial<Profile> & Pick<Profile, "id">>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
