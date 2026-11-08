-- Livrer — questionnaire guidé par livrable (Priorité 2 : remplacer la
-- génération en un clic par quelques vraies données d'entrée avant de
-- générer). Purement additif : colonne nullable-par-défaut, aucune ligne
-- existante n'est affectée, le chemin rapide "Tout générer" continue de
-- fonctionner en écrivant simplement '{}'.
alter table deliverables add column if not exists inputs jsonb not null default '{}'::jsonb;
