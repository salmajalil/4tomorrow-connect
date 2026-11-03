// PROJET ET ÉQUIPE — rôles : droits vérifiés côté serveur à chaque opération.
// Pure, sans accès réseau ni base de données : chaque API route doit appeler
// `canPerform` avant d'écrire quoi que ce soit, et traiter un refus comme
// une erreur 403 — ce module ne fait que dire oui/non, jamais l'écriture
// elle-même.
//
// Règles (brief, section PROJET ET ÉQUIPE), verbatim :
//   consultant = modifie tout, envoie au CEO ;
//   client = modifie les données de son usine ;
//   expert = consulte, commente, modifie son domaine ;
//   CEO = valide / demande un complément / refuse.
import type { ModuleName } from "@/types/database";

export type TransformationRole = "consultant" | "client" | "expert" | "ceo";

export type TransformationAction =
  | "read" // consulter n'importe quelle donnée du projet
  | "comment" // laisser un commentaire sur un outil ou une décision
  | "edit_data" // modifier les données d'un module (diagnostic, scénarios, etc.)
  | "manage_members" // inviter / modifier / retirer un membre
  | "send_to_ceo" // envoyer une décision en validation
  | "validate_decision"; // valider / demander un complément / refuser une décision

export interface TransformationActor {
  role: TransformationRole;
  /** Le domaine (module) de l'expert — absent/ignoré pour les autres rôles. */
  domain?: ModuleName | null;
  /** True si l'acteur est le propriétaire du projet (toujours plein pouvoir, indépendamment du rôle). */
  isOwner?: boolean;
}

export interface TransformationActionContext {
  /** Le module concerné par l'action (ex. "decide" pour une édition dans Décider). Requis pour edit_data. */
  module?: ModuleName;
}

/**
 * Décide si `actor` peut effectuer `action` dans `context`.
 * Fonction pure, déterministe : mêmes entrées => même sortie.
 */
export function canPerform(actor: TransformationActor, action: TransformationAction, context: TransformationActionContext = {}): boolean {
  if (actor.isOwner) return true; // le propriétaire garde toujours tous les droits, quel que soit son rôle déclaré

  switch (actor.role) {
    case "consultant":
      // "modifie tout, envoie au CEO" — tout sauf valider la décision à sa place (ça, c'est le CEO).
      return action !== "validate_decision";

    case "client":
      // "modifie les données de son usine" — lecture/commentaire partout, mais une
      // édition n'est permise que dans le module Décider (le diagnostic de LEUR
      // usine) ; pas de gestion de l'équipe, pas de validation à leur place.
      if (action === "read" || action === "comment") return true;
      if (action === "edit_data") return context.module === "decide";
      return false;

    case "expert":
      // "consulte, commente, modifie son domaine" — édition seulement dans le
      // module qui correspond à son domaine déclaré.
      if (action === "read" || action === "comment") return true;
      if (action === "edit_data") return context.module !== undefined && context.module === actor.domain;
      return false;

    case "ceo":
      // "valide / demande un complément / refuse" — jamais d'édition de données,
      // jamais de gestion d'équipe ; lecture et commentaire oui (poser une question).
      if (action === "read" || action === "comment" || action === "validate_decision") return true;
      return false;

    default:
      return false;
  }
}

/** Liste les actions permises pour un acteur donné dans un contexte donné — pratique pour l'UI (griser un bouton plutôt que laisser l'API le refuser). */
export function allowedActions(actor: TransformationActor, context: TransformationActionContext = {}): TransformationAction[] {
  const all: TransformationAction[] = ["read", "comment", "edit_data", "manage_members", "send_to_ceo", "validate_decision"];
  return all.filter((action) => canPerform(actor, action, context));
}
