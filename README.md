# 4 Tomorrow — Connect

Plateforme de transformation industrielle, module **CONNECT** : trouve des
technologies, startups, experts et partenaires réels pour ton projet de
transformation, avec un matching IA qui cite ses sources.

Fondation partagée (Next.js App Router + Supabase) pensée pour accueillir les
trois autres modules (DECIDE, DELIVER, LEARN) sans réécriture. Le schéma de
données prépare déjà DECIDE (`trajectories`, `risks`) — ce module sera
construit dans une session dédiée séparée.

## Stack

- **Frontend** : Next.js (App Router) + React + Tailwind CSS
- **Backend** : API routes Next.js — aucun serveur séparé
- **Base de données** : Supabase (Postgres + Auth), Row Level Security activée
- **IA** : API Anthropic (`claude-sonnet-4-6` par défaut), appelée uniquement
  depuis le serveur, avec l'outil `web_search` activé
- **Déploiement cible** : Vercel

## 1. Prérequis — appliquer le schéma Supabase

**À faire avant tout le reste : le schéma n'est pas encore appliqué sur le
projet Supabase fourni** (`crqbukrebsribweqqnfo`) — je n'ai pas de clé
`service_role` ni d'accès CLI Supabase authentifié dans cette session pour le
faire moi-même. Pour l'appliquer :

1. Ouvre le [SQL Editor du projet Supabase](https://supabase.com/dashboard/project/crqbukrebsribweqqnfo/sql/new).
2. Colle le contenu de [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql) et exécute-le.
3. Vérifie dans **Authentication > Providers** que Email est activé (c'est déjà le cas sur ce projet), et dans **Authentication > URL Configuration** ajoute l'URL de ton déploiement Vercel (et `http://localhost:3000` en dev) aux **Redirect URLs**, nécessaire pour le lien magique et la confirmation d'inscription.

Une fois lié à la CLI Supabase, les migrations suivantes peuvent être
appliquées avec `supabase db push`.

## 2. Variables d'environnement

Copie `.env.local.example` vers `.env.local` et remplis :

```
NEXT_PUBLIC_SUPABASE_URL=https://crqbukrebsribweqqnfo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
ANTHROPIC_API_KEY=sk-ant-...       # jamais préfixé NEXT_PUBLIC_, jamais exposé au client
```

`ANTHROPIC_API_KEY` n'est lu que dans `src/lib/anthropic.ts`, importé avec
`server-only` — toute tentative de l'importer depuis un composant client fait
échouer le build plutôt que de risquer une fuite.

## 3. Lancer en local

```bash
npm install
npm run dev
```

## 4. Déployer sur Vercel

Cette session n'a pas d'accès Vercel authentifié pour déployer à ta place.
Étapes à faire côté toi :

1. Sur [vercel.com/new](https://vercel.com/new), importe ce repo GitHub
   (`salmajalil/4tomorrow-connect`, branche `claude/4tomorrow-foundation-connect-hrd7lt` ou `main` une fois mergée).
2. Dans **Project Settings > Environment Variables**, ajoute les 3 variables
   ci-dessus (Production + Preview). `ANTHROPIC_API_KEY` doit être marquée
   comme variable serveur uniquement — Vercel ne l'expose au client que si tu
   la préfixes toi-même `NEXT_PUBLIC_`, donc ne le fais pas.
3. Déploie. Une fois l'URL obtenue, ajoute-la aux **Redirect URLs** Supabase
   (étape 1.3 ci-dessus), sinon les liens magiques redirigeront vers
   `localhost`.

## Décisions de conception notables

- **Auth requise pour Connect et pour "Join the ecosystem"** : le schéma
  demandé restreint `transformations`/`gaps`/etc. par utilisateur via RLS, et
  `ecosystem_members` est ouvert en lecture/écriture aux utilisateurs
  *authentifiés* (pas anonymes). Le point d'entrée `/connect` et
  `/ecosystem/join` redirigent donc vers `/login` si non connecté — c'est ce
  qui permet de garder le matching à moins de 3 clics une fois connecté, sans
  clé `service_role` ni accès élargi.
- **Une organisation par utilisateur**, créée à la volée au premier matching
  (son `industry` est mise à jour à chaque run). Un modèle multi-organisation
  par utilisateur n'est pas dans le scope d'aujourd'hui.
- **`gaps` est rempli par Connect lui-même** (2-4 gaps extraits par le modèle
  à partir de la description libre), en l'absence de DECIDE aujourd'hui —
  chaque match doit obligatoirement en citer un. Ces lignes resteront
  exploitables telles quelles quand DECIDE sera construit.
- **Répertoire vivant** (contribution ouverte → réinjection en contexte →
  distinction de source `registry`/`web_search`) : documenté en détail dans
  `src/lib/matching.ts` au-dessus de `buildSystemPrompt()`, pour une revue de
  propriété intellectuelle ultérieure.

## Ce qui reste à faire côté toi

- [ ] Appliquer `supabase/migrations/0001_init.sql` (section 1) — **sans ça,
      l'app ne fonctionnera pas**, `ecosystem_members`/`organizations`/etc.
      n'existent pas encore sur le projet Supabase fourni.
- [ ] Renseigner `ANTHROPIC_API_KEY` (jamais fourni à cette session).
- [ ] Déployer sur Vercel et ajouter l'URL obtenue aux Redirect URLs Supabase.
- [ ] Tester sur mobile réel une fois déployé.

Cette session n'avait accès ni à une clé `service_role` / CLI Supabase, ni à
un compte Vercel, ni à une clé API Anthropic — uniquement l'URL et la clé
publique Supabase fournies dans le brief. Le code est prêt et testé
(`npm run build`, `tsc`, `eslint` passent tous en local) ; les 4 points
ci-dessus sont les seuls qui requièrent tes propres identifiants.
