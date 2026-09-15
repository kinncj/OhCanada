import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import rigJson from '@content/characters/rig.json';
import type { RigDocument } from '@application/ports';
import type { CreatorArt, CreatorArtRequest } from '@ui/character-creator';

import { creatorSlots } from '../../../app/bootstrap/character-slots';
import {
  CREATOR_COSTUME,
  creatorArt,
  type CreatorArtBackend,
} from '../../../app/bootstrap/creator-art';

const LEVELS = new URL('../../../content/levels/', import.meta.url);

/**
 * The join between the creator's host and the renderer that draws in it
 * (ADR-0040). Small on purpose; what it must get right is *which* rig the
 * picture is dressed from, because a picture dressed from a different document
 * than the one the groups were built from could offer an option it cannot draw.
 */

const RIG = rigJson as unknown as RigDocument;

const art: CreatorArt = { draw: () => undefined, setMotion: () => undefined, destroy: () => undefined };

const request: CreatorArtRequest = {
  selection: { skin: 'skin-3' },
  motion: 'full',
  onStatus: () => undefined,
};

describe('the creator art wiring', () => {
  it('hands the backend the host, the request and the shipped rig, and returns what it draws with', () => {
    const backend = vi.fn<CreatorArtBackend>(() => art);
    const host = {} as HTMLElement;

    const drawn = creatorArt(backend)(host, request);

    expect(drawn).toBe(art);
    expect(backend).toHaveBeenCalledTimes(1);
    const [givenHost, givenRequest, deps] = backend.mock.calls[0] ?? [];
    expect(givenHost).toBe(host);
    expect(givenRequest).toBe(request);
    expect(deps?.rig).toBe(RIG);
  });

  it("dresses the picture from the rig the creator's groups are built from", () => {
    const backend = vi.fn<CreatorArtBackend>(() => art);
    creatorArt(backend)({} as HTMLElement, request);
    const rig = backend.mock.calls[0]?.[2].rig;
    const declared = Object.keys(rig?.slots ?? {});

    const offered = creatorSlots('en').map((slot) => slot.id);
    expect(offered.length).toBeGreaterThan(0);
    for (const slot of offered) expect(declared, slot).toContain(slot);
  });

  it('dresses from another rig only when it is handed one', () => {
    const backend = vi.fn<CreatorArtBackend>(() => art);
    const other = { ...RIG, version: 'fixture' } as unknown as RigDocument;

    creatorArt(backend, other)({} as HTMLElement, request);
    expect(backend.mock.calls[0]?.[2].rig).toBe(other);
  });

  it('dresses the picture in the costume most levels put on the player, which no player chooses', () => {
    /* The audit's picture was always the winter parka, which eight levels of ten
       no longer draw. The creator offers no costume choice, because the rig says
       no player makes one; it shows what the player will wear most. */
    const backend = vi.fn<CreatorArtBackend>(() => art);
    creatorArt(backend)({} as HTMLElement, request);
    expect(backend.mock.calls[0]?.[2].costume).toBe(CREATOR_COSTUME);

    const slot = (RIG.slots as unknown as Record<string, { options: string[]; playerSelectable: boolean }>)[
      'costume'
    ];
    expect(slot?.options).toContain(CREATOR_COSTUME);
    expect(slot?.playerSelectable).toBe(false);
    expect(creatorSlots('en').map((offered) => offered.id)).not.toContain('costume');

    const worn = new Map<string, number>();
    for (const name of readdirSync(fileURLToPath(LEVELS)).filter((file) => file.endsWith('.json'))) {
      const level = JSON.parse(readFileSync(new URL(name, LEVELS), 'utf8')) as { playerCostume?: string };
      if (level.playerCostume === undefined) continue;
      worn.set(level.playerCostume, (worn.get(level.playerCostume) ?? 0) + 1);
    }
    const ranked = [...worn.entries()].sort((a, b) => b[1] - a[1]);
    expect(ranked.length, 'no level document declares playerCostume').toBeGreaterThan(0);
    expect(ranked[0]?.[0], JSON.stringify(ranked)).toBe(CREATOR_COSTUME);
    expect(ranked[0]?.[1] ?? 0).toBeGreaterThan(ranked[1]?.[1] ?? 0);
  });
});
