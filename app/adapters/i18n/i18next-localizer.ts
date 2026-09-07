import i18next, { type i18n, type Resource, type ResourceKey } from 'i18next';
import type { LocalizerPort } from '@application/engine-ports';
import type { Locale, LocalizedText } from '@domain/ids';

const bundles = import.meta.glob('/content/locales/*/*.json', { eager: true, import: 'default' }) as Record<string, Record<string, unknown>>;

export class I18nextLocalizer implements LocalizerPort {
  private readonly i18n: i18n;
  private readonly handlers = new Set<(l: Locale) => void>();
  private current: Locale;

  constructor(initial: Locale, private readonly supported: readonly Locale[] = ['en', 'fr']) {
    this.current = initial;
    this.i18n = i18next.createInstance();
  }

  async init(): Promise<void> {
    const resources: Resource = {};
    for (const [path, data] of Object.entries(bundles)) {
      const m = /locales\/([a-z]{2})\/([a-z]+)\.json$/.exec(path);
      if (!m) continue;
      const [, lng, ns] = m as unknown as [string, string, string];
      resources[lng] ??= {};
      resources[lng][ns] = data as ResourceKey;
    }
    await this.i18n.init({
      lng: this.current,
      fallbackLng: 'en',
      supportedLngs: [...this.supported],
      defaultNS: 'ui',
      ns: ['ui'],
      resources,
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  }

  get locale(): Locale {
    return this.current;
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params ?? {});
  }

  pick(text: LocalizedText): string {
    return text[this.current] ?? text.en;
  }

  async setLocale(locale: Locale): Promise<void> {
    if (!this.supported.includes(locale)) return;
    this.current = locale;
    await this.i18n.changeLanguage(locale);
    for (const h of this.handlers) h(locale);
  }

  onChange(handler: (locale: Locale) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
}
