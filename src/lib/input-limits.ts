// Bornes partagées sur les textes libres reçus par les routes API — surtout
// ceux réinjectés dans un prompt IA (coût, déni de service, surface
// d'injection). Une seule source de vérité au lieu de constantes recopiées.

// Texte extrait d'un document (cahier des charges, etc.) : généreux mais
// borné. Valeur reprise de deliver/document-start, sa première utilisation.
export const MAX_DOC_LENGTH = 20_000;

// Champ texte libre (note, message, description, feedback...).
export const MAX_FREE_TEXT_LENGTH = 4_000;

// Fichier envoyé pour extraction de texte (decide/extract-doc).
export const MAX_UPLOAD_BYTES = 5_000_000;
