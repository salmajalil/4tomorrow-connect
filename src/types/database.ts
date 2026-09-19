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
  selected_trajectory_id: string | null;
  maturity_reading: string | null;
  root_causes: { name: string; reason: string }[];
  decision_criteria: string[];
  starting_recommendation: string | null;
  strategic_brief: string | null;
  good_ideas: string[];
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
  weight: number | null;
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

export type IndicatorConfidence = "verified" | "estimate" | "unknown";

export type IndicatorEntry = {
  value: string | number | null; // null when confidence is "unknown" — never a fabricated number
  confidence: IndicatorConfidence;
};

export type TrajectoryIndicators = Record<string, IndicatorEntry>;

export type IndicatorNote = { note: string; at: string };
export type IndicatorFeedback = Record<string, IndicatorNote[]>;

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
  indicators_feedback: IndicatorFeedback;
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
  module_origin: string;
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

export type RoadmapExecutionStatus = "upcoming" | "in_progress" | "done";

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
  actual_start_date: string | null;
  actual_end_date: string | null;
  execution_status: RoadmapExecutionStatus;
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

export type TrainingMode = "rapide" | "document" | "diagnostic" | "workshop";

export type ExecutiveSummary = {
  addressedChallenge: string;
  summary: string;
  actionPlan: string[];
};

export type KeyInsight = { text: string; source?: string | null };
export type BusinessImplication = { text: string };
export type Flashcard = { question: string; answer: string; category?: string | null };
export type QuizOption = { id: string; text: string };
export type ComprehensionQuestion = {
  question: string;
  options: QuizOption[];
  correctOptionId: string;
  explanation: string;
};
export type VideoScene = {
  sceneNumber: number;
  narration: string;
  visualSuggestion: string;
  durationSeconds: number;
};
export type VideoScript = { title: string; scenes: VideoScene[] };

export type WorkshopIntro = { context: string; expectedOutcome: string };
export type WorkshopSupportSection = { title: string; content: string };
export type WorkshopStep = {
  order: number;
  title: string;
  durationMinutes: number;
  description: string;
  materials: string[];
};

export type Training = {
  id: string;
  transformation_id: string;
  topic: string;
  mode: TrainingMode;
  domains: string[];
  audience: string | null;
  objectives: string[];
  prerequisites: string | null;
  duration_minutes: number | null;
  executive_summary: ExecutiveSummary;
  key_insights: KeyInsight[];
  business_implications: BusinessImplication[];
  flashcards: Flashcard[];
  comprehension_check: ComprehensionQuestion[];
  video_script: VideoScript;
  source_doc_name: string | null;
  workshop_intro: WorkshopIntro | null;
  workshop_support: WorkshopSupportSection[] | null;
  workshop_steps: WorkshopStep[] | null;
  created_at: string;
};

export const DELIVERABLE_KINDS = [
  "roadmap",
  "action_plan",
  "kpi_dashboard",
  "risk_map",
  "executive_report",
  "toolkit",
] as const;
export type DeliverableKind = (typeof DELIVERABLE_KINDS)[number];

export type DeliverableRoadmapContent = {
  phases: { phaseName: string; detailedActions: string[]; dependencies: string[]; ownerSuggestion: string }[];
};
export type DeliverableActionPlanContent = {
  actions: { title: string; description: string; ownerSuggestion: string; timeframe: string }[];
};
export type DeliverableKpiDashboardContent = {
  kpis: { name: string; target: string; current: string | null; unit: string; source: "trajectory" | "estimate" }[];
};
export type DeliverableRiskMapContent = {
  risks: {
    name: string;
    description: string;
    likelihood: "low" | "medium" | "high";
    impact: "low" | "medium" | "high";
    mitigation: string;
  }[];
};
export type DeliverableExecutiveReportContent = {
  summary: string;
  keyPoints: string[];
};
export type DeliverableToolkitContent = {
  tools: { name: string; purpose: string; whyThisProject: string }[];
};

export type DeliverableContent =
  | DeliverableRoadmapContent
  | DeliverableActionPlanContent
  | DeliverableKpiDashboardContent
  | DeliverableRiskMapContent
  | DeliverableExecutiveReportContent
  | DeliverableToolkitContent;

export type Deliverable = {
  id: string;
  transformation_id: string;
  trajectory_id: string;
  kind: DeliverableKind;
  title: string;
  content: DeliverableContent;
  created_at: string;
};

export type RecalibrationPhaseChange = { phaseName: string; newEndDate?: string | null; newActions?: string[] | null };
export type RecalibrationSummary = {
  updatedPriorities: { name: string; reason: string; weight: number }[];
  recommendation: string;
  roadmapAdjustment: { proposed: boolean; note: string; phaseChanges: RecalibrationPhaseChange[] } | null;
};

export type MissionFeedback = {
  id: string;
  transformation_id: string;
  trajectory_id: string;
  feedback_text: string;
  ai_summary: RecalibrationSummary;
  applied: boolean;
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
      trainings: Table<Training, Partial<Training> & Pick<Training, "transformation_id" | "topic">>;
      deliverables: Table<
        Deliverable,
        Partial<Deliverable> & Pick<Deliverable, "transformation_id" | "trajectory_id" | "kind" | "title">
      >;
      mission_feedback: Table<
        MissionFeedback,
        Partial<MissionFeedback> & Pick<MissionFeedback, "transformation_id" | "trajectory_id" | "feedback_text">
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
