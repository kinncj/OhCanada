/**
 * The exam's events, and the `?e2e=1` trace that makes them observable.
 *
 * `docs/stories/README.md` fixes eleven names between them — `exam/started`,
 * `exam/answered`, `exam/left`, `exam/resumed`, `exam/discarded`,
 * `exam/time-up`, `exam/finished`, and the three `progress/*` the stories assert
 * beside them — and a name nothing can observe is a name nothing can be held to.
 * Every "Then the event X is emitted" in `TN-EXAM`, `TN-TIMER`, `TN-RESULT` and
 * `TN-ATTEMPT` reads this trace.
 *
 * ## Why a trace and not the event bus
 *
 * `app/bootstrap/game-events.ts` exists and is the *level's* bounded area: its
 * map is derived from `LevelEventName`, every subscriber is a level surface, and
 * its whole purpose is to let a scene and the HUD talk without importing each
 * other. An exam is not a level (`TN-EXAM-01`: no `playable`, no `scene-state`,
 * no `level/chosen`), it has one publisher and one subscriber — itself — and
 * putting it on that bus would give `app/ui/level-events.ts`'s exhaustive
 * `SPEAKS` table eleven rows about a screen it never sees.
 *
 * So this is deliberately smaller than a bus: a list of names and, under
 * `?e2e=1` only, somewhere for a test to read them. On a normal load
 * {@link createExamEventLog} installs nothing and `window.__tnExam` is
 * `undefined`, which is the assertion that a player's build carries no debug
 * surface — the same contract `app/adapters/phaser/scene-probe.ts` keeps.
 *
 * ## An exam emits no `question/answered`
 *
 * `TN-RESULT-05` and `docs/stories/README.md` both say so, and it is the reason
 * {@link EXAM_EVENT_NAMES} has an `exam/answered` of its own rather than reusing
 * the level's name: nothing that counts a quest step can be advanced by an exam,
 * and the way to guarantee that is for an exam to be unable to say the word.
 */

/** Every name this module may emit. A name not here does not compile. */
export const EXAM_EVENT_NAMES = [
  'exam/started',
  'exam/answered',
  'exam/left',
  'exam/resumed',
  'exam/discarded',
  'exam/time-up',
  'exam/finished',
  'progress/saved',
  'progress/save-failed',
  'progress/loaded',
] as const;

export type ExamEventName = (typeof EXAM_EVENT_NAMES)[number];

/** One entry of the trace. `detail` names the subject when there is one. */
export interface ExamEventEntry {
  readonly name: ExamEventName;
  readonly detail?: string;
  /** Milliseconds since the trace was created. Ordering, never a duration. */
  readonly at: number;
}

export interface ExamEventLog {
  emit(name: ExamEventName, detail?: string): void;
}

/** What `page.evaluate` reaches for. Read-only: a test may look, never steer. */
export interface ExamProbeHandle {
  events(): readonly ExamEventEntry[];
  clear(): void;
}

const PARAM = 'e2e';

/**
 * Is the trace on?
 *
 * `?e2e=1` and nothing else, exactly as the scene probe reads it. Not "the
 * parameter is present": `?e2e=0` reading as on is the kind of surprise that
 * puts a debug surface in front of a player who pasted a URL.
 */
export function isExamProbeEnabled(search: string | null | undefined): boolean {
  if (typeof search !== 'string' || search.length === 0) return false;
  return new URLSearchParams(search).get(PARAM) === '1';
}

export interface ExamEventLogOptions {
  /** The page's query string. `null` on a harness page with none. */
  readonly search?: string | null;
  /** Where `__tnExam` is installed. Omitted outside a browser. */
  readonly target?: Record<string, unknown>;
  /** Injected so a test does not depend on a wall clock. */
  readonly now?: () => number;
}

/**
 * Build the log. Emitting is always safe; recording happens only under `?e2e=1`.
 *
 * The `emit` call sites are unconditional on purpose. A caller that had to ask
 * "is the probe on?" before emitting would be one forgotten branch away from an
 * event that fires in tests and not in the build, or the reverse — and the whole
 * value of these names is that they describe what the program did.
 */
export function createExamEventLog(options: ExamEventLogOptions = {}): ExamEventLog {
  const enabled = isExamProbeEnabled(options.search);
  if (!enabled) {
    return { emit: (): void => undefined };
  }

  const now = options.now ?? ((): number => Date.now());
  const origin = now();
  let entries: ExamEventEntry[] = [];

  const handle: ExamProbeHandle = {
    events: () => [...entries],
    clear: () => {
      entries = [];
    },
  };

  if (options.target !== undefined) options.target['__tnExam'] = handle;

  return {
    emit(name, detail): void {
      entries.push(
        detail === undefined
          ? { name, at: now() - origin }
          : { name, detail, at: now() - origin },
      );
    },
  };
}
