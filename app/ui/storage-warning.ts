/**
 * The one place the game admits this browser is not keeping the player's
 * progress.
 *
 * `TN-HUD-03` owns it. Three of its scenarios are about what this element is
 * *not*, and each of them is a defect this project has already shipped once:
 *
 *  - **Not a second announcer.** It carries no `aria-live` of its own; exactly
 *    one element on the page has that attribute (`app/ui/live-region.ts`), and
 *    the warning is spoken through it once, when it is raised. Two polite live
 *    regions is a well-known way to make a screen reader go quiet.
 *  - **Not present when nothing is wrong.** Not hidden, not `display: none`,
 *    not `[hidden]` — *absent*. `TN-HUD-03`: "it is not merely hidden behind a
 *    style rule that something else can override". A CSS rule overriding
 *    `[hidden]` is precisely how an empty unnamed button reached the question
 *    card and axe caught it. {@link StorageWarning.raise} builds the element and
 *    {@link StorageWarning.clear} removes it, so there is no hidden state for a
 *    stylesheet to reveal.
 *  - **Not something to dismiss.** There is no close control. It never has to be
 *    got out of the way to carry on playing.
 *
 * It belongs to the page rather than to the level (`OQ-HUD-3`): one element,
 * drawn inside `hud` when there is a HUD and above the character creator's card
 * when there is not. One element is what makes "announced once" true.
 *
 * DOM only (ADR-0005).
 */

import { text, type UiLocale } from './copy';
import { button, element } from './dom';
import { injectScreenStyles } from './screen-styles';

export interface StorageWarningOptions {
  readonly locale: UiLocale;
  /** The one live region. */
  readonly announce?: (message: string, lang?: string) => void;
  /**
   * `TN-HUD-03`: "a Save to a file control is reachable from the warning or from
   * Settings". Omit it and no button is drawn — a control that does nothing is
   * worse than a missing one.
   */
  readonly onExport?: () => void;
}

export interface StorageWarning {
  /** The element, or `null` when nothing is wrong. Not a hidden element: none. */
  readonly element: HTMLElement | null;
  readonly raised: boolean;
  /** Idempotent: a second failed write does not stack a second warning. */
  raise(): void;
  clear(): void;
  setLocale(locale: UiLocale): void;
  destroy(): void;
}

export function createStorageWarning(
  host: HTMLElement,
  options: StorageWarningOptions,
): StorageWarning {
  const doc = host.ownerDocument;
  injectScreenStyles(doc);

  let locale = options.locale;
  let node: HTMLElement | null = null;

  const build = (): HTMLElement => {
    const title = element(doc, 'p', {
      className: 'tn-hud__warning-title',
      text: text(locale, 'storage.warning'),
    });
    const help = element(doc, 'p', { text: text(locale, 'storage.warning.help') });

    const children: HTMLElement[] = [title, help];
    if (options.onExport !== undefined) {
      children.push(
        button(doc, {
          testId: 'save-export',
          text: text(locale, 'save.export'),
          onClick: options.onExport,
        }),
      );
    }

    /*
     * A `<p>` pair inside a plain container, with no role: `TN-HUD-07` requires
     * it to be "read as static text with both of its sentences". `role="alert"`
     * would make it an assertive live region — a second announcer, read again on
     * every re-render, and interrupting whatever the player was being told.
     */
    return element(doc, 'div', {
      testId: 'storage-warning',
      className: 'tn-hud__warning',
      lang: locale,
      children,
    });
  };

  return {
    get element(): HTMLElement | null {
      return node;
    },
    get raised(): boolean {
      return node !== null;
    },

    raise(): void {
      if (node !== null) return;
      node = build();
      host.append(node);
      /* Once, on the way up. Not on every re-render, and not again while it
         stays raised: `TN-HUD-07`, "it is not read again every time the player
         answers a question". */
      options.announce?.(
        `${text(locale, 'storage.warning')} ${text(locale, 'storage.warning.help')}`,
        locale,
      );
    },

    clear(): void {
      node?.remove();
      node = null;
    },

    setLocale(next): void {
      locale = next;
      if (node === null) return;
      /* Rebuilt rather than patched: the export button may or may not be there,
         and a redraw that has to remember which is a redraw that will forget.
         The warning owns its container, so appending after the removal puts it
         back where it was. */
      node.remove();
      node = build();
      host.append(node);
    },

    destroy(): void {
      node?.remove();
      node = null;
    },
  };
}
