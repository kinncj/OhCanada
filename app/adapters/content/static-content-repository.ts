import { err, ok, type Result } from '@common/result';
import { SchemaValidator, type SchemaDocument } from '@common/schema-loader';
import type { ContentError, ContentRepository, GameConfig } from '@application/ports';
import type { District } from '@domain/district';
import type { Quest } from '@domain/quest';
import type { Question } from '@domain/question';
import type { CharacterCatalog } from '@domain/character';
import type { DistrictId, QuestId, QuestionId, Subject } from '@domain/ids';
import gameConfigJson from '@content/game.config.json';
import catalogJson from '@content/characters/catalog.json';

type Loader = () => Promise<unknown>;
const schemaModules = import.meta.glob('/content/schemas/*.json', { eager: true, import: 'default' }) as Record<string, SchemaDocument>;
const districtLoaders = import.meta.glob('/content/districts/*.json', { import: 'default' }) as Record<string, Loader>;
const questLoaders = import.meta.glob('/content/quests/*.json', { import: 'default' }) as Record<string, Loader>;
const questionLoaders = import.meta.glob('/content/questions/*.json', { import: 'default' }) as Record<string, Loader>;

const SCHEMA = (name: string) => `https://truenorth.app/schemas/${name}.schema.json`;
const CODE_TO_SUBJECT: Record<string, Subject> = {
  rr: 'rights-responsibilities', ww: 'who-we-are', hi: 'history', mc: 'modern-canada', gv: 'government',
  el: 'elections', ju: 'justice', sy: 'symbols', ec: 'economy', re: 'regions',
};

interface QuestionFile { subject: Subject; questions: Question[] }

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1).replace(/\.json$/, '');
}

/**
 * Content is bundled at build time (validated by `make validate-content`) and validated again
 * with Ajv when loaded at runtime. Districts, quests and question banks are lazy chunks.
 */
export class StaticContentRepository implements ContentRepository {
  private readonly validator = new SchemaValidator(Object.values(schemaModules));
  private readonly config: GameConfig;
  private readonly districts = new Map<string, District>();
  private readonly quests = new Map<string, Quest>();
  private readonly questionFiles = new Map<Subject, readonly Question[]>();
  private catalog: CharacterCatalog | null = null;

  constructor() {
    const res = this.validator.validate<GameConfig & { $schema?: string }>(SCHEMA('game.config'), gameConfigJson);
    if (!res.ok) throw new Error(`game.config.json invalid: ${res.error.messages.join('; ')}`);
    this.config = res.value;
  }

  getConfig(): GameConfig {
    return this.config;
  }

  async listDistricts(): Promise<Result<readonly Pick<District, 'id' | 'subject' | 'name' | 'description' | 'chapter'>[], ContentError>> {
    const out: District[] = [];
    for (const id of this.config.districts) {
      const d = await this.getDistrict(id);
      if (!d.ok) return d;
      out.push(d.value);
    }
    return ok(out);
  }

  async getDistrict(id: DistrictId): Promise<Result<District, ContentError>> {
    const cached = this.districts.get(id);
    if (cached) return ok(cached);
    return this.load<District>(districtLoaders, id, 'district', (d) => this.districts.set(id, d));
  }

  async getQuest(id: QuestId): Promise<Result<Quest, ContentError>> {
    const cached = this.quests.get(id);
    if (cached) return ok(cached);
    return this.load<Quest>(questLoaders, id, 'quest', (q) => this.quests.set(id, q));
  }

  async getQuestionsBySubject(subject: Subject): Promise<Result<readonly Question[], ContentError>> {
    const cached = this.questionFiles.get(subject);
    if (cached) return ok(cached);
    const res = await this.load<QuestionFile>(questionLoaders, subject, 'question', () => undefined);
    if (!res.ok) return res;
    this.questionFiles.set(subject, res.value.questions);
    return ok(res.value.questions);
  }

  async getQuestions(ids: readonly QuestionId[]): Promise<Result<readonly Question[], ContentError>> {
    const out: Question[] = [];
    for (const id of ids) {
      const code = id.split('-')[1] ?? '';
      const subject = CODE_TO_SUBJECT[code];
      if (!subject) return err({ code: 'not-found', message: `Question ${id}: unknown subject code ${code}` });
      const bank = await this.getQuestionsBySubject(subject);
      if (!bank.ok) return bank;
      const q = bank.value.find((x) => x.id === id);
      if (!q) return err({ code: 'not-found', message: `Question ${id} not found in ${subject}` });
      out.push(q);
    }
    return ok(out);
  }

  async getAllQuestions(): Promise<Result<readonly Question[], ContentError>> {
    const all: Question[] = [];
    for (const path of Object.keys(questionLoaders)) {
      const res = await this.getQuestionsBySubject(basename(path) as Subject);
      if (!res.ok) return res;
      all.push(...res.value);
    }
    return ok(all);
  }

  async getCharacterCatalog(): Promise<Result<CharacterCatalog, ContentError>> {
    if (this.catalog) return ok(this.catalog);
    const res = this.validator.validate<CharacterCatalog>(SCHEMA('character-catalog'), catalogJson);
    if (!res.ok) return err({ code: 'invalid', message: res.error.messages.join('; ') });
    this.catalog = res.value;
    return ok(res.value);
  }

  private async load<T>(loaders: Record<string, Loader>, id: string, schema: string, store: (v: T) => void): Promise<Result<T, ContentError>> {
    const entry = Object.entries(loaders).find(([path]) => basename(path) === id);
    if (!entry) return err({ code: 'not-found', message: `${schema} ${id} not found` });
    let data: unknown;
    try {
      data = await entry[1]();
    } catch (e) {
      return err({ code: 'io', message: `Failed to load ${schema} ${id}: ${(e as Error).message}` });
    }
    const res = this.validator.validate<T>(SCHEMA(schema), data);
    if (!res.ok) return err({ code: 'invalid', message: `${schema} ${id}: ${res.error.messages.join('; ')}` });
    store(res.value);
    return ok(res.value);
  }
}
