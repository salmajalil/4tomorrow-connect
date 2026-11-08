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

export type BrandTheme = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  ink: string;
  muted: string;
  accent: string;
  accentStrong: string;
  accentInk: string;
  sourceLabel: string;
  generatedAt: string;
};

export type Organization = {
  id: string;
  owner_id: string;
  name: string;
  industry: string | null;
  brand_theme: BrandTheme | null;
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
  maturity_highlights: string[] | null;
  root_causes: { name: string; reason: string }[];
  decision_criteria: string[];
  starting_recommendation: string | null;
  starting_actions: string[] | null;
  strategic_brief: string | null;
  good_ideas: string[];
  // Bumped whenever selected_trajectory_id changes (see decide-flow.tsx's
  // selectTrajectory). A CEO validation token snapshots this value at
  // issuance; a mismatch at consumption means the decision moved since the
  // link was sent — see src/lib/validation-token.ts.
  decision_updated_at: string;
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

// D01 — the deterministic, server-computed half of the diagnostic (see
// src/lib/decide-diagnostic-calc.ts). gap/priority/status are never set by
// the AI: they're calculated from observed/target/importance/proofNote.
export type CapabilityAssessment = {
  id: string;
  transformation_id: string;
  domain: string;
  observed: number;
  target: number;
  importance: number;
  gap: number;
  priority: number;
  status: "vérifié" | "non vérifié";
  proof_note: string;
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
  // Moderation gate (0024_ecosystem_members_moderation.sql): only 'approved'
  // rows are ever injected into a model prompt.
  status: EcosystemMemberStatus;
  created_at: string;
};

export type EcosystemMemberStatus = "pending" | "approved" | "rejected";

// Per-user, per-route AI call log backing the daily quota
// (0023_ai_usage.sql, assertAiQuota in src/lib/anthropic.ts).
export type AiUsage = {
  id: string;
  user_id: string;
  route: string;
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

// C02 — pertinence fournisseur : voir src/lib/connect-supplier-calc.ts.
// Stockées en jsonb (pas de taxonomie fixe de prérequis/critères).
export type SupplierProofStatus = "vérifié" | "manquant" | "périmé";

export type SupplierPrerequisiteJson = { label: string; met: boolean };
export type SupplierCriterionJson = {
  label: string;
  score: number | null;
  proofStatus: SupplierProofStatus;
  proofDate: string | null;
};

export type SupplierAssessment = {
  id: string;
  match_id: string;
  transformation_id: string;
  prerequisites: SupplierPrerequisiteJson[];
  criteria: SupplierCriterionJson[];
  updated_at: string;
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
  briefing_highlights: string[] | null;
  roadmap_start_date: string | null;
  priority_cost: number | null;
  priority_co2: number | null;
  priority_risk: number | null;
  priority_speed: number | null;
  veto: boolean;
  created_at: string;
};

export type DecisionCriteriaWeight = {
  id: string;
  transformation_id: string;
  axis: string;
  weight: number;
  updated_at: string;
};

export type Risk = {
  id: string;
  transformation_id: string;
  trajectory_id: string | null;
  name: string;
  reason: string | null;
  module_origin: string;
  // AR — jamais rempli par l'IA : saisis par l'utilisateur, ou null tant
  // qu'il ne l'a pas fait (voir src/lib/risk-scoring.ts).
  probability: number | null;
  impact: number | null;
  owner: string | null;
  treatment: string | null;
  created_at: string;
};

export type ActionStatus = "not_started" | "in_progress" | "done";

export type Action = {
  id: string;
  transformation_id: string;
  title: string;
  owner: string | null;
  due_date: string | null;
  status: ActionStatus;
  source_module: string | null;
  created_at: string;
};

// Connecter — "Demander un rendez-vous". match_id nullable: a request can
// target a candidate that was never persisted to `matches`.
export type MeetingRequest = {
  id: string;
  transformation_id: string;
  match_id: string | null;
  partner_name: string;
  requester_name: string;
  requester_email: string;
  message: string;
  created_at: string;
};

export type BenefitSource = "manual" | "business_case";

export type BenefitExpectation = {
  transformation_id: string;
  expected_annual: number | null;
  source: BenefitSource;
  updated_at: string;
};

export type BenefitItem = {
  id: string;
  transformation_id: string;
  label: string;
  perimeter: string;
  value: number;
  created_at: string;
};

export type BenefitObservation = {
  id: string;
  transformation_id: string;
  month: string;
  value: number;
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
  summaryHighlights: string[];
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

// F01 — the deterministic, server-computed skills gap (see
// src/lib/learn-skills-calc.ts). gap/weighted/status are never set by the
// AI: they're calculated from required/demonstrated/criticality/selfAssessed.
export type SkillAssessment = {
  id: string;
  transformation_id: string;
  role: string;
  domain: string;
  required: number;
  demonstrated: number;
  criticality: number;
  self_assessed: boolean;
  gap: number;
  weighted: number;
  status: "à confirmer" | "confirmé";
  created_at: string;
};

// F01 — editable training catalog ("une formation proposée par écart"),
// scoped per organization. A missing row for a domain falls back to
// learn-skills-calc.ts's DEFAULT_TRAINING_SUGGESTIONS, never to the AI.
export type TrainingSuggestion = {
  id: string;
  organization_id: string;
  domain: string;
  suggestion: string;
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
  // Per-kind guided questionnaire answers used to generate this deliverable
  // (0020_deliverable_inputs.sql) — empty object when the client skipped it
  // (e.g. the "Boost All" fast path). Shown back on the view as "basé sur
  // tes réponses" transparency, same spirit as "Comment c'est calculé".
  inputs: Record<string, string>;
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

// PROJET ET ÉQUIPE — membership/role on a transformation (0015_team_roles.sql).
export type TransformationMemberRole = "consultant" | "client" | "expert" | "ceo";

export type TransformationMember = {
  id: string;
  transformation_id: string;
  user_id: string | null;
  invited_email: string;
  role: TransformationMemberRole;
  domain: ModuleName | null;
  invited_at: string;
  accepted_at: string | null;
  created_at: string;
};

// D05 — business case, option off by default. net_annual/payback_years/npv/
// cumulative_by_year are always the output of src/lib/decide-business-case-
// calc.ts's computeBusinessCase — never a value chosen by the AI.
export type BusinessCase = {
  id: string;
  transformation_id: string;
  trajectory_id: string;
  enabled: boolean;
  capex: number;
  annual_gains: number;
  annual_costs: number;
  horizon_years: number;
  discount_rate_percent: number | null;
  net_annual: number;
  payback_years: number | null;
  npv: number | null;
  cumulative_by_year: number[];
  created_at: string;
};

// D02 — cartographie dynamique. `steps`/`demand`/`levers` are the
// user-entered or CSV-imported data; `result` is always the output of
// src/lib/decide-flow-calc.ts's computeFlow for exactly that data — never a
// value chosen by the AI.
export type ProcessFlow = {
  transformation_id: string;
  demand: number;
  steps: { id: string; name: string; process: number; wait: number; capacity: number }[];
  levers: { waitCut: Record<string, number>; capAdd: Record<string, number> };
  result: unknown | null;
  updated_at: string;
};

export type ValidationOutcomeValue = "validated" | "needs_more_info" | "rejected";

// L09 — CEO validation token. See src/lib/validation-token.ts for the
// issuance/consumption rules this row is checked against.
export type CeoValidationToken = {
  id: string;
  transformation_id: string;
  trajectory_id: string;
  decision_snapshot: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  outcome: ValidationOutcomeValue | null;
  outcome_note: string | null;
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
      capability_assessments: Table<
        CapabilityAssessment,
        Partial<CapabilityAssessment> &
          Pick<CapabilityAssessment, "transformation_id" | "domain" | "observed" | "target" | "importance" | "gap" | "priority" | "status">
      >;
      ai_usage: Table<AiUsage, Partial<AiUsage> & Pick<AiUsage, "user_id" | "route">>;
      ecosystem_members: Table<EcosystemMember, Partial<EcosystemMember> & Pick<EcosystemMember, "name" | "type">>;
      matches: Table<Match, Partial<Match> & Pick<Match, "transformation_id" | "category" | "name" | "source">>;
      meeting_requests: Table<
        MeetingRequest,
        Partial<MeetingRequest> &
          Pick<MeetingRequest, "transformation_id" | "partner_name" | "requester_name" | "requester_email">
      >;
      supplier_assessments: Table<
        SupplierAssessment,
        Partial<SupplierAssessment> & Pick<SupplierAssessment, "match_id" | "transformation_id">
      >;
      trajectories: Table<Trajectory, Partial<Trajectory> & Pick<Trajectory, "transformation_id" | "name">>;
      decision_criteria_weights: Table<
        DecisionCriteriaWeight,
        Partial<DecisionCriteriaWeight> & Pick<DecisionCriteriaWeight, "transformation_id" | "axis" | "weight">
      >;
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
      skill_assessments: Table<
        SkillAssessment,
        Partial<SkillAssessment> &
          Pick<SkillAssessment, "transformation_id" | "role" | "domain" | "required" | "demonstrated" | "criticality" | "gap" | "weighted" | "status">
      >;
      training_suggestions: Table<TrainingSuggestion, Partial<TrainingSuggestion> & Pick<TrainingSuggestion, "organization_id" | "domain" | "suggestion">>;
      deliverables: Table<
        Deliverable,
        Partial<Deliverable> & Pick<Deliverable, "transformation_id" | "trajectory_id" | "kind" | "title">
      >;
      mission_feedback: Table<
        MissionFeedback,
        Partial<MissionFeedback> & Pick<MissionFeedback, "transformation_id" | "trajectory_id" | "feedback_text">
      >;
      transformation_members: Table<
        TransformationMember,
        Partial<TransformationMember> & Pick<TransformationMember, "transformation_id" | "invited_email" | "role">
      >;
      actions: Table<Action, Partial<Action> & Pick<Action, "transformation_id" | "title">>;
      benefit_expectations: Table<BenefitExpectation, Partial<BenefitExpectation> & Pick<BenefitExpectation, "transformation_id">>;
      benefit_items: Table<BenefitItem, Partial<BenefitItem> & Pick<BenefitItem, "transformation_id" | "label" | "perimeter" | "value">>;
      benefit_observations: Table<
        BenefitObservation,
        Partial<BenefitObservation> & Pick<BenefitObservation, "transformation_id" | "month" | "value">
      >;
      business_cases: Table<
        BusinessCase,
        Partial<BusinessCase> &
          Pick<
            BusinessCase,
            | "transformation_id"
            | "trajectory_id"
            | "capex"
            | "annual_gains"
            | "annual_costs"
            | "horizon_years"
            | "net_annual"
          >
      >;
      ceo_validation_tokens: Table<
        CeoValidationToken,
        Partial<CeoValidationToken> &
          Pick<CeoValidationToken, "transformation_id" | "trajectory_id" | "decision_snapshot" | "token" | "expires_at">
      >;
      process_flows: Table<ProcessFlow, Partial<ProcessFlow> & Pick<ProcessFlow, "transformation_id">>;
    };
    Views: Record<string, never>;
    Functions: {
      // 0025_claim_pending_invitations.sql — renvoie le nombre d'invitations acceptées.
      claim_pending_invitations: { Args: Record<string, never>; Returns: number };
    };
  };
};
