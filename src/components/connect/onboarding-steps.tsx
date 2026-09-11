"use client";

import { useState } from "react";
import { INDUSTRIES, PARTNER_TYPES, LOCATIONS, DESCRIPTION_PLACEHOLDER } from "@/lib/onboarding-data";

export interface OnboardingState {
  industry: string;
  partnerTypes: string[];
  location: string;
  budget: string;
  co2Target: string;
  description: string;
}

export function IndustryStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (industry: string) => void;
}) {
  const [customValue, setCustomValue] = useState(
    value && !INDUSTRIES.some((i) => i.value === value) ? value : ""
  );
  const isCustomSelected = value !== "" && !INDUSTRIES.some((i) => i.value === value);

  return (
    <div>
      <h2 className="font-display text-3xl tracking-wide text-ink">Quelle est ton industrie ?</h2>
      <p className="mt-1 text-sm text-muted">Choisis la tuile la plus proche de ton secteur.</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {INDUSTRIES.map((industry) => {
          const selected = value === industry.value;
          return (
            <button
              key={industry.value}
              type="button"
              onClick={() => {
                setCustomValue("");
                onChange(industry.value);
              }}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition ${
                selected
                  ? "border-accent bg-accent text-accent-ink shadow-[0_0_0_1px_var(--accent)]"
                  : "border-border bg-surface text-ink hover:border-accent/60"
              }`}
            >
              <span className="text-2xl">{industry.icon}</span>
              <span className="text-sm font-medium">{industry.label}</span>
            </button>
          );
        })}
      </div>

      <label className="mt-4 flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Ton secteur n&apos;est pas dans la liste ?</span>
        <input
          type="text"
          value={customValue}
          onChange={(e) => {
            setCustomValue(e.target.value);
            onChange(e.target.value);
          }}
          placeholder="Ou tape ta propre industrie..."
          className={`rounded-lg border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:outline-none ${
            isCustomSelected ? "border-accent ring-1 ring-accent" : "border-border focus:border-accent"
          }`}
        />
      </label>
    </div>
  );
}

export function PartnerTypesStep({
  value,
  onChange,
}: {
  value: string[];
  onChange: (types: string[]) => void;
}) {
  const [customType, setCustomType] = useState("");
  const extraTypes = value.filter((t) => !PARTNER_TYPES.includes(t));

  function toggle(type: string) {
    onChange(value.includes(type) ? value.filter((t) => t !== type) : [...value, type]);
  }

  function addCustom() {
    const trimmed = customType.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setCustomType("");
  }

  return (
    <div>
      <h2 className="font-display text-3xl tracking-wide text-ink">
        Quels types de partenaires recherches-tu ?
      </h2>
      <p className="mt-1 text-sm text-muted">
        Sélectionne-en autant que tu veux — cette étape est optionnelle.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {[...PARTNER_TYPES, ...extraTypes].map((type) => {
          const selected = value.includes(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggle(type)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                selected
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-border bg-surface text-ink hover:border-accent/60"
              }`}
            >
              {type}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={customType}
          onChange={(e) => setCustomType(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Ajouter un autre type de partenaire..."
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={addCustom}
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-ink hover:border-accent/60"
        >
          Ajouter
        </button>
      </div>
    </div>
  );
}

export function ContextStep({
  location,
  budget,
  co2Target,
  onChangeLocation,
  onChangeBudget,
  onChangeCo2Target,
}: {
  location: string;
  budget: string;
  co2Target: string;
  onChangeLocation: (location: string) => void;
  onChangeBudget: (budget: string) => void;
  onChangeCo2Target: (co2Target: string) => void;
}) {
  const [customLocation, setCustomLocation] = useState(
    location && !LOCATIONS.includes(location) ? location : ""
  );

  return (
    <div>
      <h2 className="font-display text-3xl tracking-wide text-ink">Zone et objectifs (optionnel)</h2>
      <p className="mt-1 text-sm text-muted">
        Aide le moteur à cibler des partenaires pertinents — rien de tout ça n&apos;est obligatoire.
      </p>

      <div className="mt-5 flex flex-col gap-6">
        <div>
          <span className="text-sm font-medium text-ink">Où cherches-tu des partenaires ?</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {LOCATIONS.map((loc) => {
              const selected = location === loc;
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => {
                    setCustomLocation("");
                    onChangeLocation(loc);
                  }}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    selected
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-border bg-surface text-ink hover:border-accent/60"
                  }`}
                >
                  {loc}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={customLocation}
            onChange={(e) => {
              setCustomLocation(e.target.value);
              onChangeLocation(e.target.value);
            }}
            placeholder="Ou précise une région/un pays..."
            className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Budget approximatif de la transformation</span>
          <input
            type="text"
            value={budget}
            onChange={(e) => onChangeBudget(e.target.value)}
            placeholder="Ex : 500K€ - 1M€, ou « pas encore défini »"
            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Objectif de réduction CO2 (si tu en as un)</span>
          <input
            type="text"
            value={co2Target}
            onChange={(e) => onChangeCo2Target(e.target.value)}
            placeholder="Ex : -30% d'ici 2027, ou « pas de cible chiffrée »"
            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <span className="text-xs text-muted">
            Sert de contexte pour la recherche — le calcul d&apos;impact chiffré arrivera avec le
            module DECIDE.
          </span>
        </label>
      </div>
    </div>
  );
}

export function DescriptionStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (description: string) => void;
}) {
  return (
    <div>
      <h2 className="font-display text-3xl tracking-wide text-ink">Décris ton projet</h2>
      <p className="mt-1 text-sm text-muted">
        Optionnelle mais encouragée — plus tu détailles, plus le matching est puissant.
      </p>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={DESCRIPTION_PLACEHOLDER}
        rows={8}
        className="mt-5 w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-3 text-base leading-relaxed text-ink placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <p className="mt-2 text-right text-xs text-muted">{value.length} caractères</p>
    </div>
  );
}

export function ReviewStep({ state }: { state: OnboardingState }) {
  return (
    <div>
      <h2 className="font-display text-3xl tracking-wide text-ink">Prêt à lancer le matching ?</h2>
      <p className="mt-1 text-sm text-muted">
        Vérifie ton projet — la recherche peut prendre 1 à 2 minutes.
      </p>

      <dl className="mt-5 flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">Industrie</dt>
          <dd className="mt-0.5 text-sm text-ink">{state.industry || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">
            Partenaires recherchés
          </dt>
          <dd className="mt-0.5 text-sm text-ink">
            {state.partnerTypes.length > 0 ? state.partnerTypes.join(", ") : "Non précisé"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">Zone / Budget / CO2</dt>
          <dd className="mt-0.5 text-sm text-ink">
            {[state.location, state.budget, state.co2Target].filter(Boolean).join(" · ") ||
              "Non précisé"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">Projet</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-sm text-ink">
            {state.description || "Non précisé"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
