import { describe, expect, it, vi } from 'vitest';

import type { LevelId } from '@domain/ids';
import type { MapEntry } from '@ui/level-select';
import { createSettingsStore, DEFAULT_SETTINGS } from '@ui/settings';
import { createShell } from '@ui/shell';

import { buildPage } from './support/fake-dom';

/**
 * ADR-0041: the shell hands the title screen the player's figure, which the
 * composition root paints. The shell decides nothing about it — it passes the
 * function through — and without one the title screen draws its landscape alone.
 */

const ENTRIES: readonly MapEntry[] = [
  { number: 1, id: 'halifax' as LevelId, built: true, unlocked: true },
  { number: 4, id: 'ottawa' as LevelId, built: true, unlocked: false },
];

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function mount(titleFigure?: () => Promise<string | null>) {
  const page = buildPage();
  const shell = createShell(page.host, {
    store: createSettingsStore(DEFAULT_SETTINGS),
    entries: ENTRIES,
    stampsToUnlock: 1,
    onPlayLevel: vi.fn(),
    ...(titleFigure === undefined ? {} : { titleFigure }),
  });
  return { page, shell };
}

describe('the title screen, through the shell', () => {
  it('draws the figure the composition root paints', async () => {
    const titleFigure = vi.fn(() => Promise.resolve('blob:https://kinncj.github.io/figure'));
    const { page, shell } = mount(titleFigure);
    shell.start();
    await flush();

    expect(titleFigure).toHaveBeenCalled();
    const frame = page.doc.byTestId('title-figure');
    expect(frame?.hidden).toBe(false);
    expect(frame?.getAttribute('aria-hidden')).toBe('true');
    expect(frame?.querySelector('img')?.getAttribute('src')).toBe('blob:https://kinncj.github.io/figure');
  });

  it('draws the landscape alone, and asks for nothing, when there is no figure to paint', async () => {
    const { page, shell } = mount();
    shell.start();
    await flush();

    expect(page.doc.byTestId('title-figure')?.hidden).toBe(true);
    expect(page.doc.byTestId('title-landscape')?.hidden).toBe(false);
  });

  it('keeps the title screen’s controls and focus exactly as they were', async () => {
    const withFigure = mount(() => Promise.resolve('blob:x'));
    const without = mount();
    withFigure.shell.start();
    without.shell.start();
    await flush();

    const controls = (page: ReturnType<typeof buildPage>): (string | null)[] =>
      (page.doc.byTestId('title-screen')?.querySelectorAll('button') ?? []).map((button) =>
        button.getAttribute('data-testid'),
      );
    expect(controls(withFigure.page)).toEqual(controls(without.page));
    expect(withFigure.page.doc.activeElement?.getAttribute('data-testid')).toBe(
      without.page.doc.activeElement?.getAttribute('data-testid'),
    );
  });
});
