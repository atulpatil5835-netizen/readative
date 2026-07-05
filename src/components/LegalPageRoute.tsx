import {
  CONTACT_EMAIL,
  EFFECTIVE_DATE,
  LEGAL_PAGES,
  PAGE_ORDER,
  type LegalLink,
  type LegalOfficialLinks,
  type LegalSection,
  type LegalSlug,
} from "../content/legalPages";

export function LegalPageRoute({ slug }: { slug: LegalSlug }) {
  const page = LEGAL_PAGES[slug];

  return (
    <article className="space-y-4" data-legal-route={slug}>
      <header className="readative-panel-surface overflow-hidden px-5 py-7 sm:px-8 sm:py-10">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
          {page.eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
          {page.title}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          {page.description}
        </p>
        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
          <span>Effective {EFFECTIVE_DATE}</span>
          <a className="text-emerald-700 underline-offset-4 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </p>
      </header>

      {page.sections.map((section) => (
        <LegalSectionCard key={`${slug}-${section.id || section.title}`} section={section} />
      ))}

      {page.projects?.length ? (
        <section className="readative-panel-surface px-5 py-6 sm:px-8">
          <h2 className="text-xl font-black tracking-tight text-slate-950">Project lifecycle</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {page.projects.map((project) => (
              <article key={project.name} className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-600">
                  {project.status}
                </p>
                <h3 className="mt-2 text-lg font-black text-slate-950">{project.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{project.description}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-600">
                  <div>
                    <dt className="font-black text-slate-900">Status</dt>
                    <dd className="mt-1">{project.status}</dd>
                  </div>
                  <div>
                    <dt className="font-black text-slate-900">Category</dt>
                    <dd className="mt-1">{project.category}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="font-black text-slate-900">Current Stage</dt>
                    <dd className="mt-1">{project.currentStage}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <nav className="readative-panel-surface px-5 py-6 sm:px-8" aria-label="Readative policies">
        <h2 className="text-xl font-black tracking-tight text-slate-950">
          Readative information and policies
        </h2>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-3">
          {PAGE_ORDER.filter((legalSlug) => legalSlug !== slug).map((legalSlug) => (
            <a
              key={legalSlug}
              href={`/${legalSlug}`}
              className="text-sm font-bold text-emerald-700 underline-offset-4 hover:underline"
            >
              {LEGAL_PAGES[legalSlug].title}
            </a>
          ))}
        </div>
      </nav>
    </article>
  );
}

function LegalSectionCard({ section }: { section: LegalSection }) {
  return (
    <section id={section.id} className="readative-panel-surface px-5 py-6 sm:px-8">
      <h2 className="text-xl font-black tracking-tight text-slate-950">{section.title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600 sm:text-base">
        {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
      {section.items?.length ? (
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-600 sm:text-base">
          {section.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : null}
      {section.links?.length ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {section.links.map((link) => <LegalLinkCard key={`${link.href}-${link.label}`} link={link} />)}
        </div>
      ) : null}
      {section.officialLinks ? <OfficialLinks officialLinks={section.officialLinks} /> : null}
    </section>
  );
}

function LegalLinkCard({ link }: { link: LegalLink }) {
  const external = /^https?:\/\//i.test(link.href);

  return (
    <a
      href={link.href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-emerald-200 hover:bg-emerald-50/40"
    >
      <h3 className="font-black text-slate-950">{link.label}</h3>
      {link.description ? <p className="mt-1 text-sm leading-6 text-slate-600">{link.description}</p> : null}
    </a>
  );
}

function OfficialLinks({ officialLinks }: { officialLinks: LegalOfficialLinks }) {
  return (
    <div className="mt-6">
      <h3 className="font-black text-slate-950">{officialLinks.heading}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {officialLinks.links.map((link) => {
          const external = /^https?:\/\//i.test(link.href);

          return (
            <a
              key={`${link.kind}-${link.href}`}
              href={link.href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-emerald-200 hover:bg-emerald-50/40"
            >
              {link.kind === "linkedin" ? <LinkedInIcon /> : null}
              <span className="min-w-0">
                <span className="block text-xs font-black uppercase tracking-[0.16em] text-emerald-600">
                  {link.label}
                </span>
                <strong className="mt-1 block break-words text-sm text-slate-950">{link.name}</strong>
              </span>
            </a>
          );
        })}

        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-600">
            {officialLinks.support.title}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{officialLinks.support.description}</p>
          <a
            href={officialLinks.support.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-emerald-800"
          >
            {officialLinks.support.label}
          </a>
        </article>
      </div>
    </div>
  );
}

function LinkedInIcon() {
  return (
    <span className="inline-flex shrink-0 text-[#0A66C2]" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M5.4 3.8a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4ZM3.5 9.8h3.8v10.7H3.5V9.8Zm6.1 0h3.6v1.5h.1c.5-.9 1.7-1.9 3.5-1.9 3.8 0 4.5 2.5 4.5 5.7v5.4h-3.8v-4.8c0-1.1 0-2.7-1.8-2.7s-2.1 1.3-2.1 2.6v4.9H9.8V9.8Z" />
      </svg>
    </span>
  );
}
