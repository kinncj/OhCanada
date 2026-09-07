#!/usr/bin/env node
/**
 * make validate-content
 *  - Ajv (2020-12, strict, no unknown properties) over every content file
 *  - Cross-reference integrity (quest -> npc/trigger/question, district -> quest, config -> district)
 *  - Volatile facts: fail if asOf older than volatileMaxAgeDays
 *  - assets/dist: every file must be listed in assets/credits.json
 *  - Locale parity: en and fr bundles have identical key sets
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = new URL('..', import.meta.url).pathname;
const content = join(root, 'content');
const errors = [];
const fail = (msg) => errors.push(msg);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const listJson = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => join(dir, f)) : []);

const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);
for (const f of listJson(join(content, 'schemas'))) ajv.addSchema(readJson(f));

function validate(schemaId, file) {
  const data = readJson(file);
  const fn = ajv.getSchema(`https://truenorth.app/schemas/${schemaId}`);
  if (!fn) throw new Error(`schema ${schemaId} missing`);
  if (!fn(data)) {
    for (const e of fn.errors) fail(`${relative(root, file)}: ${e.instancePath || '/'} ${e.message} ${e.params?.additionalProperty ? `(${e.params.additionalProperty})` : ''}`);
  }
  if (!data.$schema && schemaId !== 'locale.schema.json') fail(`${relative(root, file)}: missing "$schema"`);
  return data;
}

const config = validate('game.config.schema.json', join(content, 'game.config.json'));
const catalog = validate('character-catalog.schema.json', join(content, 'characters', 'catalog.json'));
const districts = listJson(join(content, 'districts')).map((f) => validate('district.schema.json', f));
const quests = listJson(join(content, 'quests')).map((f) => validate('quest.schema.json', f));
const questionFiles = listJson(join(content, 'questions')).map((f) => ({ file: f, data: validate('question.schema.json', f) }));
const credits = validate('credits.schema.json', join(root, 'assets', 'credits.json'));

// Locales
const localeDirs = readdirSync(join(content, 'locales'));
const bundles = {};
for (const loc of localeDirs) {
  bundles[loc] = {};
  for (const f of listJson(join(content, 'locales', loc))) {
    const ns = f.split('/').pop().replace('.json', '');
    bundles[loc][ns] = validate('locale.schema.json', f);
  }
}
const flatten = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (typeof v === 'string' ? [prefix + k] : flatten(v, `${prefix}${k}.`)));
for (const loc of config.locales) {
  if (!bundles[loc]) fail(`locale ${loc} declared in config but content/locales/${loc} missing`);
}
const [base, ...others] = config.locales;
for (const ns of Object.keys(bundles[base] ?? {})) {
  const baseKeys = new Set(flatten(bundles[base][ns]));
  for (const loc of others) {
    const keys = new Set(flatten(bundles[loc]?.[ns] ?? {}));
    for (const k of baseKeys) if (!keys.has(k)) fail(`locales/${loc}/${ns}.json missing key ${k}`);
    for (const k of keys) if (!baseKeys.has(k)) fail(`locales/${loc}/${ns}.json has extra key ${k}`);
  }
}

// Cross references
const districtIds = new Set(districts.map((d) => d.id));
const questIds = new Set(quests.map((q) => q.id));
const questionIds = new Map();
for (const { file, data } of questionFiles) {
  for (const q of data.questions) {
    if (q.subject !== data.subject) fail(`${relative(root, file)}: question ${q.id} subject ${q.subject} != file subject ${data.subject}`);
    if (questionIds.has(q.id)) fail(`duplicate question id ${q.id}`);
    questionIds.set(q.id, q);
    const texts = [q.answer.en, ...q.distractors.map((d) => d.en)];
    if (new Set(texts).size !== texts.length) fail(`question ${q.id}: duplicate choice text (en)`);
  }
}
for (const d of config.districts) if (!districtIds.has(d)) fail(`game.config districts: ${d} has no content/districts/${d}.json`);
for (const d of config.unlockRules.order) if (!districtIds.has(d)) fail(`game.config unlockRules.order: unknown district ${d}`);
if (!districtIds.has(config.startDistrict)) fail(`startDistrict ${config.startDistrict} unknown`);
if (config.exam.passMark > config.exam.questionCount) fail('exam.passMark exceeds questionCount');

const catalogIds = (k) => new Set(catalog[k].map((o) => o.id));
for (const d of districts) {
  if (!config.districts.includes(d.id)) fail(`district ${d.id} not registered in game.config.json`);
  const npcIds = new Set(d.npcs.map((n) => n.id));
  const triggerIds = new Set(d.triggers.map((t) => t.id));
  for (const qid of d.quests) if (!questIds.has(qid)) fail(`district ${d.id}: unknown quest ${qid}`);
  for (const n of d.npcs) {
    for (const qid of n.questRefs) if (!questIds.has(qid)) fail(`district ${d.id} npc ${n.id}: unknown quest ${qid}`);
    if (!catalogIds('skinTones').has(n.appearance.skinTone)) fail(`npc ${n.id}: unknown skinTone ${n.appearance.skinTone}`);
    if (!catalogIds('outfits').has(n.appearance.outfit)) fail(`npc ${n.id}: unknown outfit ${n.appearance.outfit}`);
    if (!catalogIds('hair').has(n.appearance.hair)) fail(`npc ${n.id}: unknown hair ${n.appearance.hair}`);
    if (!catalogIds('hairColors').has(n.appearance.hairColor)) fail(`npc ${n.id}: unknown hairColor ${n.appearance.hairColor}`);
    if (n.appearance.accessory && !catalogIds('accessories').has(n.appearance.accessory)) fail(`npc ${n.id}: unknown accessory ${n.appearance.accessory}`);
  }
  for (const t of d.triggers) {
    if (t.kind === 'portal' && !t.toDistrict) fail(`district ${d.id} trigger ${t.id}: portal needs toDistrict`);
    if (t.toDistrict && !districtIds.has(t.toDistrict)) fail(`district ${d.id} trigger ${t.id}: unknown toDistrict ${t.toDistrict}`);
  }
  for (const q of quests.filter((q) => q.district === d.id)) {
    if (!npcIds.has(q.giverNpc)) fail(`quest ${q.id}: giverNpc ${q.giverNpc} not in district ${d.id}`);
    for (const s of q.steps) {
      if (s.kind === 'talk' && !npcIds.has(s.npc)) fail(`quest ${q.id} step ${s.id}: unknown npc ${s.npc}`);
      if (s.kind === 'reach' && !triggerIds.has(s.trigger)) fail(`quest ${q.id} step ${s.id}: unknown trigger ${s.trigger}`);
      if (s.kind === 'collect') for (const it of s.items) if (!triggerIds.has(it)) fail(`quest ${q.id} step ${s.id}: unknown pickup ${it}`);
      if (s.kind === 'answer') {
        for (const qq of s.questions) if (!questionIds.has(qq)) fail(`quest ${q.id} step ${s.id}: unknown question ${qq}`);
        if (s.minCorrect > s.questions.length) fail(`quest ${q.id} step ${s.id}: minCorrect > questions`);
      }
    }
    if (!d.quests.includes(q.id)) fail(`quest ${q.id} belongs to ${d.id} but district does not list it`);
  }
}
for (const q of quests) if (!districtIds.has(q.district)) fail(`quest ${q.id}: unknown district ${q.district}`);

// POIs: bounds, unique ids, hero/procedural landmark keys, fauna zoning, cultural review listing
const PROCEDURAL = new Set(['parliament','flame','flagpole','lamp','bench','station','locks','courthouse','legislature','supremecourt','pollingstation','arena','fort','port','rink','apartments','factory','circle','lookout','hydrant','power-pole','utility-box','barrier','gate','street']);
const HERO = new Set(['peace-tower','centre-block','chateau-laurier','war-memorial','cn-tower','chateau-frontenac','peggys-cove-lighthouse','grain-elevator','inukshuk','totem-pole','niagara-falls-cliff','stampede-grandstand','canoe-voyageur','qamutiik']);
const manifestPath = join(root, 'assets', 'dist', 'manifest.json');
const manifestModels = existsSync(manifestPath) ? Object.keys(readJson(manifestPath).models ?? {}) : [];
const reviewDoc = existsSync(join(root, 'docs', 'content-review.md')) ? readFileSync(join(root, 'docs', 'content-review.md'), 'utf8') : '';
for (const d of districts) {
  const half = d.scene.size / 2;
  const ids = new Set();
  for (const poi of d.pois ?? []) {
    if (ids.has(poi.id)) fail(`district ${d.id}: duplicate poi ${poi.id}`);
    ids.add(poi.id);
    if (Math.abs(poi.position[0]) > half || Math.abs(poi.position[2]) > half) fail(`district ${d.id} poi ${poi.id}: outside the terrain`);
    if (poi.landmark && !PROCEDURAL.has(poi.landmark) && !HERO.has(poi.landmark) && !manifestModels.includes(poi.landmark)) fail(`district ${d.id} poi ${poi.id}: unknown landmark ${poi.landmark}`);
    for (const f of poi.fauna ?? []) {
      if (f.species === 'polar-bear' && !(d.id === 'regions' && /north/.test(poi.id))) fail(`poi ${poi.id}: polar bears only in the North sub-zone`);
      if (f.species === 'orca' && !(d.id === 'regions' && /west|coast|pacific/.test(poi.id))) fail(`poi ${poi.id}: orcas only on the West Coast`);
    }
    if ((poi.ambience?.loop === 'ocean' || poi.ambience?.loop === 'harbour') && !(d.id === 'regions' && /atlantic|west|coast|pacific|fundy|peggy/.test(poi.id))) fail(`poi ${poi.id}: ocean/harbour ambience only in Atlantic or West Coast zones`);
    if (poi.culturalReview && !reviewDoc.includes(poi.id)) fail(`poi ${poi.id} needs a cultural review entry in docs/content-review.md`);
  }
  if ((d.scene.ambience.soundscape.loop === 'ocean' || d.scene.ambience.soundscape.loop === 'harbour') && d.id !== 'regions') fail(`district ${d.id}: ocean ambience outside Atlantic/West Coast`);
  if (d.id === 'hub' && d.scene.size < 1300) fail(`hub size ${d.scene.size} < 1300 (≥ 1.5 km² required)`);
  if (d.id !== 'hub' && d.scene.size < 1000 && (d.pois?.length ?? 0) > 0) fail(`district ${d.id} size ${d.scene.size} < 1000 (≥ 1 km² required once POIs exist)`);
}
// NPC roster
const rosterPath = join(content, 'characters', 'npcs.json');
if (existsSync(rosterPath)) {
  const roster = validate('npc-roster.schema.json', rosterPath);
  for (const a of roster.archetypes) {
    if (!districtIds.has(a.district)) fail(`npcs.json archetype ${a.id}: unknown district ${a.district}`);
    if (a.culturalReview && !reviewDoc.includes(a.id)) fail(`npcs.json archetype ${a.id} needs a cultural review entry in docs/content-review.md`);
  }
}

// Volatile freshness
const now = Date.now();
const maxMs = config.volatileMaxAgeDays * 86_400_000;
for (const q of questionIds.values()) {
  if (q.volatile && now - Date.parse(q.asOf) > maxMs) fail(`question ${q.id} is volatile and asOf ${q.asOf} is older than ${config.volatileMaxAgeDays} days — re-verify and bump asOf`);
}

// Credits cover assets/dist
const walk = (dir) => (existsSync(dir) ? readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)])) : []);
const distFiles = walk(join(root, 'assets', 'dist')).map((f) => relative(join(root, 'assets', 'dist'), f)).filter((f) => !f.endsWith('.gitkeep') && f !== 'manifest.json');
const credited = new Set(credits.assets.map((a) => a.path));
for (const f of distFiles) if (!credited.has(f)) fail(`assets/dist/${f} is not listed in assets/credits.json`);
for (const a of credits.assets) if (!distFiles.includes(a.path)) fail(`credits.json lists ${a.path} which is not in assets/dist`);

const totalQuestions = questionIds.size;
console.log(`validate-content: ${districts.length} districts, ${quests.length} quests, ${totalQuestions} questions, ${Object.keys(bundles).length} locales, ${distFiles.length} assets`);
if (errors.length) {
  for (const e of errors) console.error(` ✗ ${e}`);
  console.error(`validate-content: ${errors.length} error(s)`);
  process.exit(1);
}
console.log('validate-content: OK');
