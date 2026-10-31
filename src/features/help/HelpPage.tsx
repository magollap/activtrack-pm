import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUp, BookOpen, Lightbulb, Search, X } from 'lucide-react';
import { ALL_SECTIONS, HELP, type HelpSection, type HelpTopic } from './helpContent';

/** Renders **bold** spans inside help text. */
function Rich({ text }: { text: string }) {
  const parts = text.split('**');
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i} className="font-semibold text-slate-900 dark:text-white">{part}</strong> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  );
}

const topicText = (t: HelpTopic) => [t.heading, t.text, t.tip, ...(t.steps ?? []), ...(t.bullets ?? [])].join(' ').toLowerCase();

function scrollToSection(id: string, smooth = true) {
  document.getElementById(id)?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
}

function Topic({ topic }: { topic: HelpTopic }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{topic.heading}</h3>
      {topic.text && <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300"><Rich text={topic.text} /></p>}
      {topic.steps && (
        <ol className="space-y-2">
          {topic.steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-brand-contrast dark:bg-brand-500">{i + 1}</span>
              <span><Rich text={step} /></span>
            </li>
          ))}
        </ol>
      )}
      {topic.bullets && (
        <ul className="space-y-1.5">
          {topic.bullets.map((b, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
              <span><Rich text={b} /></span>
            </li>
          ))}
        </ul>
      )}
      {topic.tip && (
        <p className="flex gap-2 rounded-lg border border-gold-300/60 bg-gold-50 px-3 py-2 text-sm leading-relaxed text-slate-700 dark:border-gold-500/30 dark:bg-gold-500/10 dark:text-slate-200">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-gold-600 dark:text-gold-400" />
          <span><Rich text={topic.tip} /></span>
        </p>
      )}
    </div>
  );
}

function SectionCard({ section, topics }: { section: HelpSection; topics: HelpTopic[] }) {
  const Icon = section.icon;
  return (
    <section id={section.id} className="card scroll-mt-6 p-5 sm:p-6">
      <header className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-gold-500/10 dark:text-gold-400">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{section.summary}</p>
        </div>
      </header>
      <div className="space-y-6">
        {topics.map((t) => <Topic key={t.heading} topic={t} />)}
      </div>
      <button
        type="button"
        onClick={() => document.getElementById('help-top')?.scrollIntoView({ behavior: 'smooth' })}
        className="mt-6 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
      >
        <ArrowUp className="h-3 w-3" /> Back to contents
      </button>
    </section>
  );
}

const POPULAR = ['create-cards', 'workflow', 'automations', 'ai-assistant', 'views', 'status-updates'];

/** Help center: a linked table of contents and step-by-step guides for every feature. */
export function HelpPage() {
  const { hash } = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string>(ALL_SECTIONS[0].id);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      HELP.map((group) => ({
        ...group,
        sections: group.sections
          .map((section) => {
            const sectionHit = !q || `${section.title} ${section.summary}`.toLowerCase().includes(q);
            const topics = sectionHit ? section.topics : section.topics.filter((t) => topicText(t).includes(q));
            return { section, topics };
          })
          .filter((s) => s.topics.length > 0),
      })).filter((g) => g.sections.length > 0),
    [q],
  );

  const go = (id: string) => {
    navigate({ hash: id }, { replace: true });
    scrollToSection(id);
  };

  // Deep links such as /help#automations open on that section.
  useEffect(() => {
    const id = hash.slice(1);
    if (id) window.setTimeout(() => scrollToSection(id, false), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Highlight the section being read in the contents.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '0px 0px -70% 0px' },
    );
    ALL_SECTIONS.forEach((s) => { const el = document.getElementById(s.id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [filtered]);

  const contents = (label: string): ReactNode => (
    <nav aria-label={label} className="space-y-4">
      {filtered.map((group) => (
        <div key={group.title}>
          <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.title}</p>
          <ul className="space-y-0.5">
            {group.sections.map(({ section }) => {
              const Icon = section.icon;
              const on = active === section.id;
              return (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    onClick={(e) => { e.preventDefault(); go(section.id); }}
                    aria-current={on ? 'true' : undefined}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                      on
                        ? 'bg-brand-50 font-medium text-brand-800 dark:bg-gold-500/10 dark:text-gold-300'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-70" /> {section.title}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div id="help-top" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><BookOpen className="h-6 w-6 text-brand-600 dark:text-gold-400" /> Help center</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Step-by-step guides for everything in ActivTrack. Click a topic to jump to it.</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9 pr-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help, e.g. workflow, timer"
            aria-label="Search help"
          />
          {query && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700" onClick={() => setQuery('')} aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {!q && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {POPULAR.map((id) => {
            const s = ALL_SECTIONS.find((x) => x.id === id);
            if (!s) return null;
            const Icon = s.icon;
            return (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => { e.preventDefault(); go(id); }}
                className="card group flex items-start gap-3 p-4 transition-shadow hover:shadow-md"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-50 text-gold-700 dark:bg-gold-500/10 dark:text-gold-400"><Icon className="h-4 w-4" /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold group-hover:text-brand-700 dark:group-hover:text-gold-300">{s.title}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{s.summary}</span>
                </span>
              </a>
            );
          })}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
        <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-8rem)] lg:self-start lg:overflow-y-auto">
          <details className="card p-3 lg:hidden">
            <summary className="cursor-pointer text-sm font-medium">Contents</summary>
            <div className="mt-3">{contents('Help contents (compact)')}</div>
          </details>
          <div className="hidden lg:block">{contents('Help contents')}</div>
        </aside>

        <div className="min-w-0 space-y-6">
          {filtered.length === 0 && (
            <div className="card p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Nothing matches "{query}". Try a simpler word such as <button className="underline" onClick={() => setQuery('card')}>card</button> or <button className="underline" onClick={() => setQuery('status')}>status</button>.
            </div>
          )}
          {filtered.map((group) => (
            <div key={group.title} className="space-y-6">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{group.title}</h2>
              {group.sections.map(({ section, topics }) => <SectionCard key={section.id} section={section} topics={topics} />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
