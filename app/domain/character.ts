export interface CharacterAppearance {
  readonly body: string;
  readonly face: string;
  readonly skinTone: string;
  readonly hair: string;
  readonly hairColor: string;
  readonly outfit: string;
  readonly accessory: string; // "none" allowed
}

export interface Character {
  readonly name: string;
  readonly appearance: CharacterAppearance;
}

export interface CatalogOption {
  readonly id: string;
  readonly label: Readonly<Record<'en' | 'fr', string>>;
  readonly value?: string; // e.g. hex colour
  readonly mesh?: string; // glTF part reference
}

export interface CharacterCatalog {
  readonly bodies: readonly CatalogOption[];
  readonly faces: readonly CatalogOption[];
  readonly skinTones: readonly CatalogOption[];
  readonly hair: readonly CatalogOption[];
  readonly hairColors: readonly CatalogOption[];
  readonly outfits: readonly CatalogOption[];
  readonly accessories: readonly CatalogOption[];
}

export type CharacterError = { readonly field: keyof CharacterAppearance | 'name'; readonly message: string };

const NAME_MAX = 24;

export function validateCharacter(character: Character, catalog: CharacterCatalog): CharacterError[] {
  const errors: CharacterError[] = [];
  const name = character.name.trim();
  if (name.length === 0 || name.length > NAME_MAX) errors.push({ field: 'name', message: `name must be 1-${NAME_MAX} characters` });

  const check = (field: keyof CharacterAppearance, options: readonly CatalogOption[]) => {
    if (!options.some((o) => o.id === character.appearance[field])) errors.push({ field, message: `unknown ${field}: ${character.appearance[field]}` });
  };
  check('body', catalog.bodies);
  check('face', catalog.faces);
  check('skinTone', catalog.skinTones);
  check('hair', catalog.hair);
  check('hairColor', catalog.hairColors);
  check('outfit', catalog.outfits);
  check('accessory', catalog.accessories);
  return errors;
}

export function defaultCharacter(catalog: CharacterCatalog, name = 'Explorer'): Character {
  const first = (o: readonly CatalogOption[]) => o[0]?.id ?? '';
  return {
    name,
    appearance: {
      body: first(catalog.bodies),
      face: first(catalog.faces),
      skinTone: first(catalog.skinTones),
      hair: first(catalog.hair),
      hairColor: first(catalog.hairColors),
      outfit: first(catalog.outfits),
      accessory: catalog.accessories.find((a) => a.id === 'none')?.id ?? first(catalog.accessories),
    },
  };
}
