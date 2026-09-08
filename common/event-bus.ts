/**
 * Typed event bus — the only way TrueNorth systems talk to each other (ADR-0005).
 *
 * A scene does not hold a reference to a use case, and a use case does not hold a
 * reference to a scene. Both hold the bus. That is what lets the Phaser adapter,
 * the DOM UI and the audio adapter react to one domain fact without importing
 * each other, and what lets a test assert on facts instead of on render calls.
 *
 * The event map itself is declared per bounded area (game events, UI events) and
 * wired in `app/bootstrap`; this file only supplies the mechanism.
 */

/** An event map: event name -> payload type. Payloads must be plain, serialisable data. */
export type EventMap = Record<string, unknown>;

/** Call to stop receiving. Idempotent: calling it twice is a no-op. */
export type Unsubscribe = () => void;

export type Handler<T> = (payload: T) => void;

/** The discriminated union of every event a map can carry. */
export type BusEvent<M extends EventMap> = {
  [K in keyof M & string]: { readonly type: K; readonly payload: M[K] };
}[keyof M & string];

/** Observer of every event. For the a11y live region, logging and the dev overlay. */
export type AnyHandler<M extends EventMap> = (event: BusEvent<M>) => void;

export interface EventBus<M extends EventMap> {
  /** Subscribe until unsubscribed. */
  on<K extends keyof M & string>(type: K, handler: Handler<M[K]>): Unsubscribe;
  /** Subscribe for exactly one delivery. */
  once<K extends keyof M & string>(type: K, handler: Handler<M[K]>): Unsubscribe;
  /** Publish. Handlers run synchronously, in subscription order. */
  emit<K extends keyof M & string>(type: K, payload: M[K]): void;
  /** Observe every event on the bus. */
  onAny(handler: AnyHandler<M>): Unsubscribe;
  /** Drop every subscription. Called on level unload and teardown. */
  clear(): void;
}

/** Reports a handler that threw. One bad listener must not stop the others. */
export type BusErrorReporter = (error: unknown, type: string) => void;

const defaultReporter: BusErrorReporter = (error, type) => {
  console.error(`[event-bus] handler for "${type}" threw`, error);
};

export function createEventBus<M extends EventMap>(
  onHandlerError: BusErrorReporter = defaultReporter,
): EventBus<M> {
  const handlers = new Map<string, Set<Handler<never>>>();
  const anyHandlers = new Set<AnyHandler<M>>();

  function on<K extends keyof M & string>(type: K, handler: Handler<M[K]>): Unsubscribe {
    let set = handlers.get(type);
    if (set === undefined) {
      set = new Set();
      handlers.set(type, set);
    }
    const bucket = set;
    bucket.add(handler as Handler<never>);
    let live = true;
    return () => {
      if (!live) return;
      live = false;
      bucket.delete(handler as Handler<never>);
      // Prune the empty bucket, but only while it is still the live one for
      // this type: `clear()` detaches buckets without emptying them, so a
      // teardown that runs after the next level has already subscribed would
      // otherwise delete that new, unrelated bucket and silently go deaf.
      if (bucket.size === 0 && handlers.get(type) === bucket) handlers.delete(type);
    };
  }

  function once<K extends keyof M & string>(type: K, handler: Handler<M[K]>): Unsubscribe {
    const off = on(type, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  function emit<K extends keyof M & string>(type: K, payload: M[K]): void {
    const set = handlers.get(type);
    // Snapshot: a handler may subscribe or unsubscribe while this event is delivered.
    if (set !== undefined) {
      for (const handler of [...set] as Handler<M[K]>[]) {
        try {
          handler(payload);
        } catch (error) {
          onHandlerError(error, type);
        }
      }
    }
    if (anyHandlers.size > 0) {
      const event = { type, payload } as BusEvent<M>;
      for (const handler of [...anyHandlers]) {
        try {
          handler(event);
        } catch (error) {
          onHandlerError(error, type);
        }
      }
    }
  }

  function onAny(handler: AnyHandler<M>): Unsubscribe {
    anyHandlers.add(handler);
    let live = true;
    return () => {
      if (!live) return;
      live = false;
      anyHandlers.delete(handler);
    };
  }

  function clear(): void {
    handlers.clear();
    anyHandlers.clear();
  }

  return { on, once, emit, onAny, clear };
}
