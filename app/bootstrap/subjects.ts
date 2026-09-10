/**
 * Which level teaches which subject — the join `OQ-RESULT-2` asked for.
 *
 * The exam result names a subject with **the same string the map draws as that
 * level's subject line** (`level.<id>.subtitle`), because writing a second set
 * of ten subject names is how two screens end up calling one chapter two things
 * (`TN-RESULT`, "where a subject's name comes from"). To do that it needs to get
 * from a `SubjectId` on a saved answer — `government`, `justice` — to the level
 * whose copy row names it, and nothing in `content/` goes that way: a level
 * document carries a subject, and no index carries the reverse.
 *
 * This is that index, and it is derived rather than written. Every
 * `content/levels/*.json` declares `subject`; the file name is the level id (the
 * schema defines `levelId` as naming `content/levels/<id>.json`), so the glob's
 * key is the other half. Nobody maintains a list, and a seventh level document
 * joins the index by existing — the same property that makes
 * `app/adapters/phaser/level-catalog.ts` able to add a level with no code.
 *
 * ## Why here, and why lazy
 *
 * Here, because the composition root is the only layer allowed to name a
 * concrete (`ADR-0005`) and `app/ui` may not read `content/` at all. Not in the
 * level catalogue, because `SceneLevel` deliberately excludes `subject` — "a
 * scene that could reach them would eventually use one" — and widening it to
 * serve a result screen would undo that.
 *
 * Lazy, and `import: 'subject'`, because this is on nobody's critical path: it
 * is read when an exam **result** is drawn, minutes after the game booted, and a
 * level document is 7 KB that a title screen has no business downloading
 * (CLAUDE.md, Budgets). The answer is cached after the first read, so a second
 * result costs nothing.
 *
 * ## What a missing entry means
 *
 * `null`. Three subjects have banks and no level document yet — `economy`,
 * `symbols`, `who-we-are` — and an exam can perfectly well ask about them, so
 * "this build cannot name this subject" is a normal state rather than a defect.
 * `TN-RESULT-07` says what the screen does with it: the row keeps its numbers
 * and loses its label, and never draws the raw id.
 */

/** Lazily, one subject string per level document. */
const SUBJECT_MODULES: Record<string, () => Promise<unknown>> = import.meta.glob(
  '../../content/levels/*.json',
  { import: 'subject' },
);

const idOf = (path: string): string =>
  path.slice(path.lastIndexOf('/') + 1, -'.json'.length);

export interface SubjectIndex {
  /** The level that teaches this subject, or `null` when this build has none. */
  levelFor(subject: string): string | null;
}

/** An index that knows nothing. What a failed read degrades to, never throws. */
export const EMPTY_SUBJECT_INDEX: SubjectIndex = { levelFor: () => null };

/**
 * Build the index from a map of loaders.
 *
 * Split from {@link readSubjectIndex} so it can be tested over a fixture rather
 * than over a bundler glob: the interesting cases — two levels claiming one
 * subject, a document whose subject will not load — are unreachable from the
 * real `content/` tree and are exactly the ones worth pinning.
 *
 * The **first** level wins a subject two levels claim. Sorted by id first, so
 * "first" is a property of the content rather than of whatever order the glob
 * happened to produce, and a duplicate is reported on the console rather than
 * silently deciding which chapter a result names.
 */
export async function buildSubjectIndex(
  modules: Record<string, () => Promise<unknown>>,
  report: (message: string) => void = () => undefined,
): Promise<SubjectIndex> {
  const bySubject = new Map<string, string>();

  for (const path of Object.keys(modules).sort()) {
    const level = idOf(path);
    let subject: unknown;
    try {
      subject = await (modules[path] as () => Promise<unknown>)();
    } catch {
      /* A level document that will not download is `TN-LEVEL-02`'s problem, not
         a result screen's: the row simply goes unnamed. */
      report(`the subject of level "${level}" could not be read.`);
      continue;
    }
    /* A vite module namespace (`{ default: … }`) under some configurations, the
       value itself under `import:`. Both are accepted rather than assuming a
       shape that differs between the artefact under test and the one deployed. */
    const value =
      typeof subject === 'object' && subject !== null && 'default' in subject
        ? (subject as { readonly default: unknown }).default
        : subject;
    if (typeof value !== 'string' || value === '') continue;

    const existing = bySubject.get(value);
    if (existing !== undefined) {
      report(
        `levels "${existing}" and "${level}" both teach "${value}"; the result names "${existing}".`,
      );
      continue;
    }
    bySubject.set(value, level);
  }

  return { levelFor: (subject) => bySubject.get(subject) ?? null };
}

let cached: Promise<SubjectIndex> | null = null;

/** The index for this build. Read once; every later caller gets the same answer. */
export function readSubjectIndex(
  report: (message: string) => void = () => undefined,
): Promise<SubjectIndex> {
  cached ??= buildSubjectIndex(SUBJECT_MODULES, report);
  return cached;
}
