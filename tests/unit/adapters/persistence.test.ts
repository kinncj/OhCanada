import { describe, expect, it } from 'vitest';
import { JsonSaveCodec } from '@adapters/persistence/json-save-codec';
import { LocalStorageProgressRepository, type KeyValueStore } from '@adapters/persistence/local-storage-progress-repository';
import { newProgress, SAVE_VERSION } from '@domain/progress';
import { districtId } from '@domain/ids';

class MemoryStore implements KeyValueStore {
  map = new Map<string, string>();
  throwOn: 'get' | 'set' | 'remove' | null = null;
  getItem(k: string) { if (this.throwOn === 'get') throw new Error('quota'); return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { if (this.throwOn === 'set') throw new Error('quota'); this.map.set(k, v); }
  removeItem(k: string) { if (this.throwOn === 'remove') throw new Error('quota'); this.map.delete(k); }
}

const T = '2026-09-07T12:00:00.000Z';

describe('JsonSaveCodec', () => {
  const codec = new JsonSaveCodec();
  it('round-trips a valid save', () => {
    const p = newProgress(T, districtId('hub'), [districtId('hub')]);
    const r = codec.decode(codec.encode(p));
    expect(r.ok && r.value).toEqual(p);
  });
  it('rejects non-JSON, schema violations, prototype pollution and future versions', () => {
    expect(codec.decode('{nope').ok).toBe(false);
    expect(codec.decode('{"version":1}').ok).toBe(false);
    const p = newProgress(T, districtId('hub'), []);
    const tampered = { ...p, stamps: 'lots', __proto__: { admin: true } };
    const r = codec.decode(JSON.stringify(tampered));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('schema');
    const future = codec.decode(JSON.stringify({ ...p, version: SAVE_VERSION + 5 }));
    expect(future.ok).toBe(false);
    if (!future.ok) expect(future.error.code).toBe('version');
    expect(codec.decode('x'.repeat(600 * 1024)).ok).toBe(false);
    expect(codec.decode(JSON.stringify({ ...p, settings: { ...p.settings, keyBindings: { forward: 'Key W; alert(1)' } } })).ok).toBe(false);
  });
});

describe('LocalStorageProgressRepository', () => {
  it('saves, loads and clears', async () => {
    const store = new MemoryStore();
    const repo = new LocalStorageProgressRepository(new JsonSaveCodec(), store, 'k');
    expect((await repo.load()).ok && (await repo.load()).ok).toBe(true);
    expect(await repo.load()).toEqual({ ok: true, value: null });
    const p = newProgress(T, districtId('hub'), []);
    expect((await repo.save(p)).ok).toBe(true);
    const loaded = await repo.load();
    expect(loaded.ok && loaded.value).toEqual(p);
    expect((await repo.clear()).ok).toBe(true);
    expect(await repo.load()).toEqual({ ok: true, value: null });
  });
  it('reports corrupt storage and io failures', async () => {
    const store = new MemoryStore();
    const repo = new LocalStorageProgressRepository(new JsonSaveCodec(), store, 'k');
    store.map.set('k', '{"broken":');
    const r = await repo.load();
    expect(r.ok).toBe(false);
    store.throwOn = 'get';
    expect((await repo.load()).ok).toBe(false);
    store.throwOn = 'set';
    expect((await repo.save(newProgress(T, districtId('hub'), []))).ok).toBe(false);
    store.throwOn = 'remove';
    expect((await repo.clear()).ok).toBe(false);
  });
});
