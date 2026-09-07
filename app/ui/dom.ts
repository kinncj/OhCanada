type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<Omit<HTMLElementTagNameMap[K], 'style' | 'children'>> & { class?: string; style?: string; dataset?: Record<string, string>; aria?: Record<string, string> } = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue;
    if (k === 'class') node.className = String(v);
    else if (k === 'style') node.setAttribute('style', String(v));
    else if (k === 'dataset') for (const [dk, dv] of Object.entries(v as Record<string, string>)) node.dataset[dk] = dv;
    else if (k === 'aria') for (const [ak, av] of Object.entries(v as Record<string, string>)) node.setAttribute(`aria-${ak}`, av);
    else (node as unknown as Record<string, unknown>)[k] = v;
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function button(label: string, onClick: () => void, cls = 'btn', testId?: string): HTMLButtonElement {
  const b = el('button', { class: cls, type: 'button' }, label);
  b.addEventListener('click', onClick);
  if (testId) b.dataset.testid = testId;
  return b;
}

/** Trap Tab within a panel for keyboard-only play. */
export function focusTrap(panel: HTMLElement): () => void {
  const handler = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const focusables = [...panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((f) => !f.hasAttribute('disabled'));
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  };
  panel.addEventListener('keydown', handler);
  queueMicrotask(() => panel.querySelector<HTMLElement>('button, input, select')?.focus());
  return () => panel.removeEventListener('keydown', handler);
}

export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
