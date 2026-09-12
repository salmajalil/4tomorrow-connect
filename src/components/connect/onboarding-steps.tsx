"use client";

import { useState } from "react";
import { INDUSTRIES, PARTNER_TYPES } from "@/lib/onboarding-data";
import { useLanguage } from "@/components/language-provider";

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
  const { t } = useLanguage();
  const onboarding = t.connect.onboarding;
  const [customValue, setCustomValue] = useState(
    value && !INDUSTRIES.some((i) => i.value === value) ? value : ""
  );
  const isCustomSelected = value !== "" && !INDUSTRIES.some((i) => i.value === value);

  return (
    <div>
      <h2 className="font-display text-3xl text-ink">{onboarding.industryTitle}</h2>
      <p className="mt-1 text-sm text-muted">{onboarding.industrySubtitle}</p>

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
        <span className="font-medium text-ink">{onboarding.industryOtherLabel}</span>
        <input
          type="text"
          value={customValue}
          onChange={(e) => {
            setCustomValue(e.target.value);
            onChange(e.target.value);
          }}
          placeholder={onboarding.industryOtherPlaceholder}
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
  const { t } = useLanguage();
  const onboarding = t.connect.onboarding;
  const [customType, setCustomType] = useState("");
  const extraTypes = value.filter((type) => !PARTNER_TYPES.includes(type));

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
      <h2 className="font-display text-3xl text-ink">{onboarding.partnerTypesTitle}</h2>
      <p className="mt-1 text-sm text-muted">{onboarding.partnerTypesSubtitle}</p>

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
          placeholder={onboarding.partnerTypesAddPlaceholder}
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={addCustom}
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-ink hover:border-accent/60"
        >
          {onboarding.add}
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
  const { t } = useLanguage();
  const onboarding = t.connect.onboarding;
  const [customLocation, setCustomLocation] = useState(
    location && !onboarding.locations.includes(location) ? location : ""
  );

  return (
    <div>
      <h2 className="font-display text-3xl text-ink">{onboarding.contextTitle}</h2>
      <p className="mt-1 text-sm text-muted">{onboarding.contextSubtitle}</p>

      <div className="mt-5 flex flex-col gap-6">
        <div>
          <span className="text-sm font-medium text-ink">{onboarding.locationLabel}</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {onboarding.locations.map((loc) => {
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
            placeholder={onboarding.locationPlaceholder}
            className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">{onboarding.budgetLabel}</span>
          <input
            type="text"
            value={budget}
            onChange={(e) => onChangeBudget(e.target.value)}
            placeholder={onboarding.budgetPlaceholder}
            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">{onboarding.co2Label}</span>
          <input
            type="text"
            value={co2Target}
            onChange={(e) => onChangeCo2Target(e.target.value)}
            placeholder={onboarding.co2Placeholder}
            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <span className="text-xs text-muted">{onboarding.co2Hint}</span>
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
  const { t } = useLanguage();
  const onboarding = t.connect.onboarding;

  return (
    <div>
      <h2 className="font-display text-3xl text-ink">{onboarding.descriptionTitle}</h2>
      <p className="mt-1 text-sm text-muted">{onboarding.descriptionSubtitle}</p>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={onboarding.descriptionPlaceholder}
        rows={8}
        className="mt-5 w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-3 text-base leading-relaxed text-ink placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <p className="mt-2 text-right text-xs text-muted">
        {value.length} {t.common.characters}
      </p>
    </div>
  );
}

export function ReviewStep({ state }: { state: OnboardingState }) {
  const { t } = useLanguage();
  const onboarding = t.connect.onboarding;

  return (
    <div>
      <h2 className="font-display text-3xl text-ink">{onboarding.reviewTitle}</h2>
      <p className="mt-1 text-sm text-muted">{onboarding.reviewSubtitle}</p>

      <dl className="mt-5 flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">{onboarding.reviewIndustry}</dt>
          <dd className="mt-0.5 text-sm text-ink">{state.industry || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">{onboarding.reviewPartners}</dt>
          <dd className="mt-0.5 text-sm text-ink">
            {state.partnerTypes.length > 0 ? state.partnerTypes.join(", ") : t.common.notSpecified}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">{onboarding.reviewZoneBudgetCo2}</dt>
          <dd className="mt-0.5 text-sm text-ink">
            {[state.location, state.budget, state.co2Target].filter(Boolean).join(" · ") ||
              t.common.notSpecified}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">{onboarding.reviewProject}</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-sm text-ink">
            {state.description || t.common.notSpecified}
          </dd>
        </div>
      </dl>
    </div>
  );
}
