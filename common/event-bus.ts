/**
 * Typed publish/subscribe bus. Systems (render, physics, quest, dialogue, audio)
 * communicate through this and never hold direct references to each other.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventMap = { [K in string]: any };

export type Handler<T> = (payload: T) => void;
export type Unsubscribe = () => void;

export interface EventPublisher<E extends EventMap> {
  emit<K extends keyof E & string>(type: K, payload: E[K]): void;
}

export interface EventSubscriber<E extends EventMap> {
  on<K extends keyof E & string>(type: K, handler: Handler<E[K]>): Unsubscribe;
  once<K extends keyof E & string>(type: K, handler: Handler<E[K]>): Unsubscribe;
}

export class EventBus<E extends EventMap> implements EventPublisher<E>, EventSubscriber<E> {
  private readonly handlers = new Map<string, Set<Handler<unknown>>>();
  private readonly wildcard = new Set<(type: string, payload: unknown) => void>();

  on<K extends keyof E & string>(type: K, handler: Handler<E[K]>): Unsubscribe {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as Handler<unknown>);
    return () => {
      set?.delete(handler as Handler<unknown>);
    };
  }

  once<K extends keyof E & string>(type: K, handler: Handler<E[K]>): Unsubscribe {
    const off = this.on(type, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  /** Observe every event (telemetry, debug overlay, Playwright console assertions). */
  onAny(handler: (type: string, payload: unknown) => void): Unsubscribe {
    this.wildcard.add(handler);
    return () => {
      this.wildcard.delete(handler);
    };
  }

  emit<K extends keyof E & string>(type: K, payload: E[K]): void {
    const set = this.handlers.get(type);
    if (set) {
      for (const h of [...set]) h(payload);
    }
    for (const w of [...this.wildcard]) w(type, payload);
  }

  listenerCount(type: keyof E & string): number {
    return this.handlers.get(type)?.size ?? 0;
  }

  clear(): void {
    this.handlers.clear();
    this.wildcard.clear();
  }
}
