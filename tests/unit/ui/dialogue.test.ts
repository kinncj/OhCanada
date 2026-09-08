import { describe, expect, it, vi } from 'vitest';

import { createDialogue } from '@ui/dialogue';

import { buildPage, FakeEvent, press, type FakeElement, type FakePage } from './support/fake-dom';

/**
 * NPC dialogue, specified across `TN-QUEST-parliament-hill.md` (`TN-QUEST-01`,
 * `-04`, `-06`, `-07`, `-08`, `-10`) and `TN-LEVEL-ottawa.md`.
 *
 * The officer's lines are content and are passed in; the strings below are the
 * ones those stories write, used as fixtures so a wording change in the story is
 * visible here as a failing test rather than as nothing.
 */

const GREETING = "Hello! Welcome to Ottawa. Ottawa is Canada's capital city.";
const OFFER =
  'Skate up the canal to Parliament Hill and find the Peace Tower. Then answer three questions.';

interface Fixture {
  readonly page: FakePage;
  readonly dialogue: ReturnType<typeof createDialogue>;
  readonly root: FakeElement;
  readonly onClose: ReturnType<typeof vi.fn>;
  readonly onAccept: ReturnType<typeof vi.fn>;
  readonly onDecline: ReturnType<typeof vi.fn>;
  at(testId: string): FakeElement | null;
}

function open(
  overrides: Partial<Parameters<typeof createDialogue>[1]> = {},
  withChoices = true,
): Fixture {
  const page = buildPage();
  const onClose = vi.fn();
  const onAccept = vi.fn();
  const onDecline = vi.fn();

  const dialogue = createDialogue(page.host, {
    /* No story table names the speaker, so it is a required option rather than
       a string this module would have had to invent. */
    speakerName: 'Officer',
    locale: 'en',
    onClose,
    ...overrides,
  });

  dialogue.show({
    lines: [GREETING, OFFER],
    ...(withChoices
      ? {
          accept: { label: "Yes, let's go", onSelect: onAccept },
          decline: { label: 'Not now', onSelect: onDecline },
        }
      : { next: { label: 'Next', onSelect: vi.fn() } }),
  });

  const root = page.doc.byTestId('dialogue');
  if (root === null) throw new Error('the dialogue did not mount');

  return {
    page,
    dialogue,
    root,
    onClose,
    onAccept,
    onDecline,
    at: (testId) => root.byTestId(testId),
  };
}

describe('the dialogue', () => {
  it('is a modal dialog named after the speaker', () => {
    const { root, page } = open();
    expect(root.getAttribute('role')).toBe('dialog');
    expect(root.getAttribute('aria-modal')).toBe('true');
    expect(page.doc.getElementById(root.getAttribute('aria-labelledby') ?? '')?.textContent).toBe(
      'Officer',
    );
  });

  it('shows every line the speaker says, as separate paragraphs', () => {
    const { at } = open();
    const body = at('dialogue-text');
    expect(body?.children.length).toBe(2);
    expect(body?.textContent).toContain(GREETING);
    expect(body?.textContent).toContain(OFFER);
  });

  it('describes itself with what was said, so a screen reader hears it on open', () => {
    const { root, page } = open();
    const description = page.doc.getElementById(root.getAttribute('aria-describedby') ?? '');
    expect(description?.textContent).toContain(GREETING);
  });

  it('takes focus and holds it, with the level inert behind', () => {
    const { page, root } = open();
    expect(page.doc.activeElement).toBe(root);
    expect(page.game.inert).toBe(true);
    expect(page.live.inert).toBe(false);
  });

  it('offers accept and decline with the wording it was given', () => {
    const { at, onAccept, onDecline } = open();
    expect(at('dialogue-accept')?.textContent).toBe("Yes, let's go");
    expect(at('dialogue-decline')?.textContent).toBe('Not now');

    at('dialogue-accept')?.click();
    expect(onAccept).toHaveBeenCalledTimes(1);
    at('dialogue-decline')?.click();
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('offers a single way onward for a line with nothing to decide', () => {
    const { at } = open({}, false);
    expect(at('dialogue-next')?.textContent).toBe('Next');
    expect(at('dialogue-accept')).toBeNull();
    expect(at('dialogue-decline')).toBeNull();
  });

  it('closing is not declining', () => {
    /* TN-QUEST-04: "Leaving the dialogue without choosing is not a decline." */
    const { root, onClose, onDecline } = open();
    press(root, 'Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDecline).not.toHaveBeenCalled();
  });

  it('gives focus back to whatever engaged the speaker', () => {
    const page = buildPage();
    const prompt = page.doc.createElement('button');
    prompt.setAttribute('data-testid', 'interact-prompt');
    page.ui.append(prompt);
    prompt.focus();

    const dialogue = createDialogue(page.host, { speakerName: 'Officer', locale: 'en' });
    dialogue.show({ lines: [GREETING] });
    dialogue.hide();

    expect(page.doc.activeElement).toBe(prompt);
  });

  it('waits as long as the player likes', () => {
    /* TN-QUEST-01: "I leave the dialogue open and do nothing for two minutes …
       the dialogue is still open." Nothing in the module can close it. */
    const { dialogue, onClose } = open();
    expect(dialogue.visible).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('replaces its lines and its choices when the speaker says something else', () => {
    const { dialogue, at } = open();
    dialogue.show({ lines: ['Parliament Hill is that way. Keep going.'] });

    expect(at('dialogue-text')?.children.length).toBe(1);
    expect(at('dialogue-accept')).toBeNull();
  });

  it('changes speaker and language without being rebuilt', () => {
    const { dialogue, root } = open();
    dialogue.setSpeaker('Agent');
    dialogue.setLocale('fr');
    expect(root.textContent).toContain('Agent');
    expect(root.getAttribute('lang')).toBe('fr');
  });

  it('carries French copy exactly as the story writes it', () => {
    const page = buildPage();
    const dialogue = createDialogue(page.host, { speakerName: 'Agent', locale: 'fr' });
    dialogue.show({
      lines: ['Bonjour! Bienvenue à Ottawa. Ottawa est la capitale du Canada.'],
      accept: { label: "Oui, allons-y", onSelect: vi.fn() },
      decline: { label: 'Pas maintenant', onSelect: vi.fn() },
    });

    const root = page.doc.byTestId('dialogue');
    expect(root?.textContent).toContain('Bonjour! Bienvenue à Ottawa.');
    /* No space before "!" — Canadian French typography. */
    expect(/\s!/.test(root?.textContent ?? '')).toBe(false);
  });

  it('is answerable with one switch', () => {
    const clock = { now: 0 };
    const page = buildPage();
    const announce = vi.fn();
    const onAccept = vi.fn();
    const dialogue = createDialogue(page.host, {
      speakerName: 'Officer',
      locale: 'en',
      singleSwitch: true,
      holdMs: 600,
      now: () => clock.now,
      announce,
    });

    dialogue.show({
      lines: [OFFER],
      accept: { label: "Yes, let's go", onSelect: onAccept },
      decline: { label: 'Not now', onSelect: vi.fn() },
    });

    const tap = (heldMs: number): void => {
      page.doc.dispatchEvent(new FakeEvent('pointerdown'));
      clock.now += heldMs;
      page.doc.dispatchEvent(new FakeEvent('pointerup'));
    };

    tap(50);
    expect(announce).toHaveBeenCalledWith('Not now');
    tap(50);
    expect(announce).toHaveBeenCalledWith("Yes, let's go");
    tap(800);
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('can have the switch turned on and off while it is open', () => {
    const { dialogue, page } = open();
    dialogue.setSingleSwitch(true, 700);
    expect(page.doc.listenerCount('pointerup')).toBe(1);
    dialogue.setSingleSwitch(false);
    expect(page.doc.listenerCount('pointerup')).toBe(0);
  });

  it('leaves nothing behind when it is destroyed', () => {
    const { dialogue, page } = open();
    dialogue.destroy();
    expect(page.doc.byTestId('dialogue')).toBeNull();
    expect(page.game.inert).toBe(false);
  });
});
