import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '@common/event-bus';

type E = { a: number; b: string };

describe('EventBus', () => {
  it('delivers to subscribers and unsubscribes', () => {
    const bus = new EventBus<E>();
    const h = vi.fn();
    const off = bus.on('a', h);
    bus.emit('a', 1);
    off();
    bus.emit('a', 2);
    expect(h).toHaveBeenCalledTimes(1);
    expect(h).toHaveBeenCalledWith(1);
    expect(bus.listenerCount('a')).toBe(0);
  });
  it('once fires a single time', () => {
    const bus = new EventBus<E>();
    const h = vi.fn();
    bus.once('b', h);
    bus.emit('b', 'x');
    bus.emit('b', 'y');
    expect(h).toHaveBeenCalledTimes(1);
  });
  it('onAny observes everything and clear removes all', () => {
    const bus = new EventBus<E>();
    const any = vi.fn();
    bus.onAny(any);
    bus.emit('a', 1);
    bus.emit('b', 's');
    expect(any).toHaveBeenCalledTimes(2);
    expect(any).toHaveBeenLastCalledWith('b', 's');
    bus.clear();
    bus.emit('a', 3);
    expect(any).toHaveBeenCalledTimes(2);
  });
});
