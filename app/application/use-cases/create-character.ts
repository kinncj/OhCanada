import { err, ok, type Result } from '@common/result';
import type { EventPublisher } from '@common/event-bus';
import { validateCharacter, type Character, type CharacterError } from '@domain/character';
import { withCharacter } from '@domain/progress';
import type { GameEvents } from '../events';
import type { Clock, ContentError, ContentRepository } from '../ports';
import type { SessionStore } from '../session-store';

export type CreateCharacterError = { readonly kind: 'invalid'; readonly errors: readonly CharacterError[] } | { readonly kind: 'content'; readonly error: ContentError };

export class CreateCharacter {
  constructor(
    private readonly store: SessionStore,
    private readonly content: ContentRepository,
    private readonly clock: Clock,
    private readonly events: EventPublisher<GameEvents>,
  ) {}

  async execute(character: Character): Promise<Result<Character, CreateCharacterError>> {
    const catalog = await this.content.getCharacterCatalog();
    if (!catalog.ok) return err({ kind: 'content', error: catalog.error });
    const errors = validateCharacter(character, catalog.value);
    if (errors.length > 0) return err({ kind: 'invalid', errors });
    const clean: Character = { ...character, name: character.name.trim() };
    this.store.update((p) => withCharacter(p, clean, this.clock.nowIso()));
    this.events.emit('character:created', { character: clean });
    return ok(clean);
  }
}
