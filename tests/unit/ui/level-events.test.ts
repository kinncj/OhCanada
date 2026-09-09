import { describe, expect, it, vi } from 'vitest';

import { text, type UiLocale } from '@ui/copy';
import { createLevelAnnouncer, SPEAKS, type LevelEvent, type LevelEventName } from '@ui/level-events';

/**
 * `docs/stories/TN-LEVEL-08`: the canvas is silent, the live region is not.
 *
 * The interesting assertions here are about what is *not* said. The canvas is
 * `aria-hidden`, so the live region is the only channel a screen-reader user
 * has — which makes it the easiest thing in the game to flood. `player/moved`
 * fires continuously.
 */

const TARGETS = {
  'npc.officer': { prompt: 'Talk to the officer' },
  'poi.parliament-hill': { prompt: 'Look at Parliament Hill' },
} as const;

function wire(overrides: Partial<Parameters<typeof createLevelAnnouncer>[1]> = {}) {
  const listeners: ((event: LevelEvent) => void)[] = [];
  const announce = vi.fn();
  const onPrompt = vi.fn();
  /*
   * The failing level's own title, read at the moment of the failure and in the
   * language in force then — the composition root passes exactly this shape.
   * Halifax, because the announcer used to read one row called
   * `level.error.title` and tell every player that Ottawa had not loaded.
   */
  let locale: UiLocale = 'en';
  const failure = (): string => text(locale, 'level.halifax.error.title');

  const announcer = createLevelAnnouncer(
    (listener) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      };
    },
    {
      locale: 'en',
      announce,
      arrival: 'You are on the Rideau Canal in Ottawa. Skating.',
      failure,
      targets: TARGETS,
      onPrompt,
      ...overrides,
    },
  );

  const setLocale = (next: UiLocale): void => {
    locale = next;
    announcer.setLocale(next);
  };

  const emit = (name: LevelEventName, detail?: string): void => {
    for (const listener of [...listeners]) {
      listener(detail === undefined ? { name } : { name, detail });
    }
  };

  return { announcer, announce, onPrompt, emit, listeners, setLocale };
}

describe('what the level says out loud', () => {
  it('announces arriving, in the language it is speaking', () => {
    const { announce, emit } = wire();
    emit('level/ready');
    expect(announce).toHaveBeenCalledWith(
      'You are on the Rideau Canal in Ottawa. Skating.',
      'en',
    );
  });

  it('announces a failed load with the words the error card shows, for that level', () => {
    /* `TN-WAIT-02`: "a failure never names another level". The title is data
       from the caller, because this module cannot know which level is loading. */
    const { announce, emit } = wire();
    emit('level/failed');
    expect(announce).toHaveBeenCalledWith('We could not load Halifax.', 'en');
    expect(announce).not.toHaveBeenCalledWith('We could not load Ottawa.', 'en');
  });

  it('does not say the failure again when Try again fails the same way', () => {
    /*
     * `TN-WAIT-05`: "it is not repeated when Try again is pressed and fails
     * again". The waiting screen comes back and takes focus between the two, so
     * the player is not left in silence — a live region repeating a sentence a
     * dialog has just read is the double-speaking this module avoids elsewhere.
     */
    const { announce, emit } = wire();
    emit('level/failed');
    emit('level/failed');
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('says it again after a level has arrived in between', () => {
    /* A level that opened and later failed is news, not a repeat. */
    const { announce, emit } = wire();
    emit('level/failed');
    emit('level/ready');
    emit('level/failed');
    expect(announce.mock.calls.filter((call) => call[0] === 'We could not load Halifax.')).toHaveLength(2);
  });

  it('names the thing in reach and what to do about it', () => {
    const { announce, onPrompt, emit } = wire();
    emit('poi/entered', 'npc.officer');

    expect(announce).toHaveBeenCalledWith('Talk to the officer', 'en');
    expect(onPrompt).toHaveBeenCalledWith({ prompt: 'Talk to the officer' }, 'npc.officer');
  });

  it('withdraws the offer without announcing the withdrawal', () => {
    const { announce, onPrompt, emit } = wire();
    emit('poi/entered', 'npc.officer');
    announce.mockClear();

    emit('poi/left', 'npc.officer');
    expect(onPrompt).toHaveBeenLastCalledWith(null, null);
    expect(announce).not.toHaveBeenCalled();
  });

  it('does not let one thing leaving withdraw a different thing offer', () => {
    const { onPrompt, emit } = wire();
    emit('poi/entered', 'poi.parliament-hill');
    onPrompt.mockClear();

    emit('poi/left', 'npc.officer');
    expect(onPrompt).not.toHaveBeenCalled();
  });

  it('says nothing at all for movement, however much of it there is', () => {
    /* TN-LEVEL-08, "the announcements do not flood". `player/moved` is emitted
       while a hold lasts; an announcer that spoke for it would talk over
       everything else in the level. */
    const { announce, emit } = wire();
    for (let index = 0; index < 100; index += 1) {
      emit('player/moved');
      emit('player/jumped');
      emit('player/braked');
      emit('player/stopped');
    }
    expect(announce).not.toHaveBeenCalled();
  });

  it('leaves the dialogue and the card to announce themselves', () => {
    /* A modal takes focus and is read on arrival; announcing it here as well is
       how a screen-reader user hears everything twice. */
    const { announce, emit } = wire();
    emit('npc/engaged', 'npc.officer');
    emit('poi/engaged', 'poi.parliament-hill');
    expect(announce).not.toHaveBeenCalled();
  });

  it('offers nothing for a target it has no words for', () => {
    /* A detail this UI has never heard of is not an excuse to draw "Interact". */
    const { announce, onPrompt, emit } = wire();
    emit('poi/entered', 'poi.unknown');
    emit('poi/entered');
    expect(announce).not.toHaveBeenCalled();
    expect(onPrompt).not.toHaveBeenCalled();
  });

  it('follows a language change without being rebuilt', () => {
    const { announce, emit, setLocale } = wire();
    setLocale('fr');
    emit('level/failed');
    expect(announce).toHaveBeenCalledWith("Nous n'avons pas pu charger Halifax.", 'fr');
  });

  it('stops listening when it is destroyed', () => {
    const { announcer, announce, emit, listeners } = wire();
    announcer.destroy();
    expect(listeners).toHaveLength(0);
    emit('level/ready');
    expect(announce).not.toHaveBeenCalled();
  });
});

describe('the table that decides who speaks', () => {
  it('has a decision for every event the level emits', () => {
    /*
     * `SPEAKS` is a `Record` over the whole union, so this is already a compile
     * error rather than a test — asserted anyway because the type is what a
     * future refactor can weaken, and the failure mode is a new event that
     * silently says nothing.
     */
    const names: LevelEventName[] = [
      'level/ready',
      'level/failed',
      'player/moved',
      'player/stopped',
      'player/jumped',
      'player/braked',
      'poi/entered',
      'poi/left',
      'poi/engaged',
      'npc/engaged',
    ];
    expect(Object.keys(SPEAKS).sort()).toEqual([...names].sort());
  });

  it('keeps every movement event silent', () => {
    for (const name of Object.keys(SPEAKS) as LevelEventName[]) {
      if (!name.startsWith('player/')) continue;
      expect(SPEAKS[name], `${name} would flood the live region`).toBe(false);
    }
  });
});
