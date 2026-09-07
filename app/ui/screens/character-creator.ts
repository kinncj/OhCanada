import type { LocalizerPort } from '@application/engine-ports';
import type { Character, CharacterAppearance, CharacterCatalog, CatalogOption } from '@domain/character';
import { defaultCharacter } from '@domain/character';
import { button, clear, el, focusTrap } from '../dom';

export interface CreatorHandlers {
  onPreview(character: Character): void;
  onConfirm(character: Character): Promise<readonly string[]>;
  onBack(): void;
}

const FIELDS: { key: keyof CharacterAppearance; catalog: keyof CharacterCatalog; label: string; swatch: boolean }[] = [
  { key: 'body', catalog: 'bodies', label: 'creator.body', swatch: false },
  { key: 'face', catalog: 'faces', label: 'creator.face', swatch: false },
  { key: 'skinTone', catalog: 'skinTones', label: 'creator.skinTone', swatch: true },
  { key: 'hair', catalog: 'hair', label: 'creator.hair', swatch: false },
  { key: 'hairColor', catalog: 'hairColors', label: 'creator.hairColor', swatch: true },
  { key: 'outfit', catalog: 'outfits', label: 'creator.outfit', swatch: true },
  { key: 'accessory', catalog: 'accessories', label: 'creator.accessory', swatch: false },
];

export class CharacterCreator {
  readonly root = el('div', { class: 'screen', style: 'background: linear-gradient(90deg, rgba(11,16,32,0.92) 0%, rgba(11,16,32,0.35) 55%, transparent 100%); place-items: center start; padding-left: 4vw;', dataset: { screen: 'creator' } });
  private character: Character;
  private untrap: (() => void) | null = null;
  private errorBox = el('p', { class: 'error', role: 'alert' });

  constructor(
    private readonly t: LocalizerPort,
    private readonly catalog: CharacterCatalog,
    private readonly handlers: CreatorHandlers,
    initial?: Character | null,
  ) {
    this.character = initial ?? defaultCharacter(catalog);
  }

  render(): HTMLElement {
    clear(this.root);
    const t = this.t;
    const panel = el('div', { class: 'panel', role: 'dialog', aria: { labelledby: 'creator-title' }, style: 'width:min(92vw,560px)' });
    panel.append(el('h2', { id: 'creator-title' }, t.t('creator.title')));
    const name = el('input', { type: 'text', maxLength: 24, value: this.character.name, placeholder: t.t('creator.namePlaceholder') });
    name.dataset.testid = 'creator-name';
    name.addEventListener('input', () => this.set({ name: name.value }));
    panel.append(el('label', { class: 'field' }, t.t('creator.name'), name));
    const grid = el('div', { class: 'creator-grid' });
    for (const f of FIELDS) grid.append(this.field(f));
    panel.append(grid, this.errorBox);
    const row = el('div', { class: 'row end', style: 'margin-top:1rem' });
    row.append(
      button('←', this.handlers.onBack, 'btn ghost', 'creator-back'),
      button(t.t('creator.randomize'), () => this.randomize(), 'btn secondary', 'creator-random'),
      button(t.t('creator.confirm'), async () => {
        const errors = await this.handlers.onConfirm(this.character);
        this.errorBox.textContent = errors.length ? errors.map((e) => (e === 'name' ? t.t('creator.errors.name') : e)).join(' ') : '';
      }, 'btn', 'creator-confirm'),
    );
    panel.append(row);
    this.root.append(panel);
    this.untrap?.();
    this.untrap = focusTrap(panel);
    this.handlers.onPreview(this.character);
    return this.root;
  }

  private field(f: (typeof FIELDS)[number]): HTMLElement {
    const options = this.catalog[f.catalog];
    const wrap = el('div', { class: 'field', role: 'radiogroup', aria: { label: this.t.t(f.label) } }, el('span', {}, this.t.t(f.label)));
    const list = el('div', { class: f.swatch ? 'swatches' : 'chips' });
    const rerender = () => {
      for (const b of list.querySelectorAll<HTMLElement>('[role="radio"]')) b.setAttribute('aria-checked', String(b.dataset.id === this.character.appearance[f.key]));
    };
    for (const o of options) list.append(this.option(f, o, rerender));
    wrap.append(list);
    return wrap;
  }

  private option(f: (typeof FIELDS)[number], o: CatalogOption, rerender: () => void): HTMLElement {
    const selected = this.character.appearance[f.key] === o.id;
    const b = f.swatch
      ? el('button', { type: 'button', class: 'swatch', style: `background:${o.value ?? '#999'}`, title: this.t.pick(o.label) })
      : el('button', { type: 'button', class: 'chip' }, this.t.pick(o.label));
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(selected));
    b.setAttribute('aria-label', this.t.pick(o.label));
    b.dataset.id = o.id;
    b.dataset.testid = `opt-${f.key}-${o.id}`;
    b.addEventListener('click', () => {
      this.set({ appearance: { ...this.character.appearance, [f.key]: o.id } });
      rerender();
    });
    return b;
  }

  private set(patch: Partial<Character>): void {
    this.character = { ...this.character, ...patch };
    this.handlers.onPreview(this.character);
  }

  private randomize(): void {
    const pick = (o: readonly CatalogOption[]) => o[Math.floor(Math.random() * o.length)]?.id ?? '';
    this.character = {
      ...this.character,
      appearance: {
        body: pick(this.catalog.bodies), face: pick(this.catalog.faces), skinTone: pick(this.catalog.skinTones), hair: pick(this.catalog.hair),
        hairColor: pick(this.catalog.hairColors), outfit: pick(this.catalog.outfits), accessory: pick(this.catalog.accessories),
      },
    };
    this.render();
  }

  destroy(): void {
    this.untrap?.();
    this.root.remove();
  }
}
