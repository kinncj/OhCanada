import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { hasCopyRow, text } from '@ui/copy';

/**
 * Let go when the prompt appears, then tap it: it is still there, and it opens
 * the thing it named. ADR-0037, `TN-REACH-10`.
 *
 * The audit, on the live site: on Toronto "Talk to the guide" was gone by the
 * time it was tapped and the tap opened the streetcar; on Québec City the slide
 * overshot the Château Frontenac; on Ottawa the skater glided on past the locks
 * and the officer. One-thumb play has exactly one way to take a prompt — lift the
 * thumb off the glass and put it on the prompt — and a glide that carries the
 * player out of reach in between breaks the promise the prompt made.
 *
 * `tests/unit/adapters/phaser/auto-stop.test.ts` proves the rule against every
 * shipped level with the real strategy, including that at least one shipped mode
 * lets go in reach before its own stop line and so needs it. This file proves
 * that a real key, released on the shipped build the moment the prompt appears,
 * leaves the prompt up and the tap opening the right thing — on the bike level
 * and the toboggan level the audit named, and on the skating level where the
 * stop line is shorter than reach.
 *
 * Waits are on simulated frames and on the level's own trace, for the reason
 * `level-ottawa.spec.ts` gives: this suite renders on SwiftShader.
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

interface LevelFile {
  readonly id: string;
  readonly spawn: { readonly x: number };
  readonly locomotion: readonly { readonly interaction: { readonly reachPx: number } | null }[];
  readonly pois: readonly {
    readonly id: string;
    readonly name: { readonly en: string };
    readonly position: { readonly x: number };
  }[];
  readonly characters: readonly {
    readonly characterId: string;
    readonly position: { readonly x: number };
  }[];
}

interface Subject {
  readonly id: string;
  readonly x: number;
  readonly npc: boolean;
  /** What the engaged thing is called where it opens: the dialog's or the card's accessible name. */
  readonly name: string;
}

const levelFile = (id: string): LevelFile =>
  JSON.parse(readFileSync(`${REPO_ROOT}content/levels/${id}.json`, 'utf8')) as LevelFile;

const characterName = (id: string): string =>
  (
    JSON.parse(readFileSync(`${REPO_ROOT}content/characters/${id}.json`, 'utf8')) as {
      readonly name: { readonly en: string };
    }
  ).name.en;

/**
 * The first thing ahead of the spawn that is not already in reach there — the
 * thing a player riding off the spawn is heading for. Read from the document, so
 * moving a landmark does not rewrite this file.
 */
function headingFor(level: LevelFile): { readonly subject: Subject; readonly reach: number } {
  const reach = level.locomotion[0]?.interaction?.reachPx ?? 0;
  if (reach <= 0) throw new Error(`${level.id} spawns in a mode that can engage nothing`);
  const subjects: Subject[] = [
    ...level.pois.map((poi) => ({ id: poi.id, x: poi.position.x, npc: false, name: poi.name.en })),
    ...level.characters.map((character) => ({
      id: character.characterId,
      x: character.position.x,
      npc: true,
      name: characterName(character.characterId),
    })),
  ];
  const subject = subjects
    .filter((candidate) => candidate.x - level.spawn.x > reach)
    .sort((a, b) => a.x - b.x)[0];
  if (subject === undefined) throw new Error(`${level.id} places nothing ahead of its spawn out of reach`);
  return { subject, reach };
}

/** The words the prompt draws for a subject nobody has engaged yet (`TN-REACH`). */
function promptFor(subject: Subject): string {
  const own = `hud.interact.${subject.id}`;
  if (hasCopyRow(own)) return text('en', own as Parameters<typeof text>[1]);
  return text('en', subject.npc ? 'hud.interact.npc' : 'hud.interact.poi');
}

/* --------------------------------------------------------------- the probe -- */

interface Snapshot {
  readonly playerX?: number;
  readonly speed?: number;
}

const snapshot = (page: Page): Promise<Snapshot> =>
  page.evaluate(
    () => (window as unknown as { __tnScene: { snapshot: () => Snapshot } }).__tnScene.snapshot(),
  );

async function waitForIntent(page: Page, move: number): Promise<void> {
  await page.waitForFunction(
    (want: number) => {
      const recent = (
        window as unknown as { __tnScene: { frames: () => { intentMove: number }[] } }
      ).__tnScene
        .frames()
        .slice(-3);
      return recent.length === 3 && recent.every((frame) => frame.intentMove === want);
    },
    move,
    { timeout: 20_000 },
  );
}

/** Three frames in a row given `move` and moving the player not at all. */
async function waitForRest(page: Page, move: number): Promise<void> {
  await page.waitForFunction(
    (want: number) => {
      const recent = (
        window as unknown as {
          __tnScene: { frames: () => { intentMove: number; velocityX: number }[] };
        }
      ).__tnScene
        .frames()
        .slice(-3);
      return (
        recent.length === 3 &&
        recent.every((frame) => frame.intentMove === want && frame.velocityX === 0)
      );
    },
    move,
    { timeout: 45_000 },
  );
}

async function waitForSimulated(page: Page, seconds: number): Promise<void> {
  const since = await page.evaluate(
    () =>
      (window as unknown as { __tnScene: { frames: () => { frame: number }[] } }).__tnScene
        .frames()
        .at(-1)?.frame ?? -1,
  );
  await page.waitForFunction(
    ({ want, after }: { want: number; after: number }) =>
      (
        window as unknown as {
          __tnScene: { frames: () => { frame: number; dtSeconds: number }[] };
        }
      ).__tnScene
        .frames()
        .filter((frame) => frame.frame > after)
        .reduce((total, frame) => total + frame.dtSeconds, 0) >= want,
    { want: seconds, after: since },
    { timeout: 45_000 },
  );
}

/**
 * Hold right until the prompt reads `wanted`, and let go that instant.
 *
 * A held drive comes to rest at anything nearer on the way (ADR-0032) and waits
 * for a fresh press, so a stop that is not the one wanted is let go of and
 * pressed through, as a player heading on does.
 */
async function letGoWhenOffered(page: Page, wanted: string): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.keyboard.down('ArrowRight');
    let outcome: string;
    try {
      await waitForIntent(page, 1);
      const handle = await page.waitForFunction(
        (label: string) => {
          const prompt = document.querySelector('[data-testid="interact-prompt"]');
          if (prompt !== null && (prompt as HTMLElement).checkVisibility() && prompt.textContent === label) {
            return 'offered';
          }
          const recent = (
            window as unknown as {
              __tnScene: { frames: () => { intentMove: number; velocityX: number }[] };
            }
          ).__tnScene
            .frames()
            .slice(-3);
          const held =
            recent.length === 3 &&
            recent.every((frame) => frame.intentMove === 1 && frame.velocityX === 0);
          return held ? 'stopped' : false;
        },
        wanted,
        { timeout: 45_000, polling: 'raf' },
      );
      outcome = String(await handle.jsonValue());
    } finally {
      await page.keyboard.up('ArrowRight');
    }
    if (outcome === 'offered') return;
    await waitForIntent(page, 0);
  }
  throw new Error(`the prompt never read "${wanted}"`);
}

/* --------------------------------------------------------------- scenarios -- */

const CASES = [
  { title: 'the bike level', levelId: 'toronto' },
  { title: 'the toboggan level', levelId: 'quebec-city' },
  { title: 'the skating level, where the stop line is shorter than reach', levelId: 'ottawa' },
] as const;

test.describe('let go when the prompt appears, then tap it (ADR-0037, TN-REACH-10)', () => {
  for (const { title, levelId } of CASES) {
    test(`${title}: the prompt is still there, and it opens what it named`, async ({ page }) => {
      /* A traversal on a software rasteriser, not a computation. */
      test.slow();
      const level = levelFile(levelId);
      const { subject, reach } = headingFor(level);
      const wanted = promptFor(subject);

      await page.goto(`./?e2e=1&level=${level.id}`);
      await page.waitForSelector('[data-testid="playable"]');

      await letGoWhenOffered(page, wanted);

      /* The thumb is off the glass. Nothing is pressed from here on. */
      await waitForRest(page, 0);
      const restX = (await snapshot(page)).playerX ?? Number.NaN;
      await waitForSimulated(page, 0.6);
      expect(
        Math.abs(((await snapshot(page)).playerX ?? Number.NaN) - restX),
        'the player was at rest and then moved again with nothing pressed',
      ).toBeLessThan(1);

      const prompt = page.getByTestId('interact-prompt');
      await expect(
        prompt,
        `the prompt for "${subject.id}" was gone by the time the thumb could reach it: the glide ` +
          'carried the player out of reach after they let go',
      ).toHaveText(wanted);
      expect(
        Math.abs(restX - subject.x),
        `let go in reach of "${subject.id}" at ${String(subject.x)} and came to rest at ${String(Math.round(restX))}`,
      ).toBeLessThanOrEqual(reach);
      if (subject.npc) {
        /* Beside them, on the side the player came from — not inside them. */
        expect(restX, `came to rest on top of or past "${subject.id}"`).toBeLessThan(subject.x);
      }

      await prompt.tap();

      /*
       * What opened is the thing the prompt named. The audit's Toronto tap opened
       * the streetcar's card where the guide's dialogue was meant, so the kind of
       * modal and its accessible name are both asserted, and the other kind is
       * asserted absent.
       *
       * Not read off the scene probe's event trace. The prompt engages in
       * `app/bootstrap` (`TN-LEVEL-05`) and never passes through the scene, so the
       * trace records `npc/engaged` and `poi/engaged` only for the interact key
       * and a tap on the canvas; for the prompt it is empty by design, which is
       * what this spec's first version asserted against and failed on.
       */
      const opened = page.getByTestId(subject.npc ? 'dialogue' : 'poi-card');
      await expect(opened, `tapping "${wanted}" opened nothing`).toBeVisible();
      await expect(opened, 'the tap opened something other than what the prompt named').toHaveAccessibleName(
        subject.name,
      );
      await expect(page.getByTestId(subject.npc ? 'poi-card' : 'dialogue')).toBeHidden();
      /* And the engagement was recorded against the subject in reach: the offer
         behind the modal now says it is done (`TN-REACH-03`), which only engaging
         that subject can make it say. */
      await expect(
        prompt,
        `the tap did not record "${subject.id}" as engaged, so the offer still invites it`,
      ).toHaveText(text('en', 'hud.interact.done'));
    });
  }
});
