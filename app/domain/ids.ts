declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type DistrictId = Brand<string, 'DistrictId'>;
export type QuestId = Brand<string, 'QuestId'>;
export type QuestionId = Brand<string, 'QuestionId'>;
export type NpcId = Brand<string, 'NpcId'>;
export type StampId = Brand<string, 'StampId'>;
export type TriggerId = Brand<string, 'TriggerId'>;

export const districtId = (s: string): DistrictId => s as DistrictId;
export const questId = (s: string): QuestId => s as QuestId;
export const questionId = (s: string): QuestionId => s as QuestionId;
export const npcId = (s: string): NpcId => s as NpcId;
export const stampId = (s: string): StampId => s as StampId;
export const triggerId = (s: string): TriggerId => s as TriggerId;

export const SUBJECTS = [
  'rights-responsibilities',
  'who-we-are',
  'history',
  'modern-canada',
  'government',
  'elections',
  'justice',
  'symbols',
  'economy',
  'regions',
] as const;
export type Subject = (typeof SUBJECTS)[number];

export const LOCALES = ['en', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];

export type LocalizedText = Readonly<Record<Locale, string>>;
