-- 4 Tomorrow — Confiance v2
--   1. Statut de revue humaine « Brouillon IA / Revu / Validé » sur les
--      livrables clés (deliverables — dont l'executive report — et
--      business_cases).
--   2. Empreinte SHA-256 de la décision au moment de l'émission d'un lien
--      de validation CEO (ceo_validation_tokens.decision_hash).
--
-- Purement additive : uniquement des colonnes nullables ou avec défaut, une
-- fonction et deux triggers. Aucune donnée existante n'est modifiée — les
-- lignes déjà présentes prennent review_status = 'ai_draft' (personne ne les
-- a encore relues : c'est la réalité), et les jetons déjà émis gardent
-- decision_hash = null (la vérification par empreinte est alors ignorée,
-- l'ancienne vérification par trajectoire + decision_updated_at continue de
-- s'appliquer, voir src/lib/validation-token.ts).
--
-- review_status n'est JAMAIS écrit par l'IA : seule la route
-- /api/review-status (geste humain explicite d'un propriétaire ou d'un
-- consultant, vérifié par canPerform(actor, "review_deliverable")) le fait
-- passer à 'reviewed' puis 'validated'.

alter table deliverables
  add column if not exists review_status text not null default 'ai_draft'
    check (review_status in ('ai_draft', 'reviewed', 'validated'));
alter table deliverables add column if not exists reviewed_by uuid references auth.users (id) on delete set null;
alter table deliverables add column if not exists reviewed_at timestamptz;
-- Nom affiché du relecteur, figé au moment de la revue (auth.users n'est
-- pas lisible depuis le client : sans cette copie, l'écran ne pourrait
-- afficher qu'un uuid).
alter table deliverables add column if not exists reviewed_by_name text;

alter table business_cases
  add column if not exists review_status text not null default 'ai_draft'
    check (review_status in ('ai_draft', 'reviewed', 'validated'));
alter table business_cases add column if not exists reviewed_by uuid references auth.users (id) on delete set null;
alter table business_cases add column if not exists reviewed_at timestamptz;
alter table business_cases add column if not exists reviewed_by_name text;

-- ---------------------------------------------------------------------------
-- Une revue porte sur un contenu précis : si ce contenu change ensuite
-- (régénération IA d'un livrable, nouveau chiffrage d'un business case), le
-- statut retombe automatiquement à 'ai_draft' — un « Validé » ne doit jamais
-- rester affiché sur une version que personne n'a relue. Fait en base pour
-- couvrir tous les chemins d'écriture (génération unitaire, « Boost All »,
-- import de document…) sans dépendre de chaque route.
-- ---------------------------------------------------------------------------
create or replace function reset_review_status_on_deliverable_change()
returns trigger
language plpgsql
as $$
begin
  if new.content is distinct from old.content or new.title is distinct from old.title then
    new.review_status := 'ai_draft';
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.reviewed_by_name := null;
  end if;
  return new;
end;
$$;

drop trigger if exists deliverables_reset_review_status on deliverables;
create trigger deliverables_reset_review_status
  before update on deliverables
  for each row execute function reset_review_status_on_deliverable_change();

create or replace function reset_review_status_on_business_case_change()
returns trigger
language plpgsql
as $$
begin
  if new.capex is distinct from old.capex
    or new.annual_gains is distinct from old.annual_gains
    or new.annual_costs is distinct from old.annual_costs
    or new.horizon_years is distinct from old.horizon_years
    or new.discount_rate_percent is distinct from old.discount_rate_percent then
    new.review_status := 'ai_draft';
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.reviewed_by_name := null;
  end if;
  return new;
end;
$$;

drop trigger if exists business_cases_reset_review_status on business_cases;
create trigger business_cases_reset_review_status
  before update on business_cases
  for each row execute function reset_review_status_on_business_case_change();

-- ---------------------------------------------------------------------------
-- L09 — empreinte de la décision à l'émission du lien CEO. SHA-256 (hex)
-- d'un JSON stable des champs clés de la décision (trajectoire retenue, sa
-- version decision_updated_at, et son contenu affiché au CEO), calculée
-- côté serveur par src/lib/decision-hash.ts. Comparée à l'empreinte
-- recalculée au moment de la consommation : si elle diffère, le lien est
-- refusé (« décision modifiée depuis l'envoi »). Null pour les jetons émis
-- avant cette migration.
-- ---------------------------------------------------------------------------
alter table ceo_validation_tokens add column if not exists decision_hash text;
