import type { LegalPage } from "@/lib/legal-content";

export function LegalPageView({ page }: { page: LegalPage }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <h1 className="font-display text-2xl text-ink sm:text-3xl">{page.title}</h1>
      <p className="mt-1 text-xs text-muted">{page.updated}</p>
      {page.intro && <p className="mt-4 text-sm text-body">{page.intro}</p>}
      <div className="mt-8 flex flex-col gap-6">
        {page.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-display text-lg text-ink">{section.heading}</h2>
            <div className="mt-2 flex flex-col gap-1.5">
              {section.body.map((paragraph, i) => (
                <p key={i} className="text-sm leading-relaxed text-body">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
