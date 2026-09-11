"use client";

import { useState, type FormEvent } from "react";
import { ECOSYSTEM_MEMBER_TYPES } from "@/lib/ecosystem-data";

type Status = "idle" | "submitting" | "success" | "error";

export function JoinForm() {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    try {
      const res = await fetch("/api/ecosystem/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, website, description, contact }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Une erreur est survenue.");
      setStatus("success");
      setName("");
      setType("");
      setWebsite("");
      setDescription("");
      setContact("");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Une erreur est survenue.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border border-success/30 bg-success/10 p-6 text-center">
        <p className="font-medium text-success">Merci pour ta contribution !</p>
        <p className="mt-1 text-sm text-ink">
          L&apos;entrée est déjà visible dans le répertoire et sera prise en compte dans les
          prochains matchings.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-4 text-sm font-medium text-success underline underline-offset-2"
        >
          Ajouter une autre entrée
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Nom *</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex : Acme Robotics"
          className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <div className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Type *</span>
        <div className="flex flex-wrap gap-2">
          {ECOSYSTEM_MEMBER_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                type === t
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-border bg-surface text-ink hover:border-accent/60"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          required
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="Ou tape un autre type..."
          className="mt-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Site web</span>
        <input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://..."
          className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Ce que fait l'organisation, ses domaines d'expertise..."
          className="resize-none rounded-lg border border-border bg-surface px-3 py-2.5 text-base leading-relaxed text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Contact</span>
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="email@exemple.com"
          className="rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>

      {status === "error" && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-1 rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-strong disabled:opacity-50"
      >
        {status === "submitting" ? "Envoi..." : "Rejoindre l'écosystème"}
      </button>
    </form>
  );
}
