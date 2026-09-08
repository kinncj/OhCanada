import { describe, expect, it, vi } from 'vitest';

import { createStorageWarning } from '@ui/storage-warning';

import { buildPage } from './support/fake-dom';

/**
 * `docs/stories/TN-HUD-03`, and `OQ-HUD-3`: the warning belongs to the *page*,
 * not to the level. One element, drawn inside `hud` when there is a HUD and
 * above the character creator's card when there is not — which is what makes
 * "announced once" true rather than "announced once per screen".
 *
 * The HUD's own use of it is covered in `hud.test.ts`. This file is the element
 * on its own, which is how `TN-CREATOR-03` needs it before any level exists.
 */

function mount(overrides: Partial<Parameters<typeof createStorageWarning>[1]> = {}) {
  const page = buildPage();
  const announce = vi.fn();
  const onExport = vi.fn();
  const warning = createStorageWarning(page.host, {
    locale: 'en',
    announce,
    onExport,
    ...overrides,
  });
  return { page, warning, announce, onExport, at: () => page.doc.byTestId('storage-warning') };
}

describe('the storage warning on its own', () => {
  it('is nothing at all until it is raised', () => {
    const { warning, at, announce } = mount();
    expect(warning.raised).toBe(false);
    expect(warning.element).toBeNull();
    expect(at()).toBeNull();
    expect(announce).not.toHaveBeenCalled();
  });

  it('mounts where it was told to, not inside a HUD it assumed', () => {
    const { page, warning } = mount();
    warning.raise();
    expect(page.ui.children.map((child) => child.getAttribute('data-testid'))).toContain(
      'storage-warning',
    );
  });

  it('raises once, however many writes fail', () => {
    const { warning, page, announce } = mount();
    warning.raise();
    warning.raise();
    warning.raise();

    expect(page.doc.documentElement.querySelectorAll('[data-testid="storage-warning"]')).toHaveLength(
      1,
    );
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('draws no export control when there is nowhere to export to', () => {
    const page = buildPage();
    const warning = createStorageWarning(page.host, { locale: 'en' });
    warning.raise();
    expect(page.doc.byTestId('save-export')).toBeNull();
  });

  it('redraws in the other language, export control and all', () => {
    const { warning, at, page } = mount();
    warning.raise();
    warning.setLocale('fr');

    expect(at()?.textContent).toContain("Ce navigateur n'enregistre pas votre progression.");
    expect(at()?.getAttribute('lang')).toBe('fr');
    expect(page.doc.byTestId('save-export')?.textContent).toBe('Enregistrer dans un fichier');
  });

  it('changes language quietly while it is down', () => {
    const { warning, at } = mount();
    warning.setLocale('fr');
    expect(at()).toBeNull();

    warning.raise();
    expect(at()?.textContent).toContain('Ce navigateur');
  });

  it('is gone after destroy, leaving nothing hidden behind', () => {
    const { warning, at } = mount();
    warning.raise();
    warning.destroy();
    expect(at()).toBeNull();
    expect(warning.raised).toBe(false);
  });
});
