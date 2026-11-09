-- 4 Tomorrow — AR (registre des risques) + Rapport CEO (achievements)
--
-- Purement additive : deux colonnes nullables et un trigger. Aucune
-- nouvelle policy : les policies select/insert/update déjà en place sur
-- `risks` (0001/0015/0016/0022) et `actions` (0016/0022) couvrent ces
-- colonnes comme n'importe quelle autre.

-- ---------------------------------------------------------------------------
-- AR — risks.impacted_object : l'objet que le risque menace (une option de
-- décision, un jalon de roadmap, un bénéfice…). Texte libre saisi par
-- l'utilisateur, jamais rempli par l'IA. Null tant qu'il n'est pas renseigné.
-- ---------------------------------------------------------------------------
alter table risks add column if not exists impacted_object text;

-- ---------------------------------------------------------------------------
-- Rapport CEO — actions.completed_at : date réelle de passage au statut
-- "done", pour que les "achievements de la semaine" et le briefing équipe
-- s'appuient sur une date enregistrée plutôt que devinée. Posée par la base
-- (trigger ci-dessous), pas par le client : elle ne dépend d'aucune horloge
-- navigateur et vaut pour tous les chemins d'écriture. Les actions déjà
-- terminées avant cette migration gardent completed_at = null (date
-- inconnue — jamais rétro-inventée).
-- ---------------------------------------------------------------------------
alter table actions add column if not exists completed_at timestamptz;

create or replace function set_action_completed_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists actions_set_completed_at on actions;
create trigger actions_set_completed_at
  before insert or update of status on actions
  for each row execute function set_action_completed_at();
