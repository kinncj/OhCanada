/**
 * The three lines of DOM plumbing every screen in this directory repeats.
 *
 * Small on purpose. It is not a view library: a screen that needs conditional
 * structure writes it out, because the accessibility of these screens lives in
 * the exact element and attribute chosen, and a helper that hides that choice is
 * how a `div` with a click handler ends up standing in for a button.
 */

export interface ElementInit {
  readonly className?: string;
  readonly id?: string;
  /** `data-testid`, from the table in `docs/stories/README.md`. */
  readonly testId?: string;
  readonly text?: string;
  readonly lang?: string;
  readonly attrs?: Readonly<Record<string, string>>;
  readonly children?: readonly HTMLElement[];
}

export function element<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  init: ElementInit = {},
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (init.className !== undefined) node.className = init.className;
  if (init.id !== undefined) node.id = init.id;
  if (init.testId !== undefined) node.setAttribute('data-testid', init.testId);
  if (init.text !== undefined) node.textContent = init.text;
  if (init.lang !== undefined) node.setAttribute('lang', init.lang);
  for (const [name, value] of Object.entries(init.attrs ?? {})) node.setAttribute(name, value);
  if (init.children !== undefined) node.append(...init.children);
  return node;
}

/**
 * A real `<button type="button">`, never a clickable `div`.
 *
 * `type` matters even outside a form: the default is `submit`, and a submit
 * button inside anything form-shaped reloads the page — which on a game with no
 * server is an unexplained restart.
 */
export function button(
  doc: Document,
  init: ElementInit & { readonly onClick?: () => void } = {},
): HTMLButtonElement {
  const node = element(doc, 'button', init);
  node.type = 'button';
  if (init.onClick !== undefined) node.addEventListener('click', init.onClick);
  return node;
}

/**
 * A mark that carries meaning as a shape — a tick, a cross — beside a word that
 * carries the same meaning as text. Hidden from assistive technology because the
 * word next to it is what should be read; visible because colour is never the
 * only signal (CLAUDE.md, Accessibility).
 */
export function mark(doc: Document, glyph: string): HTMLElement {
  return element(doc, 'span', {
    className: 'tn-screen__mark',
    text: glyph,
    attrs: { 'aria-hidden': 'true' },
  });
}

/** Replace an element's children in one step, without innerHTML. */
export function replaceChildren(node: HTMLElement, children: readonly HTMLElement[]): void {
  while (node.firstChild !== null) node.removeChild(node.firstChild);
  node.append(...children);
}
