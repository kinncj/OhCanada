/**
 * The settings screen — language and every accessibility switch.
 *
 * `docs/stories/TN-SET-settings.md` is the acceptance criteria, and the reason
 * this screen is built before the other four: six of the seven slice-1 stories
 * open a scenario with "Given single-switch mode is on" or "Given text scaling
 * is 200 %", and a precondition nobody can set is not testable.
 *
 * What this screen does *not* do is save. `TN-SET-03` requires a setting to
 * apply even when the write fails, so applying and persisting are separate: this
 * screen writes to a {@link SettingsStore}, and whoever owns storage subscribes
 * to it and reports `progress/save-failed` on its own. The screen never tells
 * the player something was saved.
 *
 * DOM only (ADR-0005), no adapters, no scenes.
 */

import { labelled, percent, text, type CopyKey, type UiLocale } from './copy';
import { button, element } from './dom';
import { createScreen, type Screen } from './screen';
import {
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  TEXT_SCALE_STEP,
  type Settings,
  type SettingsStore,
} from './settings';

export interface SettingsScreenOptions {
  readonly store: SettingsStore;
  /** The one live region. */
  readonly announce?: (message: string) => void;
  /** Close and Escape both route here; the caller resumes the game. */
  readonly onClose?: () => void;
  /**
   * `OQ-SET-3`: the four volume controls have nothing to control until audio
   * ships, and "a control that does nothing is worse than a missing one". The
   * copy is transcribed and ready; this flag is how the audio agent turns the
   * section on in one line. Off in slice 1 — reported with the task.
   */
  readonly showSound?: boolean;
  /** Injected for tests, and for a switch user's own hold threshold. */
  readonly now?: () => number;
}

export interface SettingsScreen {
  readonly element: HTMLElement;
  readonly visible: boolean;
  show(): void;
  hide(): void;
  destroy(): void;
}

/** One row of the screen, so re-rendering on a language change is mechanical. */
interface Localised {
  refresh(locale: UiLocale): void;
}

/** The settings that are a switch. Typed so `store.toggle` needs no cast. */
type BooleanSettingKey = {
  [K in keyof Settings]-?: Settings[K] extends boolean ? K : never;
}[keyof Settings];

const SWITCHES: readonly {
  readonly key: BooleanSettingKey;
  readonly testId: string;
  readonly label: CopyKey;
  readonly help?: CopyKey;
}[] = [
  {
    key: 'autoMove',
    testId: 'setting-auto-move',
    label: 'settings.autoMove',
    help: 'settings.autoMove.help',
  },
  {
    key: 'singleSwitch',
    testId: 'setting-single-switch',
    label: 'settings.singleSwitch',
    help: 'settings.singleSwitch.help',
  },
  { key: 'reducedMotion', testId: 'setting-reduced-motion', label: 'settings.reducedMotion' },
  { key: 'highContrast', testId: 'setting-high-contrast', label: 'settings.highContrast' },
  { key: 'dyslexiaFont', testId: 'setting-dyslexia-font', label: 'settings.dyslexiaFont' },
  { key: 'subtitles', testId: 'setting-subtitles', label: 'settings.subtitles' },
];

const SOUND_CHANNELS: readonly CopyKey[] = [
  'settings.sound.master',
  'settings.sound.music',
  'settings.sound.sfx',
  'settings.sound.voice',
];

export function createSettingsScreen(
  host: HTMLElement,
  options: SettingsScreenOptions,
): SettingsScreen {
  const doc = host.ownerDocument;
  const store = options.store;
  const rows: Localised[] = [];

  const screen: Screen = createScreen(host, {
    id: 'tn-settings',
    testId: 'settings-screen',
    locale: store.current.locale,
    ...(options.onClose === undefined ? {} : { onEscape: options.onClose }),
    ...(options.announce === undefined ? {} : { announce: options.announce }),
    switch: {
      enabled: store.current.singleSwitch,
      holdMs: store.current.holdToChooseMs,
      ...(options.now === undefined ? {} : { now: options.now }),
    },
  });

  const locale = (): UiLocale => store.current.locale;
  const say = (message: string): void => options.announce?.(message);

  const title = element(doc, 'h1', {
    id: 'tn-settings-title',
    text: text(locale(), 'settings.title'),
  });
  screen.labelledBy(title);
  rows.push({
    refresh: (next) => {
      title.textContent = text(next, 'settings.title');
    },
  });

  screen.card.append(title, languageGroup(), ...SWITCHES.map(switchRow), textSizeRow());
  if (options.showSound === true) screen.card.append(soundSection());

  const closeButton = button(doc, {
    testId: 'settings-close',
    text: text(locale(), 'common.close'),
    ...(options.onClose === undefined ? {} : { onClick: options.onClose }),
  });
  rows.push({
    refresh: (next) => {
      closeButton.textContent = text(next, 'common.close');
    },
  });
  screen.card.append(
    element(doc, 'div', { className: 'tn-screen__actions', children: [closeButton] }),
  );

  /* One subscription for the whole screen: the controls show the store's value,
     never their own idea of it, so an external change (a save file, another
     screen) can never leave a switch showing the opposite of what is true. */
  const unsubscribe = store.subscribe((next, changed) => {
    for (const row of rows) row.refresh(next.locale);
    if (changed === 'singleSwitch' || changed === 'holdToChooseMs') {
      screen.setSwitchEnabled(next.singleSwitch, next.holdToChooseMs);
    }
    screen.setLocale(next.locale);
    screen.refreshSwitch();
  });

  return {
    element: screen.element,
    get visible(): boolean {
      return screen.visible;
    },
    show(): void {
      screen.show();
    },
    hide(): void {
      screen.hide();
    },
    destroy(): void {
      unsubscribe();
      screen.destroy();
    },
  };

  /**
   * Language, as a radio group rather than a `<select>`: `TN-SET-04` requires
   * the arrow keys to change it, which a native select only does when it is
   * open, and a listbox popup is a second focus surface over a modal.
   */
  function languageGroup(): HTMLElement {
    const legend = element(doc, 'span', {
      id: 'tn-settings-language-legend',
      className: 'tn-screen__legend',
      text: text(locale(), 'settings.language'),
    });

    const group = element(doc, 'div', {
      className: 'tn-screen__group',
      testId: 'setting-language',
      attrs: {
        role: 'radiogroup',
        'aria-labelledby': 'tn-settings-language-legend',
      },
      children: [legend],
    });

    /* The language names are written in their own language and never translated
       (`TN-SET-08`), so each option carries its own `lang`: a screen reader that
       reads the page in English still pronounces « Français » in French. */
    const choices: readonly { readonly code: UiLocale; readonly key: CopyKey }[] = [
      { code: 'en', key: 'settings.language.en' },
      { code: 'fr', key: 'settings.language.fr' },
    ];

    const buttons = choices.map(({ code, key }) => {
      const option = button(doc, {
        testId: `setting-language-${code}`,
        lang: code,
        attrs: { role: 'radio', 'aria-checked': 'false' },
        /* Locale-independent by design: both tables hold the same string, because
           a language's own name is never translated (`TN-SET-08`). */
        children: [element(doc, 'span', { text: text('en', key) })],
        onClick: () => choose(code),
      });
      return option;
    });

    const paint = (): void => {
      for (const [index, option] of buttons.entries()) {
        const chosen = choices[index]?.code === locale();
        option.setAttribute('aria-checked', String(chosen));
        /* Roving tabindex: one Tab stop for the group, arrows inside it. */
        option.tabIndex = chosen ? 0 : -1;
      }
    };

    const choose = (code: UiLocale): void => {
      if (code === locale()) return;
      store.set('locale', code);
      paint();
      /* Announced in the language just chosen (`TN-SET-08`). */
      say(
        labelled(
          code,
          text(code, 'settings.language'),
          text(code, `settings.language.${code}`),
        ),
      );
      /* Focus stays on the control the player used, never on the body. */
      buttons[choices.findIndex((choice) => choice.code === code)]?.focus();
    };

    group.addEventListener('keydown', (event: KeyboardEvent) => {
      const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
      const current = choices.findIndex((choice) => choice.code === locale());
      const next = (current + (forward ? 1 : -1) + choices.length) % choices.length;
      const target = choices[next];
      if (target !== undefined) choose(target.code);
    });

    group.append(...buttons);
    paint();

    rows.push({
      refresh: (next) => {
        legend.textContent = text(next, 'settings.language');
        paint();
      },
    });
    return group;
  }

  /**
   * A switch, with its state as a word as well as a position. `TN-SET-07`
   * requires the word so that removing the animation removes no information,
   * and `TN-SET-06` requires the help text to be the accessible *description*
   * rather than a floating paragraph.
   */
  function switchRow(spec: (typeof SWITCHES)[number]): HTMLElement {
    const labelText = element(doc, 'span', { text: text(locale(), spec.label) });
    const state = element(doc, 'span', { className: 'tn-screen__state' });

    const control = button(doc, {
      testId: spec.testId,
      attrs: { role: 'switch', 'aria-checked': 'false' },
      children: [labelText, state],
      onClick: () => {
        const next = store.toggle(spec.key);
        paint();
        say(labelled(next.locale, text(next.locale, spec.label), stateWord(next.locale)));
      },
    });

    const help =
      spec.help === undefined
        ? null
        : element(doc, 'p', {
            id: `tn-settings-${spec.testId}-help`,
            className: 'tn-screen__help',
            text: text(locale(), spec.help),
          });
    if (help !== null) control.setAttribute('aria-describedby', help.id);

    const stateWord = (which: UiLocale): string =>
      text(which, store.current[spec.key] ? 'settings.state.on' : 'settings.state.off');

    const paint = (): void => {
      const on = store.current[spec.key];
      control.setAttribute('aria-checked', String(on));
      state.textContent = stateWord(locale());
    };

    paint();

    rows.push({
      refresh: (next) => {
        labelText.textContent = text(next, spec.label);
        if (help !== null && spec.help !== undefined) {
          help.textContent = text(next, spec.help);
        }
        paint();
      },
    });

    return element(doc, 'div', {
      className: 'tn-screen__row',
      children: help === null ? [control] : [control, help],
    });
  }

  /**
   * Text size as a native range: the arrow keys work without a keydown handler
   * of ours, the value is in the accessibility tree, and `aria-valuetext` gives
   * a screen reader "150 %" rather than "150".
   */
  function textSizeRow(): HTMLElement {
    const label = element(doc, 'label', {
      id: 'tn-settings-text-size-label',
      text: text(locale(), 'settings.textSize'),
      attrs: { for: 'tn-settings-text-size' },
    });

    const input = element(doc, 'input', {
      id: 'tn-settings-text-size',
      testId: 'setting-text-size',
      attrs: {
        type: 'range',
        min: String(TEXT_SCALE_MIN),
        max: String(TEXT_SCALE_MAX),
        step: String(TEXT_SCALE_STEP),
      },
    });

    const value = element(doc, 'span', {
      testId: 'setting-text-size-value',
      className: 'tn-screen__state',
    });

    const paint = (): void => {
      const scale = store.current.textScale;
      input.value = String(scale);
      input.setAttribute('aria-valuetext', percent(locale(), scale));
      value.textContent = percent(locale(), scale);
    };

    input.addEventListener('input', () => {
      const next = store.set('textScale', Number(input.value));
      paint();
      say(
        labelled(
          next.locale,
          text(next.locale, 'settings.textSize'),
          percent(next.locale, next.textScale),
        ),
      );
    });

    paint();
    rows.push({
      refresh: (next) => {
        label.textContent = text(next, 'settings.textSize');
        paint();
      },
    });

    return element(doc, 'div', {
      className: 'tn-screen__row',
      children: [label, input, value],
    });
  }

  /** `OQ-SET-3`. Built, transcribed, and off until there is a sound to control. */
  function soundSection(): HTMLElement {
    const legend = element(doc, 'span', {
      id: 'tn-settings-sound-legend',
      className: 'tn-screen__legend',
      text: text(locale(), 'settings.sound'),
    });

    const channels = SOUND_CHANNELS.map((key, index) => {
      const id = `tn-settings-sound-${String(index)}`;
      const label = element(doc, 'label', {
        text: text(locale(), key),
        attrs: { for: id },
      });
      const input = element(doc, 'input', {
        id,
        attrs: { type: 'range', min: '0', max: '100', step: '10' },
      });
      rows.push({
        refresh: (next) => {
          label.textContent = text(next, key);
        },
      });
      return element(doc, 'div', { className: 'tn-screen__row', children: [label, input] });
    });

    rows.push({
      refresh: (next) => {
        legend.textContent = text(next, 'settings.sound');
      },
    });

    return element(doc, 'div', {
      className: 'tn-screen__group',
      testId: 'setting-sound',
      attrs: { role: 'group', 'aria-labelledby': 'tn-settings-sound-legend' },
      children: [legend, ...channels],
    });
  }
}
