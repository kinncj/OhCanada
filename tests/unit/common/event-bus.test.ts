/**
 * Contract tests for `common/event-bus.ts`.
 *
 * Every system in TrueNorth talks over this bus, so these tests describe the
 * observable contract — delivery, ordering, unsubscription, isolation of a
 * throwing handler — and deliberately avoid asserting on internal storage, so
 * a future rewrite of the mechanism can still be judged by them.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEventBus } from '@common/event-bus';
import type { AnyHandler, BusErrorReporter, EventBus } from '@common/event-bus';

/** A miniature stand-in for the real game/UI event maps wired in bootstrap. */
interface TestEvents extends Record<string, unknown> {
  'question.answered': { readonly questionId: string; readonly correct: boolean };
  'level.completed': { readonly levelId: string };
  'settings.changed': { readonly reducedMotion: boolean };
  tick: number;
  void: undefined;
}

const makeBus = (reporter?: BusErrorReporter): EventBus<TestEvents> =>
  reporter === undefined ? createEventBus<TestEvents>() : createEventBus<TestEvents>(reporter);

const answered = (questionId: string, correct: boolean): TestEvents['question.answered'] => ({
  questionId,
  correct,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('delivery', () => {
  it('delivers a payload to a subscriber', () => {
    const bus = makeBus();
    const handler = vi.fn();
    bus.on('question.answered', handler);

    const payload = answered('q-01', true);
    bus.emit('question.answered', payload);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('hands the payload through untouched, without copying it', () => {
    const bus = makeBus();
    let received: TestEvents['question.answered'] | undefined;
    bus.on('question.answered', (payload) => {
      received = payload;
    });

    const payload = answered('q-02', false);
    bus.emit('question.answered', payload);

    expect(received).toBe(payload);
  });

  it('delivers to every subscriber of the type, in subscription order', () => {
    const bus = makeBus();
    const order: string[] = [];
    bus.on('level.completed', () => order.push('first'));
    bus.on('level.completed', () => order.push('second'));
    bus.on('level.completed', () => order.push('third'));

    bus.emit('level.completed', { levelId: 'l-01' });

    expect(order).toEqual(['first', 'second', 'third']);
  });

  it('delivers every emission to a long-lived subscriber', () => {
    const bus = makeBus();
    const ticks: number[] = [];
    bus.on('tick', (n) => ticks.push(n));

    for (const n of [1, 2, 3]) bus.emit('tick', n);

    expect(ticks).toEqual([1, 2, 3]);
  });

  it('does not leak events between types', () => {
    const bus = makeBus();
    const onAnswered = vi.fn();
    const onCompleted = vi.fn();
    bus.on('question.answered', onAnswered);
    bus.on('level.completed', onCompleted);

    bus.emit('level.completed', { levelId: 'l-03' });

    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(onAnswered).not.toHaveBeenCalled();
  });

  it('runs handlers synchronously, before emit returns', () => {
    const bus = makeBus();
    let ran = false;
    bus.on('void', () => {
      ran = true;
    });

    bus.emit('void', undefined);

    expect(ran).toBe(true);
  });

  it('keeps two buses independent', () => {
    const first = makeBus();
    const second = makeBus();
    const handler = vi.fn();
    first.on('tick', handler);

    second.emit('tick', 1);

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('emitting with no subscribers', () => {
  it('is a silent no-op on a fresh bus', () => {
    const bus = makeBus();

    expect(() => bus.emit('question.answered', answered('q-01', true))).not.toThrow();
  });

  it('is a no-op for a type nobody listens to', () => {
    const bus = makeBus();
    const handler = vi.fn();
    bus.on('level.completed', handler);

    bus.emit('tick', 5);

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not invoke the error reporter', () => {
    const reporter = vi.fn();
    const bus = makeBus(reporter);

    bus.emit('void', undefined);

    expect(reporter).not.toHaveBeenCalled();
  });

  it('is a no-op after the last subscriber unsubscribes', () => {
    const bus = makeBus();
    const handler = vi.fn();
    const off = bus.on('tick', handler);
    off();

    expect(() => bus.emit('tick', 1)).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('unsubscribe', () => {
  it('stops delivery to the unsubscribed handler only', () => {
    const bus = makeBus();
    const kept = vi.fn();
    const dropped = vi.fn();
    bus.on('tick', kept);
    const off = bus.on('tick', dropped);

    off();
    bus.emit('tick', 1);

    expect(dropped).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
  });

  it('stops delivery for events emitted after it, not before', () => {
    const bus = makeBus();
    const handler = vi.fn();
    const off = bus.on('tick', handler);

    bus.emit('tick', 1);
    off();
    bus.emit('tick', 2);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(1);
  });

  it('is idempotent: calling it twice is a no-op', () => {
    const bus = makeBus();
    const other = vi.fn();
    const off = bus.on('tick', other);

    expect(() => {
      off();
      off();
      off();
    }).not.toThrow();
    bus.emit('tick', 1);
    expect(other).not.toHaveBeenCalled();
  });

  it('a stale unsubscribe does not cancel a later re-subscription', () => {
    // The subtle one: unsubscribe must be bound to the subscription, not to
    // the (handler, type) pair, or a resubscribing system silently goes deaf.
    const bus = makeBus();
    const handler = vi.fn();

    const staleOff = bus.on('tick', handler);
    staleOff();
    bus.on('tick', handler);
    staleOff();

    bus.emit('tick', 9);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('allows re-subscribing after the type had no subscribers left', () => {
    const bus = makeBus();
    const first = vi.fn();
    const off = bus.on('level.completed', first);
    off();

    const second = vi.fn();
    bus.on('level.completed', second);
    bus.emit('level.completed', { levelId: 'l-04' });

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});

describe('once', () => {
  it('fires exactly once no matter how many events are emitted', () => {
    const bus = makeBus();
    const handler = vi.fn();
    bus.once('tick', handler);

    bus.emit('tick', 1);
    bus.emit('tick', 2);
    bus.emit('tick', 3);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(1);
  });

  it('can be cancelled before it ever fires', () => {
    const bus = makeBus();
    const handler = vi.fn();
    const off = bus.once('tick', handler);

    off();
    bus.emit('tick', 1);

    expect(handler).not.toHaveBeenCalled();
  });

  it('cancelling after it fired is a harmless no-op', () => {
    const bus = makeBus();
    const handler = vi.fn();
    const off = bus.once('tick', handler);

    bus.emit('tick', 1);
    expect(() => off()).not.toThrow();
    bus.emit('tick', 2);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not re-enter when its own handler emits the same event', () => {
    const bus = makeBus();
    let calls = 0;
    bus.once('tick', (n) => {
      calls += 1;
      if (n < 5) bus.emit('tick', n + 1);
    });

    bus.emit('tick', 0);

    expect(calls).toBe(1);
  });

  it('does not disturb ordinary subscribers of the same type', () => {
    const bus = makeBus();
    const order: string[] = [];
    bus.on('tick', () => order.push('on'));
    bus.once('tick', () => order.push('once'));

    bus.emit('tick', 1);
    bus.emit('tick', 2);

    expect(order).toEqual(['on', 'once', 'on']);
  });

  it('several once-subscribers each fire exactly once', () => {
    const bus = makeBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.once('void', a);
    bus.once('void', b);

    bus.emit('void', undefined);
    bus.emit('void', undefined);

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});

describe('onAny', () => {
  it('observes every event with its type and payload', () => {
    const bus = makeBus();
    const seen: { type: string; payload: unknown }[] = [];
    bus.onAny((event) => seen.push({ type: event.type, payload: event.payload }));

    const answer = answered('q-07', false);
    bus.emit('question.answered', answer);
    bus.emit('level.completed', { levelId: 'l-05' });
    bus.emit('tick', 42);

    expect(seen).toEqual([
      { type: 'question.answered', payload: answer },
      { type: 'level.completed', payload: { levelId: 'l-05' } },
      { type: 'tick', payload: 42 },
    ]);
  });

  it('observes events that have no typed subscriber', () => {
    const bus = makeBus();
    const observer = vi.fn();
    bus.onAny(observer);

    bus.emit('settings.changed', { reducedMotion: true });

    expect(observer).toHaveBeenCalledTimes(1);
    expect(observer).toHaveBeenCalledWith({
      type: 'settings.changed',
      payload: { reducedMotion: true },
    });
  });

  it('supports several observers, each seeing every event', () => {
    const bus = makeBus();
    const liveRegion = vi.fn();
    const devOverlay = vi.fn();
    bus.onAny(liveRegion);
    bus.onAny(devOverlay);

    bus.emit('tick', 1);
    bus.emit('tick', 2);

    expect(liveRegion).toHaveBeenCalledTimes(2);
    expect(devOverlay).toHaveBeenCalledTimes(2);
  });

  it('runs alongside typed subscribers, which still receive the event', () => {
    const bus = makeBus();
    const typed = vi.fn();
    const observer = vi.fn();
    bus.on('tick', typed);
    bus.onAny(observer);

    bus.emit('tick', 3);

    expect(typed).toHaveBeenCalledTimes(1);
    expect(observer).toHaveBeenCalledTimes(1);
  });

  it('stops observing once unsubscribed, and unsubscribing twice is a no-op', () => {
    const bus = makeBus();
    const observer = vi.fn();
    const off = bus.onAny(observer);

    bus.emit('tick', 1);
    off();
    off();
    bus.emit('tick', 2);

    expect(observer).toHaveBeenCalledTimes(1);
  });

  it('a stale onAny unsubscribe does not cancel a later re-subscription', () => {
    const bus = makeBus();
    const observer: AnyHandler<TestEvents> = vi.fn();

    const staleOff = bus.onAny(observer);
    staleOff();
    bus.onAny(observer);
    staleOff();

    bus.emit('tick', 1);

    expect(observer).toHaveBeenCalledTimes(1);
  });

  it('unsubscribing the last observer leaves emit a no-op', () => {
    const bus = makeBus();
    const observer = vi.fn();
    bus.onAny(observer)();

    expect(() => bus.emit('tick', 1)).not.toThrow();
    expect(observer).not.toHaveBeenCalled();
  });
});

describe('subscriber counting, observed through delivery', () => {
  // The bus exposes no `listenerCount`, so the only contract available is how
  // many handlers a single emit reaches.
  const countDeliveries = (subscribe: (bus: EventBus<TestEvents>) => void): number => {
    const bus = makeBus();
    let delivered = 0;
    const counter = (): void => {
      delivered += 1;
    };
    bus.on('tick', counter);
    subscribe(bus);
    bus.emit('tick', 1);
    return delivered;
  };

  it('reaches exactly the handlers currently subscribed', () => {
    expect(countDeliveries(() => undefined)).toBe(1);
    expect(
      countDeliveries((bus) => {
        bus.on('tick', () => undefined);
      }),
    ).toBe(1);
  });

  it('counts each distinct handler once per emit', () => {
    const bus = makeBus();
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    bus.on('tick', a);
    bus.on('tick', b);
    const offC = bus.on('tick', c);
    offC();

    bus.emit('tick', 1);

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(c).not.toHaveBeenCalled();
  });
});

describe('clear', () => {
  it('drops every typed subscription', () => {
    const bus = makeBus();
    const first = vi.fn();
    const second = vi.fn();
    bus.on('tick', first);
    bus.on('level.completed', second);

    bus.clear();
    bus.emit('tick', 1);
    bus.emit('level.completed', { levelId: 'l-06' });

    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });

  it('drops once-subscriptions and any-observers too', () => {
    const bus = makeBus();
    const onceHandler = vi.fn();
    const observer = vi.fn();
    bus.once('tick', onceHandler);
    bus.onAny(observer);

    bus.clear();
    bus.emit('tick', 1);

    expect(onceHandler).not.toHaveBeenCalled();
    expect(observer).not.toHaveBeenCalled();
  });

  it('is safe to call on an empty bus and safe to call twice', () => {
    const bus = makeBus();

    expect(() => {
      bus.clear();
      bus.clear();
    }).not.toThrow();
  });

  it('leaves the bus usable: new subscriptions work after clearing', () => {
    const bus = makeBus();
    bus.on('tick', () => undefined);
    bus.clear();

    const handler = vi.fn();
    const observer = vi.fn();
    bus.on('tick', handler);
    bus.onAny(observer);
    bus.emit('tick', 7);

    expect(handler).toHaveBeenCalledWith(7);
    expect(observer).toHaveBeenCalledTimes(1);
  });

  it('makes a pre-clear unsubscribe harmless', () => {
    // Level unload clears the bus, the next level subscribes, and only then
    // does the old scene's deferred teardown run its stored unsubscribe. That
    // stale call must not touch the new level's subscription.
    const bus = makeBus();
    const off = bus.on('tick', () => undefined);

    bus.clear();
    const handler = vi.fn();
    bus.on('tick', handler);
    off();
    bus.emit('tick', 1);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('survives several stale unsubscribes for the same type', () => {
    const bus = makeBus();
    const offA = bus.on('tick', () => undefined);
    const offB = bus.on('tick', () => undefined);

    bus.clear();
    const handler = vi.fn();
    bus.on('tick', handler);
    offA();
    offB();
    bus.emit('tick', 1);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('makes a pre-clear onAny unsubscribe harmless', () => {
    const bus = makeBus();
    const off = bus.onAny(() => undefined);

    bus.clear();
    const observer = vi.fn();
    bus.onAny(observer);
    off();
    bus.emit('tick', 1);

    expect(observer).toHaveBeenCalledTimes(1);
  });
});

describe('a throwing handler is isolated', () => {
  it('does not stop later subscribers of the same event', () => {
    const reporter = vi.fn();
    const bus = makeBus(reporter);
    const failure = new Error('handler exploded');
    const after = vi.fn();
    const alsoAfter = vi.fn();
    bus.on('tick', () => {
      throw failure;
    });
    bus.on('tick', after);
    bus.on('tick', alsoAfter);

    bus.emit('tick', 1);

    expect(after).toHaveBeenCalledTimes(1);
    expect(alsoAfter).toHaveBeenCalledTimes(1);
  });

  it('does not let the exception escape emit', () => {
    const bus = makeBus(vi.fn());
    bus.on('tick', () => {
      throw new Error('handler exploded');
    });

    expect(() => bus.emit('tick', 1)).not.toThrow();
  });

  it('reports the error together with the event type', () => {
    const reporter = vi.fn();
    const bus = makeBus(reporter);
    const failure = new Error('handler exploded');
    bus.on('question.answered', () => {
      throw failure;
    });

    bus.emit('question.answered', answered('q-09', true));

    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter).toHaveBeenCalledWith(failure, 'question.answered');
  });

  it('reports a non-Error thrown value unchanged', () => {
    const reporter = vi.fn();
    const bus = makeBus(reporter);
    bus.on('tick', () => {
      throw 'a string';
    });

    bus.emit('tick', 1);

    expect(reporter).toHaveBeenCalledWith('a string', 'tick');
  });

  it('does not stop the any-observers', () => {
    const bus = makeBus(vi.fn());
    const observer = vi.fn();
    bus.on('tick', () => {
      throw new Error('handler exploded');
    });
    bus.onAny(observer);

    bus.emit('tick', 1);

    expect(observer).toHaveBeenCalledTimes(1);
  });

  it('isolates a throwing any-observer from the others', () => {
    const reporter = vi.fn();
    const bus = makeBus(reporter);
    const survivor = vi.fn();
    bus.onAny(() => {
      throw new Error('observer exploded');
    });
    bus.onAny(survivor);

    expect(() => bus.emit('tick', 1)).not.toThrow();
    expect(survivor).toHaveBeenCalledTimes(1);
    expect(reporter).toHaveBeenCalledTimes(1);
  });

  it('keeps the throwing subscriber subscribed for the next event', () => {
    const reporter = vi.fn();
    const bus = makeBus(reporter);
    const handler = vi.fn(() => {
      throw new Error('handler exploded');
    });
    bus.on('tick', handler);

    bus.emit('tick', 1);
    bus.emit('tick', 2);

    expect(handler).toHaveBeenCalledTimes(2);
    expect(reporter).toHaveBeenCalledTimes(2);
  });

  it('falls back to logging on console.error when no reporter is injected', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const bus = makeBus();
    const failure = new Error('handler exploded');
    const after = vi.fn();
    bus.on('tick', () => {
      throw failure;
    });
    bus.on('tick', after);

    expect(() => bus.emit('tick', 1)).not.toThrow();

    expect(after).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls[0]?.[1]).toBe(failure);
    expect(String(logged.mock.calls[0]?.[0])).toContain('tick');
  });
});

describe('mutating subscriptions during delivery', () => {
  it('does not deliver the in-flight event to a handler subscribed by another handler', () => {
    const bus = makeBus();
    const late = vi.fn();
    bus.on('tick', () => {
      bus.on('tick', late);
    });

    bus.emit('tick', 1);
    expect(late).not.toHaveBeenCalled();

    bus.emit('tick', 2);
    expect(late).toHaveBeenCalledTimes(1);
    expect(late).toHaveBeenCalledWith(2);
  });

  it('does not skip a sibling when a handler unsubscribes during delivery', () => {
    const bus = makeBus();
    const sibling = vi.fn();
    let off = (): void => undefined;
    bus.on('tick', () => {
      off();
    });
    off = bus.on('tick', () => undefined);
    bus.on('tick', sibling);

    expect(() => bus.emit('tick', 1)).not.toThrow();
    expect(sibling).toHaveBeenCalledTimes(1);
  });

  it('honours an unsubscription made during delivery from the next event on', () => {
    const bus = makeBus();
    const target = vi.fn();
    let off = (): void => undefined;
    bus.on('tick', () => {
      off();
    });
    off = bus.on('tick', target);

    bus.emit('tick', 1);
    const afterFirst = target.mock.calls.length;
    bus.emit('tick', 2);

    expect(target.mock.calls.length).toBe(afterFirst);
    expect(target).not.toHaveBeenCalledWith(2);
  });

  it('survives a handler clearing the bus mid-delivery', () => {
    const bus = makeBus();
    const observer = vi.fn();
    bus.on('tick', () => {
      bus.clear();
    });
    bus.onAny(observer);

    expect(() => bus.emit('tick', 1)).not.toThrow();

    const later = vi.fn();
    bus.on('tick', later);
    bus.emit('tick', 2);
    expect(later).toHaveBeenCalledTimes(1);
  });

  it('delivers a nested emit of a different type synchronously', () => {
    const bus = makeBus();
    const order: string[] = [];
    bus.on('question.answered', () => {
      order.push('answered:start');
      bus.emit('level.completed', { levelId: 'l-07' });
      order.push('answered:end');
    });
    bus.on('level.completed', () => order.push('completed'));

    bus.emit('question.answered', answered('q-10', true));

    expect(order).toEqual(['answered:start', 'completed', 'answered:end']);
  });
});
