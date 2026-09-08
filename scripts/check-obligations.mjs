#!/usr/bin/env node
/**
 * obligation-gate - ADR-0009, "A dated obligation in a document is machine-checked".
 *
 * This project's recurring failure mode is a written claim that stops being true
 * and nothing noticing. ADR-0006 carried a false claim twice, and both times a
 * person found it. This gate removes the person from that loop for the one class
 * of claim that has a date attached: an obligation.
 *
 * It scans every `*.md` under `docs/` for the ADR-0009 markers
 *
 *     OBLIGATION due=YYYY-MM-DD owner=<owner>
 *     DISCHARGED YYYY-MM-DD          (the work was done)
 *     VOIDED YYYY-MM-DD              (the premise went away; nothing was owed)
 *
 * and fails when an obligation is past its date and unclosed, when a marker is
 * malformed, when a closure has no obligation, when a block claims both terminal
 * states, or when a date is impossible or a closure is dated in the future. It
 * passes-but-reports every open obligation, sorted by due date.
 *
 * Two properties are load-bearing and are the reason for most of the code below.
 *
 *   1. Fenced code blocks and inline code spans are skipped. Without that,
 *      ADR-0009's own examples parse as live obligations and malformed markers -
 *      a gate that cannot read the document defining it is a gate nobody trusts.
 *
 *   2. An obligation and its closure must sit in the same Markdown list item.
 *      A discharge recorded somewhere else is exactly the runbook §6 / ADR-0006
 *      split that produced the drift this ADR exists to stop, so "closed
 *      elsewhere" is not a state this gate can be told about.
 *
 * THIS GATE CAN TURN A GREEN TREE RED WITH NO COMMIT, because the clock moved.
 * That is the point, not a bug: the obligation became overdue whether or not
 * anyone touched the repository, and the next person to open a pull request is
 * the right person to be told. The fix is to discharge the obligation or to
 * re-date it with a note saying why - never to silence the gate.
 *
 * Usage:
 *   node scripts/check-obligations.mjs [--docs <dir>]
 *   TRUENORTH_OBLIGATION_TODAY=2026-10-09 node scripts/check-obligations.mjs
 *
 * "Today" is UTC. The environment override exists so the gate itself is testable
 * at a fixed date; a date-dependent check that cannot be tested at a fixed date
 * rots exactly like the claims it guards.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/* ------------------------------------------------------------------ dates -- */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True when `text` is a real calendar date, so 2026-02-30 and 2026-13-01 fail. */
export function isRealDate(text) {
  const match = ISO_DATE.exec(text);
  if (match === null) return false;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return (
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(m) - 1 &&
    date.getUTCDate() === Number(d)
  );
}

/** Whole days from `a` to `b`, both ISO dates. Negative when `b` is earlier. */
export function daysBetween(a, b) {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Today in UTC, or the `TRUENORTH_OBLIGATION_TODAY` override. */
export function resolveToday(env = process.env) {
  const override = env.TRUENORTH_OBLIGATION_TODAY;
  if (override !== undefined && override !== '') {
    if (!isRealDate(override)) {
      throw new Error(
        `TRUENORTH_OBLIGATION_TODAY must be a real ISO date (YYYY-MM-DD); got "${override}".`,
      );
    }
    return override;
  }
  return new Date().toISOString().slice(0, 10);
}

/* ----------------------------------------------------------------- markdown -- */

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const LIST_ITEM = /^(\s*)(?:[-*+]|\d+[.)])\s+/;

/**
 * Blank out everything the gate must not read: fenced code blocks entirely, and
 * inline code spans in place (replaced by spaces, so reported columns and the
 * rest of the line survive). Returns one masked string per line, plus the set of
 * lines that were inside a fence - those are not Markdown structure either.
 */
export function maskCode(lines) {
  const masked = [];
  const fenced = [];
  let fence = null; // { char, length }

  for (const line of lines) {
    const fenceMatch = FENCE.exec(line);
    if (fence === null) {
      if (fenceMatch !== null) {
        fence = { char: fenceMatch[1][0], length: fenceMatch[1].length };
        masked.push('');
        fenced.push(true);
        continue;
      }
    } else {
      const closes =
        fenceMatch !== null &&
        fenceMatch[1][0] === fence.char &&
        fenceMatch[1].length >= fence.length &&
        line.slice(fenceMatch[0].length).trim() === '';
      masked.push('');
      fenced.push(true);
      if (closes) fence = null;
      continue;
    }
    masked.push(stripInlineCode(line));
    fenced.push(false);
  }

  return { masked, fenced };
}

/** Replace `code spans` with spaces of the same width, one line at a time. */
export function stripInlineCode(line) {
  let out = '';
  let i = 0;
  while (i < line.length) {
    if (line[i] !== '`') {
      out += line[i];
      i += 1;
      continue;
    }
    let run = 0;
    while (line[i + run] === '`') run += 1;
    const delimiter = '`'.repeat(run);
    const close = line.indexOf(delimiter, i + run);
    // An unterminated run is literal text, not a span: leave it alone.
    if (close === -1) {
      out += delimiter;
      i += run;
      continue;
    }
    out += ' '.repeat(close + run - i);
    i = close + run;
  }
  return out;
}

/**
 * Every Markdown list item and the extent of its block: from the `-` to the next
 * line at the same or shallower indentation, which is both "the next list item"
 * and "the paragraph or heading that ends the list". ADR-0009 defines the block
 * this way, and the extent is what makes "the closure sits with the obligation"
 * checkable.
 */
export function listItemBlocks(lines, fenced) {
  const items = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (fenced[i]) continue;
    const match = LIST_ITEM.exec(lines[i]);
    if (match === null) continue;
    items.push({ start: i, indent: match[1].length, end: lines.length - 1 });
  }
  for (const item of items) {
    for (let j = item.start + 1; j < lines.length; j += 1) {
      const line = lines[j];
      if (line.trim() === '') continue;
      if (fenced[j]) continue;
      const indent = line.length - line.trimStart().length;
      if (indent <= item.indent) {
        item.end = j - 1;
        break;
      }
    }
  }
  return items;
}

/* ------------------------------------------------------------------ markers -- */

/** `~~`, `*` and `_` are formatting, not content. ADR-0009 says strip them. */
export function stripEmphasis(line) {
  return line.replace(/~~/g, '').replace(/[*_]/g, '');
}

const OBLIGATION_WORD = /\bOBLIGATION\b/g;
const OBLIGATION_FULL = /\bOBLIGATION\s+due=(\d{4}-\d{2}-\d{2})\s+owner=(\S+)/g;
const CLOSURE_WORD = /\b(DISCHARGED|VOIDED)\b/g;
const CLOSURE_FULL = /\b(DISCHARGED|VOIDED)\s+(\d{4}-\d{2}-\d{2})\b/g;
const OWNER_TOKEN = /^[A-Za-z0-9_./-]+$/;

/** The prose after a marker, for the error line. Trimmed of leading dashes. */
function tail(text, from) {
  return text
    .slice(from)
    .replace(/^[\s–—-]+/, '')
    .trim()
    .slice(0, 96);
}

/**
 * The same tail, but read off the *unmasked* line so a reader sees the code
 * spans an error message is about (`assets/dist/`, not eleven spaces). Detection
 * still happens on the masked line; this only chooses what to print, and it
 * locates the marker by its own values rather than by position, so masking
 * shifting a column cannot make the gate quote the wrong obligation.
 */
function displayTail(display, needle, fallback) {
  const at = display.indexOf(needle);
  return at === -1 ? fallback : tail(display, at + needle.length);
}

/**
 * Markers on one already-masked, already-stripped line.
 *
 * A bare `OBLIGATION` that does not match the full pattern is a malformed marker
 * and fails the build. Silence there would be worse than no gate at all: an
 * unrecognised obligation looks exactly like coverage.
 */
export function parseLine(text, display = text) {
  const obligations = [];
  const closures = [];
  const malformed = [];

  const full = [...text.matchAll(OBLIGATION_FULL)];
  const words = [...text.matchAll(OBLIGATION_WORD)];
  const covered = new Set(full.map((m) => m.index));
  for (const word of words) {
    if (covered.has(word.index)) continue;
    malformed.push({
      keyword: 'OBLIGATION',
      text: tail(text, word.index),
      reason: 'does not match `OBLIGATION due=YYYY-MM-DD owner=<owner>`',
    });
  }
  for (const match of full) {
    const [, due, owner] = match;
    if (!OWNER_TOKEN.test(owner)) {
      malformed.push({
        keyword: 'OBLIGATION',
        text: tail(text, match.index),
        reason: `owner "${owner}" is not one token matching [A-Za-z0-9_./-]+`,
      });
      continue;
    }
    obligations.push({
      due,
      owner,
      text: displayTail(display, match[0], tail(text, match.index + match[0].length)),
    });
  }

  const closureFull = [...text.matchAll(CLOSURE_FULL)];
  const closureWords = [...text.matchAll(CLOSURE_WORD)];
  const closureCovered = new Set(closureFull.map((m) => m.index));
  for (const word of closureWords) {
    if (closureCovered.has(word.index)) continue;
    malformed.push({
      keyword: word[1],
      text: tail(text, word.index),
      reason: `\`${word[1]}\` is not followed by an ISO date`,
    });
  }
  for (const match of closureFull) {
    closures.push({
      kind: match[1],
      date: match[2],
      text: displayTail(display, match[0], tail(text, match.index + match[0].length)),
    });
  }

  return { obligations, closures, malformed };
}

/* -------------------------------------------------------------------- scan -- */

/**
 * Parse one document into blocks of markers. A marker outside every list item
 * still gets a block of its own: ADR-0009 says an obligation is a list item, but
 * an obligation written in a paragraph must be checked rather than ignored -
 * ignoring it is the silent non-recognition the malformed rule exists to stop.
 */
export function scanDocument(file, source) {
  const lines = source.split(/\r?\n/);
  const { masked, fenced } = maskCode(lines);
  const items = listItemBlocks(lines, fenced);
  const findings = [];
  const blocks = new Map();

  const blockFor = (lineIndex) => {
    let owner = null;
    for (const item of items) {
      if (item.start <= lineIndex && lineIndex <= item.end) owner = item;
    }
    const key = owner === null ? `line:${lineIndex}` : `item:${owner.start}`;
    if (!blocks.has(key)) {
      blocks.set(key, {
        file,
        line: (owner === null ? lineIndex : owner.start) + 1,
        obligations: [],
        closures: [],
      });
    }
    return blocks.get(key);
  };

  for (let i = 0; i < lines.length; i += 1) {
    if (fenced[i]) continue;
    const text = stripEmphasis(masked[i]);
    if (!/OBLIGATION|DISCHARGED|VOIDED/.test(text)) continue;
    const parsed = parseLine(text, stripEmphasis(lines[i]));
    for (const bad of parsed.malformed) {
      findings.push({
        kind: 'malformed marker',
        file,
        line: i + 1,
        owner: '-',
        detail: bad.reason,
        text: bad.text,
      });
    }
    if (parsed.obligations.length === 0 && parsed.closures.length === 0) continue;
    const block = blockFor(i);
    for (const obligation of parsed.obligations) block.obligations.push({ ...obligation, line: i + 1 });
    for (const closure of parsed.closures) block.closures.push({ ...closure, line: i + 1 });
  }

  return { findings, blocks: [...blocks.values()] };
}

/** Turn one block's markers into failures and open items. */
export function judgeBlock(block, today) {
  const findings = [];
  const open = [];
  const closed = [];

  const kinds = new Set(block.closures.map((c) => c.kind));
  if (kinds.has('DISCHARGED') && kinds.has('VOIDED')) {
    findings.push({
      kind: 'double closure',
      file: block.file,
      line: block.closures[0].line,
      owner: block.obligations[0]?.owner ?? '-',
      detail: 'block claims both DISCHARGED and VOIDED; a reader cannot tell whether the work happened',
      text: block.obligations[0]?.text ?? block.closures[0].text,
    });
  }

  for (const closure of block.closures) {
    if (!isRealDate(closure.date)) {
      findings.push({
        kind: 'impossible date',
        file: block.file,
        line: closure.line,
        owner: block.obligations[0]?.owner ?? '-',
        detail: `${closure.kind} ${closure.date} is not a real calendar date`,
        text: closure.text,
      });
    } else if (daysBetween(today, closure.date) > 0) {
      findings.push({
        kind: 'future closure',
        file: block.file,
        line: closure.line,
        owner: block.obligations[0]?.owner ?? '-',
        detail: `${closure.kind} ${closure.date} is dated after today (${today})`,
        text: closure.text,
      });
    }
    if (block.obligations.length === 0) {
      findings.push({
        kind: 'dangling closure',
        file: block.file,
        line: closure.line,
        owner: '-',
        detail: `${closure.kind} with no OBLIGATION in the same list item`,
        text: closure.text,
      });
    }
  }

  for (const obligation of block.obligations) {
    if (!isRealDate(obligation.due)) {
      findings.push({
        kind: 'impossible date',
        file: block.file,
        line: obligation.line,
        owner: obligation.owner,
        detail: `due=${obligation.due} is not a real calendar date`,
        text: obligation.text,
      });
      continue;
    }
    if (block.closures.length > 0) {
      closed.push({ ...obligation, file: block.file, closedBy: block.closures[0].kind });
      continue;
    }
    const remaining = daysBetween(today, obligation.due);
    if (remaining < 0) {
      findings.push({
        kind: 'overdue',
        file: block.file,
        line: obligation.line,
        owner: obligation.owner,
        detail: `due ${obligation.due}, ${-remaining} day(s) ago, neither DISCHARGED nor VOIDED`,
        text: obligation.text,
      });
    } else {
      open.push({ ...obligation, file: block.file, remaining });
    }
  }

  return { findings, open, closed };
}

/** Every `*.md` under `dir`, recursively, sorted so output is deterministic. */
export function markdownFiles(dir) {
  const found = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.md')) found.push(full);
    }
  };
  walk(dir);
  return found;
}

/** The whole check over a directory of documents. */
export function checkObligations(docsDir, today) {
  const findings = [];
  const open = [];
  const closed = [];

  for (const file of markdownFiles(docsDir)) {
    const scan = scanDocument(file, readFileSync(file, 'utf8'));
    findings.push(...scan.findings);
    for (const block of scan.blocks) {
      const judged = judgeBlock(block, today);
      findings.push(...judged.findings);
      open.push(...judged.open);
      closed.push(...judged.closed);
    }
  }

  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  open.sort((a, b) => a.due.localeCompare(b.due) || a.file.localeCompare(b.file) || a.line - b.line);
  return { findings, open, closed };
}

/* --------------------------------------------------------------------- cli -- */

function parseArgs(argv) {
  let docs = join(ROOT, 'docs');
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--docs') {
      const value = argv[i + 1];
      if (value === undefined) throw new Error('--docs needs a directory');
      docs = resolve(value);
      i += 1;
    } else {
      throw new Error(`unknown argument "${argv[i]}"`);
    }
  }
  return { docs };
}

function show(path, docs) {
  const fromRoot = relative(ROOT, path);
  return fromRoot.startsWith('..') ? relative(docs, path) : fromRoot;
}

function main(argv) {
  let docs;
  let today;
  try {
    ({ docs } = parseArgs(argv));
    today = resolveToday();
  } catch (error) {
    console.error(`obligation-gate: FAILED - ${error.message}`);
    return 1;
  }

  if (!statSync(docs, { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`obligation-gate: FAILED - "${docs}" is not a directory.`);
    return 1;
  }

  const { findings, open, closed } = checkObligations(docs, today);
  const scanned = markdownFiles(docs).length;

  if (findings.length > 0) {
    console.error(`obligation-gate: FAILED - ${findings.length} finding(s) in ${scanned} document(s). Today is ${today} (UTC).\n`);
    for (const finding of findings) {
      console.error(
        `  ${show(finding.file, docs)}:${finding.line}  ${finding.kind}  owner=${finding.owner}\n` +
          `      ${finding.detail}\n` +
          `      ${finding.text === '' ? '(no text)' : finding.text}`,
      );
    }
    if (findings.some((finding) => finding.kind === 'overdue')) {
      console.error(
        '\n  NOTHING IN THE TREE HAS TO HAVE CHANGED FOR THIS TO FAIL. This gate reads the\n' +
          '  clock, so an obligation falls due between two runs of the same commit and the\n' +
          '  next pull request goes red with no code change. That is ADR-0009 working as\n' +
          '  specified, not a broken build, and you are the person it meant to tell.',
      );
    }
    console.error(
      '\n  ADR-0009 - close an obligation IN THE SAME LIST ITEM with `DISCHARGED <date>`\n' +
        '  (the work was done, followed by the evidence) or `VOIDED <date>` (the premise\n' +
        '  went away, followed by what removed it). Re-dating with a note saying why is\n' +
        '  legitimate. Deleting the line is not how an obligation ends, and silencing this\n' +
        '  gate is not either.\n' +
        '  TRUENORTH_OBLIGATION_TODAY=YYYY-MM-DD overrides "today", for testing the gate.',
    );
    if (open.length > 0) reportOpen(open, docs, today, console.error);
    return 1;
  }

  console.log(
    `obligation-gate: OK - ${scanned} document(s), ${open.length} open, ${closed.length} closed. Today is ${today} (UTC).`,
  );
  reportOpen(open, docs, today, console.log);
  return 0;
}

function reportOpen(open, docs, today, write) {
  if (open.length === 0) {
    write('  No open obligations.');
    return;
  }
  write(`\n  Open obligations, soonest first (today ${today}):`);
  for (const item of open) {
    const days = item.remaining === 0 ? 'due today' : `${item.remaining} day(s) left`;
    write(
      `    ${item.due}  ${days.padEnd(14)} owner=${item.owner.padEnd(10)} ` +
        `${show(item.file, docs)}:${item.line}\n        ${item.text}`,
    );
  }
}

if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
