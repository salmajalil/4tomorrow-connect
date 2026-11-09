import type { Language } from "@/types/database";

// Static legal page content (mentions légales / privacy / terms of use),
// kept out of src/lib/i18n/dictionary.ts on purpose: that file holds short
// UI strings reused across components, these are long, page-specific
// paragraphs read once.
//
// [EN MAJUSCULES ENTRE CROCHETS] = information réelle à fournir par
// l'entreprise avant mise en production — rien n'est inventé ici. Tant que
// ces champs ne sont pas remplis, ces pages ne doivent pas être présentées
// comme juridiquement complètes, et une relecture par un avocat/juriste est
// recommandée avant publication, en particulier pour la politique de
// confidentialité (transferts hors UE vers Anthropic) et les CGU.

export interface LegalSection {
  heading: string;
  body: string[];
}

export interface LegalPage {
  title: string;
  updated: string;
  intro?: string;
  sections: LegalSection[];
}

const fr = {
  mentions: {
    title: "Mentions légales",
    updated: "Dernière mise à jour : [DATE]",
    sections: [
      {
        heading: "Éditeur du site",
        body: [
          "Raison sociale : [RAISON SOCIALE À COMPLÉTER]",
          "Forme juridique : [FORME JURIDIQUE]",
          "Capital social : [CAPITAL SOCIAL]",
          "Siège social : [ADRESSE DU SIÈGE SOCIAL]",
          "SIRET / RCS : [NUMÉRO SIRET ET VILLE DU RCS]",
          "Directeur de la publication : [NOM DU DIRECTEUR DE PUBLICATION]",
          "Contact : [EMAIL DE CONTACT]",
        ],
      },
      {
        heading: "Hébergement",
        body: [
          "Le site et l'application sont hébergés par Vercel Inc. (États-Unis) — vercel.com/legal.",
          "La base de données et l'authentification sont hébergées par Supabase Inc. — supabase.com/privacy.",
        ],
      },
      {
        heading: "Propriété intellectuelle",
        body: [
          "L'ensemble des contenus, de la marque et du logiciel 4 Tomorrow Strategy est la propriété de [RAISON SOCIALE]. Toute reproduction ou réutilisation sans autorisation écrite préalable est interdite.",
        ],
      },
    ],
  },
  confidentialite: {
    title: "Politique de confidentialité",
    updated: "Dernière mise à jour : [DATE]",
    intro:
      "4 Tomorrow Strategy traite des données personnelles et des données d'entreprise confidentielles pour délivrer le service de diagnostic et de pilotage de transformation industrielle. Cette page décrit quelles données sont traitées, pourquoi, par qui, et les droits dont tu disposes.",
    sections: [
      {
        heading: "Données collectées",
        body: [
          "Compte : adresse e-mail, mot de passe (haché, jamais en clair).",
          "Données de projet : informations saisies sur ton organisation et tes transformations (diagnostics, objectifs, contraintes, documents de référence que tu importes).",
          "Équipe : adresse e-mail des personnes que tu invites sur un projet.",
          "Mise en relation : nom et e-mail renseignés lors d'une demande de rendez-vous avec un partenaire.",
        ],
      },
      {
        heading: "Finalités du traitement",
        body: [
          "Fournir le service (diagnostic, scénarios, suivi d'exécution, mise en relation avec des partenaires).",
          "Générer, à partir de tes données, des analyses et recommandations par intelligence artificielle — jamais de chiffre inventé : tout résultat chiffré est calculé par nos serveurs, l'IA ne fait que le mettre en mots.",
          "Sécurité du service (lutte contre les abus, quotas d'usage).",
        ],
      },
      {
        heading: "Sous-traitants et destinataires",
        body: [
          "Anthropic (traitement des requêtes d'intelligence artificielle, Claude API) — société basée aux États-Unis, hors Union européenne : [À COMPLÉTER — préciser le mécanisme de transfert, par ex. clauses contractuelles types].",
          "Supabase Inc. (base de données, authentification) — région d'hébergement : [RÉGION SUPABASE À PRÉCISER].",
          "Vercel Inc. (hébergement de l'application).",
          "Aucune donnée n'est vendue à un tiers.",
        ],
      },
      {
        heading: "Durée de conservation",
        body: [
          "Les données sont conservées tant que le compte existe. Elles sont supprimées, ainsi que l'ensemble des données des organisations que tu possèdes, lorsque tu supprimes ton compte depuis la page Mon compte.",
        ],
      },
      {
        heading: "Tes droits",
        body: [
          "Conformément au RGPD, tu disposes d'un droit d'accès, de rectification, d'effacement, de portabilité et d'opposition sur tes données.",
          "Le droit d'effacement peut être exercé directement depuis la page Mon compte (suppression définitive du compte).",
          "Pour toute autre demande : [EMAIL DE CONTACT DPO / RESPONSABLE DONNÉES].",
        ],
      },
    ],
  },
  cgu: {
    title: "Conditions générales d'utilisation",
    updated: "Dernière mise à jour : [DATE]",
    intro:
      "L'utilisation de 4 Tomorrow Strategy implique l'acceptation pleine et entière des présentes conditions générales d'utilisation (CGU).",
    sections: [
      {
        heading: "Objet",
        body: [
          "4 Tomorrow Strategy est une plateforme logicielle d'aide au diagnostic, à la décision et au pilotage de transformations stratégiques industrielles.",
        ],
      },
      {
        heading: "Compte utilisateur",
        body: [
          "L'accès à certaines fonctionnalités nécessite la création d'un compte. Tu es responsable de la confidentialité de tes identifiants et de toute activité réalisée depuis ton compte.",
        ],
      },
      {
        heading: "Contenus générés par intelligence artificielle",
        body: [
          "Certains contenus (analyses, recommandations, suggestions de partenaires ou de formations) sont générés avec l'assistance d'une intelligence artificielle. Tout résultat chiffré affiché par la plateforme est calculé de façon déterministe par nos serveurs — l'intelligence artificielle ne calcule jamais elle-même un chiffre présenté comme un résultat.",
          "Ces contenus sont des aides à la décision et ne constituent ni un conseil juridique, ni un conseil financier, ni un engagement contractuel de 4 Tomorrow Strategy. Les décisions finales relèvent de ta seule responsabilité.",
        ],
      },
      {
        heading: "Usage autorisé",
        body: [
          "Tu t'engages à ne pas utiliser la plateforme à des fins illégales, à ne pas tenter de contourner les mesures de sécurité, et à ne soumettre que des contenus que tu es autorisé à partager.",
        ],
      },
      {
        heading: "Propriété intellectuelle",
        body: [
          "Les données que tu saisis t'appartiennent. Le logiciel, la marque et la documentation 4 Tomorrow Strategy restent la propriété de [RAISON SOCIALE].",
        ],
      },
      {
        heading: "Responsabilité",
        body: [
          "4 Tomorrow Strategy met tout en œuvre pour assurer la disponibilité et la fiabilité du service, sans garantie de résultat. [RAISON SOCIALE] ne pourra être tenue responsable des décisions prises sur la base des analyses fournies par la plateforme.",
        ],
      },
      {
        heading: "Résiliation",
        body: [
          "Tu peux supprimer ton compte à tout moment depuis la page Mon compte. [RAISON SOCIALE] se réserve le droit de suspendre un compte en cas d'usage abusif des présentes CGU.",
        ],
      },
      {
        heading: "Droit applicable",
        body: ["Les présentes CGU sont soumises au droit [JURIDICTION À PRÉCISER]."],
      },
    ],
  },
} satisfies Record<"mentions" | "confidentialite" | "cgu", LegalPage>;

const en: typeof fr = {
  mentions: {
    title: "Legal notice",
    updated: "Last updated: [DATE]",
    sections: [
      {
        heading: "Publisher",
        body: [
          "Legal name: [LEGAL NAME TO COMPLETE]",
          "Legal form: [LEGAL FORM]",
          "Share capital: [SHARE CAPITAL]",
          "Registered office: [REGISTERED OFFICE ADDRESS]",
          "Registration number: [REGISTRATION NUMBER AND REGISTRY]",
          "Publication director: [PUBLICATION DIRECTOR NAME]",
          "Contact: [CONTACT EMAIL]",
        ],
      },
      {
        heading: "Hosting",
        body: [
          "The site and application are hosted by Vercel Inc. (United States) — vercel.com/legal.",
          "The database and authentication are hosted by Supabase Inc. — supabase.com/privacy.",
        ],
      },
      {
        heading: "Intellectual property",
        body: [
          "All content, the brand and the 4 Tomorrow Strategy software are the property of [LEGAL NAME]. Any reproduction or reuse without prior written authorization is prohibited.",
        ],
      },
    ],
  },
  confidentialite: {
    title: "Privacy policy",
    updated: "Last updated: [DATE]",
    intro:
      "4 Tomorrow Strategy processes personal data and confidential company data to deliver its industrial strategic transformation diagnostic and steering service. This page describes what data is processed, why, by whom, and your rights.",
    sections: [
      {
        heading: "Data collected",
        body: [
          "Account: email address, password (hashed, never stored in clear text).",
          "Project data: information you enter about your organization and transformations (diagnostics, objectives, constraints, reference documents you import).",
          "Team: email address of people you invite to a project.",
          "Partner matching: name and email entered when requesting a meeting with a partner.",
        ],
      },
      {
        heading: "Purposes of processing",
        body: [
          "Provide the service (diagnostic, scenarios, execution tracking, matching with partners).",
          "Generate analyses and recommendations from your data using artificial intelligence — never an invented figure: every computed figure is calculated by our servers, the AI only puts it into words.",
          "Service security (abuse prevention, usage quotas).",
        ],
      },
      {
        heading: "Processors and recipients",
        body: [
          "Anthropic (AI request processing, Claude API) — company based in the United States, outside the European Union: [TO COMPLETE — specify the transfer mechanism, e.g. standard contractual clauses].",
          "Supabase Inc. (database, authentication) — hosting region: [SUPABASE REGION TO SPECIFY].",
          "Vercel Inc. (application hosting).",
          "No data is sold to a third party.",
        ],
      },
      {
        heading: "Retention period",
        body: [
          "Data is kept for as long as the account exists. It is deleted, along with all data of the organizations you own, when you delete your account from the My Account page.",
        ],
      },
      {
        heading: "Your rights",
        body: [
          "Under GDPR, you have the right to access, rectify, erase, port and object to your data.",
          "The right to erasure can be exercised directly from the My Account page (permanent account deletion).",
          "For any other request: [DATA PROTECTION CONTACT EMAIL].",
        ],
      },
    ],
  },
  cgu: {
    title: "Terms of Use",
    updated: "Last updated: [DATE]",
    intro: "Using 4 Tomorrow Strategy implies full acceptance of these Terms of Use.",
    sections: [
      {
        heading: "Purpose",
        body: [
          "4 Tomorrow Strategy is a software platform assisting with the diagnostic, decision-making and steering of industrial strategic transformations.",
        ],
      },
      {
        heading: "User account",
        body: [
          "Access to some features requires creating an account. You are responsible for keeping your credentials confidential and for any activity carried out from your account.",
        ],
      },
      {
        heading: "AI-generated content",
        body: [
          "Some content (analyses, recommendations, partner or training suggestions) is generated with the assistance of artificial intelligence. Every computed figure shown by the platform is calculated deterministically by our servers — the AI never itself computes a figure presented as a result.",
          "This content is a decision aid and does not constitute legal advice, financial advice, or a contractual commitment from 4 Tomorrow Strategy. Final decisions remain your sole responsibility.",
        ],
      },
      {
        heading: "Permitted use",
        body: [
          "You agree not to use the platform for illegal purposes, not to attempt to bypass security measures, and to only submit content you are authorized to share.",
        ],
      },
      {
        heading: "Intellectual property",
        body: [
          "The data you enter belongs to you. The 4 Tomorrow Strategy software, brand and documentation remain the property of [LEGAL NAME].",
        ],
      },
      {
        heading: "Liability",
        body: [
          "4 Tomorrow Strategy makes every effort to ensure the service's availability and reliability, without guarantee of result. [LEGAL NAME] cannot be held liable for decisions made based on the analyses provided by the platform.",
        ],
      },
      {
        heading: "Termination",
        body: [
          "You can delete your account at any time from the My Account page. [LEGAL NAME] reserves the right to suspend an account in case of abusive use of these Terms.",
        ],
      },
      {
        heading: "Governing law",
        body: ["These Terms are governed by [JURISDICTION TO SPECIFY] law."],
      },
    ],
  },
};

export function getLegalContent(language: Language) {
  return language === "en" ? en : fr;
}
