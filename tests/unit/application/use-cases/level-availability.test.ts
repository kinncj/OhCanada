/**
 * Whether a level may open offline (ADR-0034, amended 2026-09-15).
 *
 * The defect these rules close: Halifax opened offline for the first time drew
 * flat bands and no landmark, and nothing said why. Each case below is one of
 * the three rules in `level-availability.ts`, and the last two are the ones a
 * shortcut would get wrong: an unreadable cache is not an empty one.
 */

import { describe, expect, it } from 'vitest';

import type { Connectivity, LevelArtCache } from '@application/ports/level-art';
import { checkLevelAvailability } from '@application/use-cases/level-availability';
import { appErr, ok, type Result } from '@common/result';

interface ArtProbe extends LevelArtCache {
  readonly asked: string[];
}

const probe = (answer: () => Promise<Result<readonly string[]>>): ArtProbe => {
  const asked: string[] = [];
  return {
    asked,
    missingLevelArt(levelId: string): Promise<Result<readonly string[]>> {
      asked.push(levelId);
      return answer();
    },
  };
};

const online: Connectivity = { isOnline: () => true };
const offline: Connectivity = { isOnline: () => false };

describe('checkLevelAvailability', () => {
  it('opens a level online without asking the cache anything', async () => {
    const art = probe(() => Promise.resolve(ok(['/OhCanada/img/halifax-sky@1x.webp'])));
    const answer = await checkLevelAvailability({ connectivity: online, art }, 'halifax');

    expect(answer).toEqual({ kind: 'open' });
    /* Online, a file that was never kept is fetched as it always was: the online
       path must cost nothing and change nothing. */
    expect(art.asked).toEqual([]);
  });

  it('opens a level offline when every file it draws is in the cache', async () => {
    const art = probe(() => Promise.resolve(ok([])));
    const answer = await checkLevelAvailability({ connectivity: offline, art }, 'halifax');

    expect(answer).toEqual({ kind: 'open' });
    expect(art.asked).toEqual(['halifax']);
  });

  it('does not open a level offline when a file it draws is missing, and names the files', async () => {
    const missing = [
      '/OhCanada/img/halifax-ground-boardwalk-edge@1x.50d51662.webp',
      '/OhCanada/atlas/halifax@1x.1234abcd.webp',
    ];
    const art = probe(() => Promise.resolve(ok(missing)));
    const answer = await checkLevelAvailability({ connectivity: offline, art }, 'halifax');

    expect(answer).toEqual({ kind: 'needsConnection', missing, known: true });
  });

  it('does not open a level offline when the cache cannot say, because that is not "nothing missing"', async () => {
    const art = probe(() =>
      Promise.resolve(appErr('unsupported', 'renderer.art.noCache', 'no Cache Storage', {})),
    );
    const answer = await checkLevelAvailability({ connectivity: offline, art }, 'halifax');

    expect(answer).toEqual({ kind: 'needsConnection', missing: [], known: false });
  });

  it('treats a cache that throws the same way as one that cannot say', async () => {
    const art = probe(() => Promise.reject(new Error('the cache went away')));
    const answer = await checkLevelAvailability({ connectivity: offline, art }, 'halifax');

    expect(answer).toEqual({ kind: 'needsConnection', missing: [], known: false });
  });
});
