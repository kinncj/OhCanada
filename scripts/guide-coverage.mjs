#!/usr/bin/env node
/**
 * guide-coverage — how much of *Discover Canada* the game carries, per chapter,
 * and by which surface. A MEASUREMENT, NOT A GATE: it exits 0 on any coverage.
 *
 * WHY IT EXISTS. ADR-0061 §9 and ADR-0065's obligations both say the same thing:
 * "whether the guide is covered" cannot be held by CI, because the extraction is
 * Crown copyright and `committed: false`, so the only instrument is a repeated
 * local measurement. ADR-0061, ADR-0063 and ADR-0065 each re-derived their
 * numbers by hand, three times, with three slightly different methods. This
 * script is the method written down once, so the next re-measurement is a
 * command rather than an essay. `docs/plan/guide-coverage.md` records a run.
 *
 * THE UNIT: A GUIDE SENTENCE, AND WHAT IS NOT ONE.
 *
 * The extraction is split into pages at the form feeds `pdftotext` writes
 * (page N is the Nth segment, the convention `discover-canada.json` already
 * uses — the Oath is page 3). The printed page number at the foot of each page
 * is dropped. The rest is split into blocks at blank lines and at bullets, a
 * block that runs off the foot of a page mid-sentence is joined to its
 * continuation on the next, and each body block is split into sentences at
 * `.`, `!` or `?` before a capital — not after an initial (`John A.`), a known
 * abbreviation (`St.`, `Dr.`, `p.`) or a dotted acronym. A sentence is the
 * proposition unit. Everything that is not a body sentence is kept as ONE unit
 * per block, with a class naming why it is not teaching:
 *
 *   outside-register  front matter pp. 1, 4-10 and back matter pp. 106+, which
 *                     no register chapter spans (ADR-0061 §3)
 *   oath-recitation   pp. 2-3, the Oath as recited text, pre-accession in both
 *                     languages (ADR-0061 §3; knownStaleness)
 *   worksheet         the note-taking pages, from "HOW MUCH DO YOU KNOW ABOUT
 *                     YOUR GOVERNMENT?" to the end of Federal Elections (§3)
 *   invitation        the museum paragraph (§3)
 *   verse             "In Flanders Fields" and the anthems' lyrics (§3)
 *   caption           a "Picture:" block (§3 — it may SUPPORT a claim, never be
 *                     a lesson)
 *   heading           a block with no terminal punctuation and at most 14
 *                     words, or with no lower-case letter at all
 *   known-stale       the $10 bill sentence, which `docs/plan/slices.md`
 *                     guards by a row rather than a flag
 *   fragment          a "sentence" of fewer than three words
 *
 * A unit of any class that a verified claim rests on is counted IN SCOPE anyway:
 * a claim resting on it is proof somebody found a proposition there (ADR-0056
 * measured that landmark names come from captions).
 *
 * THE MATCH: THE CONTAINMENT RULE OF `app/application/content/proposition.ts`,
 * LOCATED. `sharesProposition` says two claims are one proposition when one
 * normalised quote contains the whole of the other on word boundaries. Here the
 * other side is not a claim but the guide, so each verified claim's
 * `source.quote` is tokenised by `words()` from `scripts/lib/claims.mjs` (the
 * tokeniser every content gate uses, with diacritics folded as `normaliseQuote`
 * folds them) and located as a contiguous run in the tokenised guide. A unit is
 * carried by the claim when the run and the unit contain one another — the quote
 * inside the sentence, or the sentence inside the quote — and, for a quote that
 * crosses a sentence boundary, when the piece of the run inside the unit is at
 * least three words or the whole unit. Where a quote occurs more than once, the
 * occurrences within one page of the cited page win. A quote that locates
 * nowhere is retried with the cited page's own printed number removed (a quote
 * that was copied across a page foot), and is otherwise reported, never guessed.
 *
 * THE CARRIERS. Only claims citing `discover-canada` whose `verification.status`
 * is `verified` against the register's current `extractedTextSha256`:
 *
 *   question   a question document (graded; Study, Exam, and a level's pools)
 *   lesson     a lesson passage (`content/lessons/**`; readable only where a
 *              quest's `read` step names it, since no Learn surface exists)
 *   told       a POI blurb, a territorial statement or a fact-bearing quest
 *              line (`content/levels/**`, `content/quests/**`)
 *   read       the subset of `lesson` a quest's `read` step names — the
 *              passages a player who only plays actually meets
 *
 * A unit may be carried by several; the columns overlap and `any` is the union.
 *
 * WHAT IT CANNOT SAY (ADR-0019). Whether a paraphrase that rests on another
 * sentence teaches this one (ADR-0028 §4: no string identifies a paraphrase);
 * whether a sentence holds one proposition or three; whether a heading or a
 * caption was classed correctly on the edge. The sentence split is a heuristic
 * over a two-column-free, large-print layout and it is stated rather than
 * trusted: `--units` prints every unit with its class so a reader can audit it.
 *
 * Usage:
 *   node scripts/guide-coverage.mjs [options]
 *
 *   --root <dir>   repository root (default: the one this script lives in)
 *   --list         also print every uncovered in-scope sentence, by chapter
 *   --units        print every unit, its class and its carriers (audit)
 *   --json         print one JSON object instead of tables
 *   --help, -h     this text
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { claimsIn, isSchemaDocument, words } from './lib/claims.mjs';
import {
  readLessonCorpus,
  readQuestCorpus,
  referencesIn,
  resolvePassage,
} from './lib/lesson-passages.mjs';

const HELP = `guide-coverage — per-chapter coverage of Discover Canada by the game's surfaces.
Not a gate: always exits 0 once it has measured, 2 when it cannot measure.

  --root <dir>   repository root (default: this repository)
  --list         print every uncovered in-scope sentence, by chapter
  --units        print every unit with its class and carriers (audit)
  --json         print one JSON object instead of tables
  --help, -h     this text

Needs content/sources/discover-canada-2012-large-print.txt, git-ignored under
Crown copyright; see content/sources/README.md and \`make sources\`.`;

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(HELP);
  process.exit(0);
}
const option = (name, fallback) => {
  const at = argv.indexOf(name);
  return at !== -1 && at + 1 < argv.length ? argv[at + 1] : fallback;
};
const root = option('--root', fileURLToPath(new URL('..', import.meta.url)));
const wantList = argv.includes('--list');
const wantUnits = argv.includes('--units');
const wantJson = argv.includes('--json');

/* -------------------------------------------------------------------------- */
/* The register and the bytes                                                 */
/* -------------------------------------------------------------------------- */

const SOURCE_ID = 'discover-canada';
const registerPath = join(root, 'content', 'sources', `${SOURCE_ID}.json`);
const register = JSON.parse(readFileSync(registerPath, 'utf8'));
const textPath = join(root, 'content', 'sources', register.extractedText);

if (!existsSync(textPath)) {
  console.error(
    `guide-coverage: cannot measure — ${relative(root, textPath)} is not here.\n` +
      'It is git-ignored under Crown copyright (content/sources/README.md). Fetch the PDF the\n' +
      'register names, check its sha256, and run `npm run sources -- --write`.',
  );
  process.exit(2);
}
const raw = readFileSync(textPath, 'utf8');
const digest = createHash('sha256').update(raw).digest('hex');
if (digest !== register.extractedTextSha256) {
  console.error(
    `guide-coverage: cannot measure — the extraction hashes to ${digest}, the register records ` +
      `${register.extractedTextSha256}. Every grant is against the recorded digest; ` +
      'a count over other bytes would describe nothing.',
  );
  process.exit(2);
}

const chapters = register.chapters;
const chapterOf = (page) =>
  chapters.find((chapter) => page >= chapter.page && page <= chapter.endPage)?.title ?? null;

/** `normaliseQuote`'s diacritic fold, then the gates' own tokeniser. */
const tokens = (text) => words(text.normalize('NFD').replace(/\p{Diacritic}/gu, ''));

/* -------------------------------------------------------------------------- */
/* Pages → blocks → units                                                     */
/* -------------------------------------------------------------------------- */

const TERMINAL = /[.!?:;]["”’)\]]*$/u;

/** A dotted-leader row ("Nova Scotia ........ Halifax") is one proposition. */
const LEADER = /\.{5,}/u;

/** A row of the holidays table ends in a month, or a month and a day. */
const MONTH_ROW =
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{1,2})?$/u;

/** Verse and the invitation, by the first words of the block that carries them. */
const VERSE_OPENINGS = [
  'In Flanders fields the poppies blow',
  'We are the dead. Short days ago',
  'Take up our quarrel with the foe',
  'O Canada! Our home and native land',
  'Ô Canada! Terre de nos aïeux',
  'God Save our gracious Queen',
  'Dieu protège la Reine',
];
const INVITATION_OPENING = 'Want to learn more about Canada';
const WORKSHEET_OPENING = 'HOW MUCH DO YOU KNOW ABOUT YOUR';
/** `docs/plan/slices.md`: "No question or lesson may teach the $10 portrait from this source". */
const KNOWN_STALE_SENTENCES = [
  { contains: 'portrait is on the $10 bill', why: 'slices.md $10 row' },
];

const pageTexts = raw.split('\f');
const blocks = [];
pageTexts.forEach((pageText, index) => {
  const page = index + 1;
  let lines = pageText.split('\n').map((line) => line.replace(/\s+$/u, ''));
  let last = lines.length - 1;
  while (last >= 0 && lines[last].trim() === '') last -= 1;
  if (last >= 0 && /^\s*\d{1,3}\s*$/u.test(lines[last])) lines = lines.slice(0, last);
  let current = null;
  const pageBlocks = [];
  for (const line of lines) {
    const text = line.trim();
    if (text === '') {
      if (current) pageBlocks.push(current);
      current = null;
      continue;
    }
    if (text.startsWith('•') && current) {
      pageBlocks.push(current);
      current = null;
    }
    current ??= { page, lines: [], bullet: text.startsWith('•') };
    current.lines.push(text.replace(/^•\s*/u, ''));
  }
  if (current) pageBlocks.push(current);
  if (pageBlocks.length > 0) pageBlocks[pageBlocks.length - 1].lastOnPage = true;
  blocks.push(...pageBlocks);
});

const joinLines = (lines) =>
  lines.reduce((text, line) => {
    if (text === '') return line;
    if (/\p{L}-$/u.test(text) && /^\p{Ll}/u.test(line)) return `${text}${line}`;
    return `${text} ${line}`;
  }, '');

const isCaption = (block) => block.lines[0].startsWith('Picture:');

// A block that runs off the foot of its page mid-sentence continues in the
// first non-caption block of the next page.
for (let i = 0; i < blocks.length; i += 1) {
  const block = blocks[i];
  if (!block.lastOnPage || isCaption(block)) continue;
  const text = joinLines(block.lines);
  if (TERMINAL.test(text) || tokens(text).length <= 14) continue;
  const next = blocks.findIndex(
    (candidate, j) => j > i && candidate.page > block.page && !isCaption(candidate),
  );
  if (next === -1 || blocks[next].page !== block.page + 1) continue;
  // Never into a heading: "(See voting procedures)" then "SECRET BALLOT".
  const following = joinLines(blocks[next].lines);
  if (!/\p{Ll}/u.test(following)) continue;
  if (!TERMINAL.test(following) && tokens(following).length <= 14) continue;
  block.lines.push(...blocks[next].lines);
  block.lastOnPage = blocks[next].lastOnPage;
  blocks.splice(next, 1);
  i -= 1;
}

const worksheetPage = blocks.find((block) => block.lines[0].startsWith(WORKSHEET_OPENING))?.page;
const worksheetEnd = worksheetPage
  ? chapters.find((chapter) => chapter.page <= worksheetPage && worksheetPage <= chapter.endPage)
      ?.endPage
  : undefined;

const ABBREVIATIONS = new Set(
  'mr mrs ms dr st ste lt col gen capt sgt maj hon rt jr sr no mt p pp e.g i.e vs ft co ltd inc'.split(
    ' ',
  ),
);

/** Sentence boundaries inside one body block. */
const sentencesOf = (text) => {
  const out = [];
  let from = 0;
  const boundary = /[.!?]["”’)\]]*(?=\s+["“‘(]?[\p{Lu}\p{N}])/gu;
  for (const match of text.matchAll(boundary)) {
    const end = match.index + match[0].length;
    const before = text.slice(from, match.index + 1);
    const lastWord = (before.match(/(\S+)$/u)?.[1] ?? '').replace(/^["“‘(]+/u, '');
    const bare = lastWord.replace(/\.$/u, '').toLowerCase();
    if (match[0].startsWith('.')) {
      // An initial (`John A.`), a dotted acronym (`U.S.`, `B.C.`), an abbreviation.
      if (/^\p{Lu}\.$/u.test(lastWord)) continue;
      if (/^(?:\p{L}\.){2,}$/u.test(lastWord)) continue;
      if (ABBREVIATIONS.has(bare)) continue;
    }
    out.push(text.slice(from, end).trim());
    from = end;
  }
  const tail = text.slice(from).trim();
  if (tail !== '') out.push(tail);
  return out;
};

const classOfBlock = (block, text) => {
  const chapter = chapterOf(block.page);
  if (chapter === null) return 'outside-register';
  if (chapter === 'The Oath of Citizenship') return 'oath-recitation';
  if (isCaption(block)) return 'caption';
  if (worksheetPage && block.page >= worksheetPage && block.page <= worksheetEnd)
    return 'worksheet';
  if (VERSE_OPENINGS.some((opening) => text.startsWith(opening))) return 'verse';
  if (text.startsWith(INVITATION_OPENING)) return 'invitation';
  // A bullet ("• at least 18 years old on voting day; and") and a dotted-leader
  // row are list items, whatever their punctuation.
  if (block.bullet || block.lines.some((line) => LEADER.test(line))) return 'body';
  // Rows of the guide's own lists and tables, which carry no terminal stop:
  // "1871 – British Columbia", "Christmas Day December 25", "Municipal • Mayor…".
  if (/^\d{4}\s*[–-]/u.test(text) || text.includes('•') || MONTH_ROW.test(text)) return 'body';
  if (!/\p{Ll}/u.test(text)) return 'heading';
  if (!TERMINAL.test(text) && tokens(text).length <= 14) return 'heading';
  return 'body';
};

const units = [];
const stream = [];
const addUnit = (page, cls, text) => {
  const list = tokens(text);
  const unit = {
    n: units.length,
    page,
    chapter: chapterOf(page),
    cls,
    text,
    start: stream.length,
    end: stream.length + list.length,
    carriers: {
      question: new Set(),
      lesson: new Set(),
      told: new Set(),
      read: new Set(),
    },
    subjects: new Set(),
  };
  stream.push(...list);
  units.push(unit);
};

/** Why a body sentence is still not a proposition, or `body` when it is one. */
const classOfSentence = (sentence, bullet) => {
  if (KNOWN_STALE_SENTENCES.some((entry) => sentence.includes(entry.contains)))
    return 'known-stale';
  const count = tokens(sentence).length;
  // A short bullet is a list item ("• Snow Removal" under municipal government),
  // and a list item is a proposition however few its words.
  if (count < 3 && !bullet) return 'fragment';
  // A cross-reference or an attribution: "(See voting procedures)".
  if (/^\(.*\)\.?$/u.test(sentence)) return 'fragment';
  // "Did you know?" — a signpost, not a claim.
  if (sentence.endsWith('?') && count <= 4) return 'heading';
  // "The most important of these include:" — a lead-in to a list.
  if (/:["”’)]*$/u.test(sentence)) return 'lead-in';
  return 'body';
};

for (const block of blocks) {
  const text = joinLines(block.lines).replace(/\s+/gu, ' ');
  const cls = classOfBlock(block, text);
  if (cls === 'body' && block.lines.some((line) => LEADER.test(line))) {
    for (const line of block.lines) {
      addUnit(block.page, LEADER.test(line) ? 'body' : 'heading', line.replace(/\s+/gu, ' '));
    }
    continue;
  }
  if (cls !== 'body') {
    addUnit(block.page, cls, text);
    continue;
  }
  for (const sentence of sentencesOf(text)) {
    addUnit(block.page, classOfSentence(sentence, block.bullet === true), sentence);
  }
}

/* -------------------------------------------------------------------------- */
/* Locating a quote                                                           */
/* -------------------------------------------------------------------------- */

const joined = ` ${stream.join(' ')} `;
const tokenAtChar = [];
{
  let at = 1;
  for (let i = 0; i < stream.length; i += 1) {
    tokenAtChar.push(at);
    at += stream[i].length + 1;
  }
}
const tokenIndexOf = (charOffset) => {
  let lo = 0;
  let hi = tokenAtChar.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (tokenAtChar[mid] <= charOffset) lo = mid;
    else hi = mid - 1;
  }
  return lo;
};
const unitAtToken = (index) => {
  let lo = 0;
  let hi = units.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (units[mid].start <= index) lo = mid;
    else hi = mid - 1;
  }
  return units[lo];
};

const occurrencesOf = (list) => {
  if (list.length === 0) return [];
  const needle = ` ${list.join(' ')} `;
  const found = [];
  let from = 0;
  for (;;) {
    const at = joined.indexOf(needle, from);
    if (at === -1) break;
    const start = tokenIndexOf(at + 1);
    found.push({ start, end: start + list.length });
    from = at + 1;
  }
  return found;
};

/** Quotes whose every occurrence is more than a page from the page they cite. */
const offPage = [];

/** Units a quote rests on, or null when it locates nowhere. */
const unitsForQuote = (quote, citedPage) => {
  let list = tokens(quote);
  let found = occurrencesOf(list);
  if (found.length === 0 && Number.isInteger(citedPage)) {
    const pageNumbers = new Set([citedPage - 1, citedPage, citedPage + 1].map(String));
    list = list.filter((token) => !pageNumbers.has(token));
    found = occurrencesOf(list);
  }
  if (found.length === 0) return null;
  if (Number.isInteger(citedPage)) {
    const near = found.filter(
      (occurrence) => Math.abs(unitAtToken(occurrence.start).page - citedPage) <= 1,
    );
    if (near.length > 0) found = near;
    else
      offPage.push(
        `p.${citedPage} cited, found on p.${unitAtToken(found[0].start).page}: "${quote}"`,
      );
  }
  const hit = new Map();
  for (const { start, end } of found) {
    for (let unit = unitAtToken(start); unit && unit.start < end; unit = units[unit.n + 1]) {
      const overlap = Math.min(end, unit.end) - Math.max(start, unit.start);
      const length = unit.end - unit.start;
      // Containment, either way: the quote inside the unit, or the unit inside the quote.
      const whole = overlap === end - start || overlap === length;
      if (overlap > 0 && (whole || overlap >= Math.min(3, length))) {
        hit.set(unit, (hit.get(unit) ?? false) || whole);
      }
    }
  }
  return [...hit].map(([unit, whole]) => ({ unit, whole }));
};

/* -------------------------------------------------------------------------- */
/* The claims                                                                 */
/* -------------------------------------------------------------------------- */

const contentRoot = join(root, 'content');
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : name.endsWith('.json') ? [path] : [];
  });
const repoPath = (path) => relative(root, path).split(sep).join('/');

const current = register.extractedTextSha256;
const claimTally = { cited: 0, verified: 0, unlocated: [], byCarrier: {} };
const questionSubject = new Map();
const lessonClaims = new Map();
const questionClaims = new Map();

for (const path of walk(contentRoot)) {
  const where = repoPath(path);
  if (isSchemaDocument(where) || where.startsWith('content/sources/')) continue;
  const document = JSON.parse(readFileSync(path, 'utf8'));
  for (const claim of claimsIn(document, where)) {
    const source = claim.source;
    if (!source || source.sourceId !== SOURCE_ID) continue;
    claimTally.cited += 1;
    const verification = claim.verification;
    const verified =
      verification?.status === 'verified' &&
      verification.sourceHash === current &&
      source.sourceHash === current;
    if (!verified) continue;
    claimTally.verified += 1;
    let carrier;
    let label;
    if (claim.kind === 'question') {
      carrier = 'question';
      label = document.id;
      questionSubject.set(label, document.subject);
    } else if (claim.collection === 'lessons') {
      carrier = 'lesson';
      const index = Number(/^\/passages\/(\d+)\//u.exec(claim.pointer)?.[1]);
      label = `${document.id}#${document.passages?.[index]?.id}`;
    } else if (claim.collection === 'levels' || claim.collection === 'quests') {
      carrier = 'told';
      // Keyed by the level that tells it, so a level's own told set is a prefix match.
      const levelId = claim.collection === 'levels' ? document.id : document.levelId;
      label = `${levelId}:${claim.at}`;
    } else {
      carrier = 'other';
      label = claim.at;
    }
    claimTally.byCarrier[carrier] = (claimTally.byCarrier[carrier] ?? 0) + 1;
    const hit = unitsForQuote(String(source.quote ?? ''), source.page);
    if (hit === null) {
      claimTally.unlocated.push(`${label} (p.${source.page}): "${source.quote}"`);
      continue;
    }
    if (carrier === 'lesson') lessonClaims.set(label, hit);
    if (carrier === 'question') questionClaims.set(label, hit);
    for (const { unit, whole } of hit) {
      if (!unit.carriers[carrier]) continue;
      unit.carriers[carrier].add(label);
      if (whole) unit.whole = true;
      if (carrier === 'question') unit.subjects.add(document.subject);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* What a player who only plays meets                                         */
/* -------------------------------------------------------------------------- */

const lessonCorpus = readLessonCorpus(root);
const quests = readQuestCorpus(root);
const reach = {
  readSteps: 0,
  passagesNamed: 0,
  answerSteps: 0,
  pooled: new Set(),
  asked: 0,
};
const perQuest = new Map();
for (const { where, document } of quests) {
  const steps = Array.isArray(document.steps) ? document.steps : [];
  const row = { answer: 0, read: 0, asked: 0, pooled: new Set(), passages: 0 };
  for (const step of steps) {
    if (step.kind === 'read') {
      reach.readSteps += 1;
      row.read += 1;
    }
    if (step.kind === 'answer') {
      reach.answerSteps += 1;
      row.answer += 1;
      const pool = Array.isArray(step.questionPool) ? step.questionPool : [];
      for (const id of pool) {
        reach.pooled.add(id);
        row.pooled.add(id);
      }
      const count = Number(step.count ?? 0);
      const asked = pool.length > 0 ? Math.min(count, pool.length) : count;
      reach.asked += asked;
      row.asked += asked;
    }
  }
  for (const { reference } of referencesIn(document)) {
    const resolution = resolvePassage(lessonCorpus, reference);
    if (!resolution.ok) continue;
    reach.passagesNamed += 1;
    row.passages += 1;
    const label = `${resolution.match.lesson.id}#${resolution.match.passage.id}`;
    for (const { unit } of lessonClaims.get(label) ?? []) {
      unit.carriers.read.add(`${document.levelId}:${label}`);
    }
  }
  perQuest.set(document.levelId ?? where, row);
}

const uiDir = join(root, 'app', 'ui');
const learnScreens = existsSync(uiDir)
  ? readdirSync(uiDir).filter((name) => /^learn[-.]/u.test(name))
  : [];

/* -------------------------------------------------------------------------- */
/* Levels: stops, room, and what each subject's bank holds                    */
/* -------------------------------------------------------------------------- */

const levelsDir = join(contentRoot, 'levels');
const levels = readdirSync(levelsDir)
  .filter((name) => name.endsWith('.json'))
  .map((name) => JSON.parse(readFileSync(join(levelsDir, name), 'utf8')))
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

const bankSize = new Map();
for (const subject of questionSubject.values()) {
  bankSize.set(subject, (bankSize.get(subject) ?? 0) + 1);
}

const levelRows = levels.map((level) => {
  const stops = [
    ...(level.pois ?? []).map((poi) => poi.position?.x ?? 0),
    ...(level.characters ?? []).map((character) => character.position?.x ?? 0),
  ].sort((a, b) => a - b);
  const width = level.size?.x ?? 0;
  const edges = [level.spawn?.x ?? 0, ...stops, width];
  let widestGap = 0;
  for (let i = 1; i < edges.length; i += 1)
    widestGap = Math.max(widestGap, edges[i] - edges[i - 1]);
  const quest = perQuest.get(level.id) ?? {
    answer: 0,
    read: 0,
    asked: 0,
    pooled: new Set(),
  };
  const subjectUnits = units.filter((unit) => unit.subjects.has(level.subject));
  const toldHere = (unit) =>
    [...unit.carriers.told, ...unit.carriers.read].some((label) =>
      label.startsWith(`${level.id}:`),
    );
  return {
    level: level.id,
    order: level.order,
    subject: level.subject,
    stops: stops.length,
    answerSteps: quest.answer,
    readSteps: quest.read,
    asked: quest.asked,
    pooled: quest.pooled.size,
    width,
    widestGap,
    textureBudgetBytes: level.textureBudgetBytes ?? null,
    bank: bankSize.get(level.subject) ?? 0,
    subjectPropositions: subjectUnits.length,
    subjectPropositionsUntold: subjectUnits.filter((unit) => !toldHere(unit)).length,
    // ADR-0057 §1 at sentence grain: a pooled question is taught when a sentence it
    // rests on is one this level tells (or reads) the player.
    pooledTaught: [...quest.pooled].filter((id) =>
      (questionClaims.get(id) ?? []).some(({ unit }) => toldHere(unit)),
    ).length,
  };
});

/* -------------------------------------------------------------------------- */
/* Tables                                                                     */
/* -------------------------------------------------------------------------- */

const inScope = (unit) =>
  unit.cls === 'body' ||
  unit.carriers.question.size + unit.carriers.lesson.size + unit.carriers.told.size > 0;
const carried = (unit) =>
  unit.carriers.question.size + unit.carriers.lesson.size + unit.carriers.told.size > 0;

const chapterRows = chapters.map((chapter) => {
  const mine = units.filter((unit) => unit.chapter === chapter.title);
  const scope = mine.filter(inScope);
  const excluded = {};
  for (const unit of mine.filter((u) => !inScope(u))) {
    excluded[unit.cls] = (excluded[unit.cls] ?? 0) + 1;
  }
  return {
    chapter: chapter.title,
    pages: `${chapter.page}-${chapter.endPage}`,
    units: mine.length,
    excluded,
    propositions: scope.length,
    question: scope.filter((u) => u.carriers.question.size > 0).length,
    lesson: scope.filter((u) => u.carriers.lesson.size > 0).length,
    told: scope.filter((u) => u.carriers.told.size > 0).length,
    read: scope.filter((u) => u.carriers.read.size > 0).length,
    any: scope.filter(carried).length,
    none: scope.filter((u) => !carried(u)).length,
    inPlay: scope.filter((u) => u.carriers.told.size + u.carriers.read.size > 0).length,
    noLesson: scope.filter((u) => u.carriers.lesson.size === 0).length,
    noQuestion: scope.filter((u) => u.carriers.question.size === 0).length,
    pieceOnly: scope.filter((u) => carried(u) && !u.whole).length,
    lessonsAuthored: lessonCorpus.lessons.filter((lesson) => lesson.chapter === chapter.title)
      .length,
    passagesAuthored: lessonCorpus.lessons
      .filter((lesson) => lesson.chapter === chapter.title)
      .reduce((sum, lesson) => sum + lesson.passages.length, 0),
    subjects: [...new Set(mine.flatMap((u) => [...u.subjects]))].sort(),
  };
});

const total = (key) => chapterRows.reduce((sum, row) => sum + row[key], 0);
const outside = units.filter((unit) => unit.chapter === null).length;

const uncovered = units.filter((unit) => inScope(unit) && !carried(unit));
const flagsFor = (unit) =>
  (register.knownStaleness ?? [])
    .filter((flag) => (flag.pages ?? []).includes(unit.page))
    .filter((flag) =>
      (flag.bannedFromAnswers ?? []).some((term) =>
        unit.text.toLowerCase().includes(String(term).toLowerCase()),
      ),
    )
    .map((flag) => flag.topic);

if (wantJson) {
  console.log(
    JSON.stringify(
      {
        sourceHash: current,
        unitCount: units.length,
        outsideRegister: outside,
        chapters: chapterRows,
        claims: { ...claimTally, unlocated: claimTally.unlocated },
        reach: {
          readSteps: reach.readSteps,
          passagesNamed: reach.passagesNamed,
          answerSteps: reach.answerSteps,
          pooled: reach.pooled.size,
          asked: reach.asked,
          verifiedQuestions: questionSubject.size,
          passagesAuthored: lessonCorpus.passageCount,
          learnScreens,
        },
        levels: levelRows,
        banks: Object.fromEntries([...bankSize].sort()),
        uncovered: uncovered.map((unit) => ({
          chapter: unit.chapter,
          page: unit.page,
          cls: unit.cls,
          text: unit.text,
          flags: flagsFor(unit),
        })),
        // Every unit and what carries it, for re-slicing without re-reading the guide.
        units: units.map((unit) => ({
          page: unit.page,
          chapter: unit.chapter,
          cls: unit.cls,
          inScope: inScope(unit),
          text: unit.text,
          question: [...unit.carriers.question],
          lesson: [...unit.carriers.lesson],
          told: [...unit.carriers.told],
          read: [...unit.carriers.read],
          subjects: [...unit.subjects],
        })),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const pad = (value, width) => String(value).padStart(width);
const padEnd = (value, width) => String(value).padEnd(width);

console.log(`guide-coverage: Discover Canada at ${current.slice(0, 12)}…`);
console.log(
  `  ${units.length} units over ${pageTexts.length - 1} pages; ${outside} outside the register ` +
    '(front and back matter, ADR-0061 §3).',
);
console.log(
  `  ${claimTally.verified} verified claims cite the guide (${Object.entries(claimTally.byCarrier)
    .map(([k, v]) => `${v} ${k}`)
    .join(
      ', ',
    )}); ${claimTally.unlocated.length} quote(s) located nowhere; ${offPage.length} located only off the cited page (±1).`,
);
console.log('');
console.log(
  `${padEnd('Chapter', 42)}${pad('Pages', 8)}${pad('Props', 7)}${pad('Qn', 6)}${pad('Lsn', 6)}` +
    `${pad('Told', 6)}${pad('Read', 6)}${pad('Any', 6)}${pad('None', 6)}${pad('Play', 6)}  Excluded`,
);
for (const row of chapterRows) {
  const excluded = Object.entries(row.excluded)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
  console.log(
    `${padEnd(row.chapter, 42)}${pad(row.pages, 8)}${pad(row.propositions, 7)}${pad(row.question, 6)}` +
      `${pad(row.lesson, 6)}${pad(row.told, 6)}${pad(row.read, 6)}${pad(row.any, 6)}${pad(row.none, 6)}` +
      `${pad(row.inPlay, 6)}  ${excluded}`,
  );
}
console.log(
  `${padEnd('Total', 42)}${pad('', 8)}${pad(total('propositions'), 7)}${pad(total('question'), 6)}` +
    `${pad(total('lesson'), 6)}${pad(total('told'), 6)}${pad(total('read'), 6)}${pad(total('any'), 6)}` +
    `${pad(total('none'), 6)}${pad(total('inPlay'), 6)}`,
);
console.log('');
console.log(
  'Props = in-scope sentences; Qn/Lsn/Told = carried by a verified question / lesson passage /\n' +
    'level-told claim; Read = a passage a read step names; Any = union; None = no carrier;\n' +
    'Play = what a player who only plays is told (Told ∪ Read). Columns overlap.',
);
console.log('');
console.log(
  `${padEnd('Chapter', 42)}${pad('Lessons', 8)}${pad('Psgs', 6)}${pad('NoLsn', 7)}${pad('NoQn', 6)}` +
    `${pad('Piece', 7)}  Subjects whose questions cite it`,
);
for (const row of chapterRows) {
  console.log(
    `${padEnd(row.chapter, 42)}${pad(row.lessonsAuthored, 8)}${pad(row.passagesAuthored, 6)}` +
      `${pad(row.noLesson, 7)}${pad(row.noQuestion, 6)}${pad(row.pieceOnly, 7)}  ${row.subjects.join(', ')}`,
  );
}
console.log(
  `${padEnd('Total', 42)}${pad(total('lessonsAuthored'), 8)}${pad(total('passagesAuthored'), 6)}` +
    `${pad(total('noLesson'), 7)}${pad(total('noQuestion'), 6)}${pad(total('pieceOnly'), 7)}`,
);
console.log(
  'NoLsn / NoQn = in-scope sentences no lesson passage / no question carries; Piece = carried only\n' +
    'by a quote crossing a sentence boundary (≥ 3 words inside), not by containment either way.',
);
console.log('');
console.log(
  `Reach by playing: ${reach.readSteps} read step(s) naming ${reach.passagesNamed} of ` +
    `${lessonCorpus.passageCount} passages; ${reach.answerSteps} answer steps pool ` +
    `${reach.pooled.size} of ${questionSubject.size} verified questions and ask ${reach.asked}; ` +
    `Learn surface: ${learnScreens.length > 0 ? learnScreens.join(', ') : 'none (no app/ui/learn-*)'}.`,
);
console.log('');
console.log(
  `${padEnd('Level', 20)}${padEnd('Subject', 15)}${pad('Bank', 5)}${pad('Stops', 6)}${pad('Ans', 5)}` +
    `${pad('Read', 5)}${pad('Asked', 6)}${pad('Pool', 5)}${pad('Width', 7)}${pad('Gap', 6)}` +
    `${pad('SubjP', 6)}${pad('Untold', 7)}${pad('Taught', 7)}`,
);
for (const row of levelRows) {
  console.log(
    `${padEnd(row.level, 20)}${padEnd(row.subject, 15)}${pad(row.bank, 5)}${pad(row.stops, 6)}` +
      `${pad(row.answerSteps, 5)}${pad(row.readSteps, 5)}${pad(row.asked, 6)}${pad(row.pooled, 5)}` +
      `${pad(row.width, 7)}${pad(row.widestGap, 6)}${pad(row.subjectPropositions, 6)}` +
      `${pad(row.subjectPropositionsUntold, 7)}${pad(row.pooledTaught, 7)}`,
  );
}
console.log(
  'Bank = verified questions in the subject; Gap = widest px between spawn, stops and the end;\n' +
    "SubjP = sentences the subject's questions rest on; Untold = of those, not told by the level;\n" +
    'Taught = pooled questions resting on a sentence the level tells or reads (ADR-0057 §1).',
);
console.log(
  `Ceiling (ADR-0065 §4): Σ⌊verified ÷ 30⌋ = ${[...bankSize.values()].reduce(
    (sum, v) => sum + Math.floor(v / 30),
    0,
  )} against ${levels.length} levels.`,
);

if (claimTally.unlocated.length > 0) {
  console.log('');
  console.log('Quotes located nowhere (not counted):');
  for (const line of claimTally.unlocated) console.log(`  - ${line}`);
}
if (offPage.length > 0) {
  console.log('');
  console.log('Quotes located only away from the page they cite (counted where found):');
  for (const line of offPage) console.log(`  - ${line}`);
}

if (wantList) {
  console.log('');
  console.log(`Uncovered in-scope sentences: ${uncovered.length}`);
  for (const chapter of chapters) {
    const mine = uncovered.filter((unit) => unit.chapter === chapter.title);
    if (mine.length === 0) continue;
    console.log(`\n## ${chapter.title} (${mine.length})`);
    for (const unit of mine) {
      const flags = flagsFor(unit);
      const note = flags.length > 0 ? `  [flag: ${flags.join('; ')}]` : '';
      console.log(`  p.${unit.page}  ${unit.text}${note}`);
    }
  }
}

if (wantUnits) {
  console.log('');
  for (const unit of units) {
    const marks = ['question', 'lesson', 'told', 'read']
      .filter((key) => unit.carriers[key].size > 0)
      .map((key) => key[0].toUpperCase())
      .join('');
    console.log(`p.${pad(unit.page, 3)} ${padEnd(unit.cls, 16)} ${padEnd(marks, 4)} ${unit.text}`);
  }
}
