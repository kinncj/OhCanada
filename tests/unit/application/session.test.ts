import { describe, expect, it, vi } from 'vitest';
import { err } from '@common/result';
import { EventBus } from '@common/event-bus';
import type { GameEvents } from '@application/events';
import { SessionStore } from '@application/session-store';
import { InitializeSession } from '@application/use-cases/initialize-session';
import { CreateCharacter } from '@application/use-cases/create-character';
import { UpdateSettings } from '@application/use-cases/update-settings';
import { FakeContent, CATALOG } from '../../fixtures/content';
import { FakeClock, MemoryRepo } from '../../fixtures/ports';
import { defaultCharacter } from '@domain/character';
import { newProgress } from '@domain/progress';
import { districtId } from '@domain/ids';

function setup() {
  const store = new SessionStore();
  const repo = new MemoryRepo();
  const content = new FakeContent();
  const clock = new FakeClock();
  const bus = new EventBus<GameEvents>();
  return { store, repo, content, clock, bus };
}

describe('InitializeSession', () => {
  it('creates a fresh progress with initial unlocks', async () => {
    const { store, repo, content, clock, bus } = setup();
    const ready = vi.fn();
    bus.on('session:ready', ready);
    const res = await new InitializeSession(store, repo, content, clock, bus).execute();
    expect(res.ok).toBe(true);
    expect(store.progress.unlockedDistricts).toEqual(['hub']);
    expect(store.hasProgress).toBe(true);
    expect(ready).toHaveBeenCalledTimes(1);
  });
  it('loads an existing save', async () => {
    const { store, repo, content, clock, bus } = setup();
    repo.stored = newProgress('2026-01-01T00:00:00.000Z', districtId('hub'), [districtId('hub')]);
    const loaded = vi.fn();
    bus.on('progress:loaded', loaded);
    await new InitializeSession(store, repo, content, clock, bus).execute();
    expect(store.progress.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(loaded).toHaveBeenCalled();
  });
  it('surfaces repository errors', async () => {
    const { store, repo, content, clock, bus } = setup();
    repo.failLoad = true;
    const errored = vi.fn();
    bus.on('progress:error', errored);
    const res = await new InitializeSession(store, repo, content, clock, bus).execute();
    expect(res.ok).toBe(false);
    expect(errored).toHaveBeenCalled();
    expect(() => store.progress).toThrow('not initialised');
  });
});

describe('CreateCharacter', () => {
  it('validates against the catalog and trims the name', async () => {
    const { store, repo, content, clock, bus } = setup();
    await new InitializeSession(store, repo, content, clock, bus).execute();
    const uc = new CreateCharacter(store, content, clock, bus);
    const bad = await uc.execute({ ...defaultCharacter(CATALOG), name: '   ' });
    expect(bad.ok).toBe(false);
    if (!bad.ok && bad.error.kind === 'invalid') expect(bad.error.errors[0]?.field).toBe('name');
    const good = await uc.execute({ ...defaultCharacter(CATALOG), name: '  Sam  ' });
    expect(good.ok).toBe(true);
    expect(store.progress.character?.name).toBe('Sam');
  });
  it('propagates content errors', async () => {
    const { store, repo, content, clock, bus } = setup();
    await new InitializeSession(store, repo, content, clock, bus).execute();
    content.getCharacterCatalog = async () => err({ code: 'io', message: 'x' });
    const res = await new CreateCharacter(store, content, clock, bus).execute(defaultCharacter(CATALOG));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe('content');
  });
});

describe('UpdateSettings', () => {
  it('patches settings and emits per key', async () => {
    const { store, repo, content, clock, bus } = setup();
    await new InitializeSession(store, repo, content, clock, bus).execute();
    const changed = vi.fn();
    bus.on('settings:changed', changed);
    const s = new UpdateSettings(store, clock, bus).execute({ locale: 'fr', reducedMotion: true });
    expect(s.locale).toBe('fr');
    expect(s.reducedMotion).toBe(true);
    expect(changed).toHaveBeenCalledTimes(2);
  });
});

describe('SessionStore', () => {
  it('reset clears everything', () => {
    const store = new SessionStore();
    store.set(newProgress('2026-01-01T00:00:00.000Z', districtId('hub'), []));
    store.presented.set('x', {} as never);
    store.reset();
    expect(store.hasProgress).toBe(false);
    expect(store.presented.size).toBe(0);
  });
});
