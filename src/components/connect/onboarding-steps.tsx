"use client";

import { useState } from "react";
import { INDUSTRIES, PARTNER_TYPES, DESCRIPTION_PLACEHOLDER } from "@/lib/onboarding-data";

export interface OnboardingState {
  industry: string;
  partnerTypes: string[];
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
      <h2 className="text-xl font-semibold text-neutral-900">Quelle est ton industrie ?</h2>
      <p className="mt-1 text-sm text-neutral-500">Choisis la tuile la plus proche de ton secteur.</p>

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
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
              }`}
            >
              <span className="text-2xl">{industry.icon}</span>
              <span className="text-sm font-medium">{industry.label}</span>
            </button>
          );
        })}
      </div>

      <label className="mt-4 flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-neutral-700">
          Ton secteur n&apos;est pas dans la liste ?
        </span>
        <input
          type="text"
          value={customValue}
          onChange={(e) => {
            setCustomValue(e.target.value);
            onChange(e.target.value);
          }}
          placeholder="Ou tape ta propre industrie..."
          className={`rounded-lg border px-3 py-2.5 text-base focus:outline-none ${
            isCustomSelected
              ? "border-neutral-900 ring-1 ring-neutral-900"
              : "border-neutral-300 focus:border-neutral-900"
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
      <h2 className="text-xl font-semibold text-neutral-900">
        Quels types de partenaires recherches-tu ?
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
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
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
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
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2.5 text-base focus:border-neutral-900 focus:outline-none"
        />
        <button
          type="button"
          onClick={addCustom}
          className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:border-neutral-400"
        >
          Ajouter
        </button>
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
      <h2 className="text-xl font-semibold text-neutral-900">Décris ton projet</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Optionnelle mais encouragée — plus tu détailles, plus le matching est puissant.
      </p>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={DESCRIPTION_PLACEHOLDER}
        rows={8}
        className="mt-5 w-full resize-none rounded-xl border border-neutral-300 px-3.5 py-3 text-base leading-relaxed focus:border-neutral-900 focus:outline-none"
      />
      <p className="mt-2 text-right text-xs text-neutral-400">{value.length} caractères</p>
    </div>
  );
}

export function ReviewStep({ state }: { state: OnboardingState }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-neutral-900">Prêt à lancer le matching ?</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Vérifie ton projet — la recherche peut prendre 5 à 15 secondes.
      </p>

      <dl className="mt-5 flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Industrie</dt>
          <dd className="mt-0.5 text-sm text-neutral-900">{state.industry || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Partenaires recherchés
          </dt>
          <dd className="mt-0.5 text-sm text-neutral-900">
            {state.partnerTypes.length > 0 ? state.partnerTypes.join(", ") : "Non précisé"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">Projet</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-sm text-neutral-900">
            {state.description || "Non précisé"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
