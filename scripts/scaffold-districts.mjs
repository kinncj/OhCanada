// One-off scaffold for starter district manifests (kept for reproducibility; safe to re-run: skips existing files).
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const D = [
  { id: 'rights-responsibilities', code: 'rr', chapter: 'Rights and Responsibilities of Citizenship', name: ['Rights & Responsibilities', 'Droits et responsabilités'], desc: ['A courthouse square and a town hall where citizens learn what Canada asks of them.', 'Une place du palais de justice et un hôtel de ville où les citoyens apprennent ce que le Canada attend d\'eux.'], hdri: 'sky/partly_cloudy_1k.hdr', weather: 'clear', time: 0.45, palette: ['#5f8a3c', '#78a24a', '#98b866', '#b9c7a1'], kinds: ['maple', 'birch', 'shrub'], npc: ['Justice Okafor, Citizenship Judge', 'Justice Okafor, juge de la citoyenneté'], npcApp: { skinTone: 'tone-5', outfit: 'fleece', hair: 'short', hairColor: 'black' }, quest: ['The Oath', 'Le serment'], summary: ['Learn what the oath of citizenship commits you to.', 'Apprenez ce à quoi le serment de citoyenneté vous engage.'], trig: ['Courthouse steps', 'Marches du palais de justice'], landmark: 'courthouse' },
  { id: 'who-we-are', code: 'ww', chapter: 'Who We Are', name: ['Who We Are', 'Qui nous sommes'], desc: ['A lakeside gathering place honouring Indigenous peoples, the founding peoples, and the diversity of modern Canada.', 'Un lieu de rassemblement au bord d\'un lac honorant les peuples autochtones, les peuples fondateurs et la diversité du Canada moderne.'], hdri: 'sky/partly_cloudy_1k.hdr', weather: 'clear', time: 0.7, palette: ['#4f7f3a', '#6d9a4d', '#8db06a', '#c2c9a0'], kinds: ['pine', 'birch', 'rock'], npc: ['Elder Sarah Cardinal', 'L\'aînée Sarah Cardinal'], npcApp: { skinTone: 'tone-4', outfit: 'fleece', hair: 'braids', hairColor: 'grey' }, quest: ['Three Peoples', 'Trois peuples'], summary: ['Meet the peoples who shaped Canada.', 'Rencontrez les peuples qui ont façonné le Canada.'], trig: ['Gathering circle', 'Cercle de rassemblement'], landmark: 'circle' },
  { id: 'history', code: 'hi', chapter: 'Canada\'s History', name: ['Canada\'s History', 'L\'histoire du Canada'], desc: ['A fortified old town: palisades, a fur-trade post and Confederation-era streets.', 'Une vieille ville fortifiée : palissades, poste de traite des fourrures et rues de l\'époque de la Confédération.'], hdri: 'sky/partly_cloudy_1k.hdr', weather: 'fog', time: 0.3, palette: ['#5a7a3a', '#7a9a4c', '#9db06c', '#b8b58e'], kinds: ['spruce', 'pine', 'rock'], npc: ['Marie, Fur-Trade Historian', 'Marie, historienne de la traite des fourrures'], npcApp: { skinTone: 'tone-2', outfit: 'plaid', hair: 'long', hairColor: 'auburn' }, quest: ['Confederation Bell', 'La cloche de la Confédération'], summary: ['Trace the road to 1867.', 'Retracez le chemin vers 1867.'], trig: ['The old fort gate', 'La porte du vieux fort'], landmark: 'fort' },
  { id: 'modern-canada', code: 'mc', chapter: 'Modern Canada', name: ['Modern Canada', 'Le Canada moderne'], desc: ['A downtown of glass towers, a hockey arena and a research campus.', 'Un centre-ville de tours de verre, une aréna de hockey et un campus de recherche.'], hdri: 'sky/partly_cloudy_1k.hdr', weather: 'rain', time: 0.55, palette: ['#4a6a3a', '#6a8a4a', '#8ea470', '#9aa39a'], kinds: ['maple', 'shrub'], npc: ['Dev Patel, City Planner', 'Dev Patel, urbaniste'], npcApp: { skinTone: 'tone-4', outfit: 'raincoat', hair: 'short', hairColor: 'black' }, quest: ['Inventors\' Walk', 'La promenade des inventeurs'], summary: ['Discover Canadian innovations and modern society.', 'Découvrez les innovations canadiennes et la société moderne.'], trig: ['Arena plaza', 'Place de l\'aréna'], landmark: 'arena' },
  { id: 'government', code: 'gv', chapter: 'How Canadians Govern Themselves', name: ['How Canadians Govern Themselves', 'Comment les Canadiens se gouvernent'], desc: ['A provincial legislature, a city hall and Rideau Hall in one civic district.', 'Une assemblée législative provinciale, un hôtel de ville et Rideau Hall dans un même district civique.'], hdri: 'sky/partly_cloudy_1k.hdr', weather: 'clear', time: 0.4, palette: ['#5f8a3c', '#7ca04c', '#9cb66a', '#c8caa5'], kinds: ['maple', 'birch'], npc: ['Speaker Nguyen', 'Le président Nguyen'], npcApp: { skinTone: 'tone-3', outfit: 'fleece', hair: 'buzz', hairColor: 'black' }, quest: ['Three Branches', 'Trois pouvoirs'], summary: ['Understand the three branches and three levels of government.', 'Comprenez les trois pouvoirs et les trois ordres de gouvernement.'], trig: ['Legislature steps', 'Marches de l\'assemblée'], landmark: 'legislature' },
  { id: 'elections', code: 'el', chapter: 'Federal Elections', name: ['Federal Elections', 'Les élections fédérales'], desc: ['A polling station, a campaign square and a returning office.', 'Un bureau de vote, une place de campagne et un bureau du directeur du scrutin.'], hdri: 'sky/partly_cloudy_1k.hdr', weather: 'clear', time: 0.5, palette: ['#5a8a3a', '#7aa04c', '#9bb86a', '#c9cfa8'], kinds: ['maple', 'shrub'], npc: ['Fatima, Returning Officer', 'Fatima, directrice du scrutin'], npcApp: { skinTone: 'tone-4', outfit: 'parka', hair: 'bun', hairColor: 'black', accessory: 'glasses' }, quest: ['Cast Your Ballot', 'Déposez votre bulletin'], summary: ['Learn how to vote and how a government is formed.', 'Apprenez comment voter et comment un gouvernement est formé.'], trig: ['Polling station', 'Bureau de vote'], landmark: 'pollingstation' },
  { id: 'justice', code: 'ju', chapter: 'The Justice System', name: ['The Justice System', 'Le système judiciaire'], desc: ['A Supreme Court plaza, a police station and a small-claims court.', 'Une place de la Cour suprême, un poste de police et une cour des petites créances.'], hdri: 'sky/partly_cloudy_1k.hdr', weather: 'clear', time: 0.35, palette: ['#587f3a', '#749a4c', '#96b26a', '#c1c6a2'], kinds: ['pine', 'shrub', 'rock'], npc: ['Constable Tremblay', 'L\'agent Tremblay'], npcApp: { skinTone: 'tone-2', outfit: 'hockey', hair: 'short', hairColor: 'brown' }, quest: ['Innocent Until Proven Guilty', 'Présumé innocent'], summary: ['Explore the principles behind Canadian justice.', 'Explorez les principes du système judiciaire canadien.'], trig: ['Court plaza', 'Place de la Cour'], landmark: 'supremecourt' },
  { id: 'symbols', code: 'sy', chapter: 'Canadian Symbols', name: ['Canadian Symbols', 'Les symboles canadiens'], desc: ['A festival ground of flags, a beaver pond and a hockey rink.', 'Un terrain de festival avec drapeaux, un étang de castors et une patinoire.'], hdri: 'sky/partly_cloudy_1k.hdr', weather: 'snow', time: 0.6, palette: ['#e8eef3', '#d3dde6', '#bcc9d4', '#9fb0bf'], kinds: ['spruce', 'pine'], npc: ['Coach Bouchard', 'L\'entraîneuse Bouchard'], npcApp: { skinTone: 'tone-1', outfit: 'hockey', hair: 'long', hairColor: 'blond', accessory: 'toque' }, quest: ['Raise the Flag', 'Hissez le drapeau'], summary: ['Collect the symbols that represent Canada.', 'Rassemblez les symboles qui représentent le Canada.'], trig: ['Rink', 'Patinoire'], landmark: 'rink' },
  { id: 'economy', code: 'ec', chapter: 'Canada\'s Economy', name: ['Canada\'s Economy', 'L\'économie du Canada'], desc: ['Grain elevators, a port with container cranes and a tech incubator.', 'Silos à grains, un port avec grues à conteneurs et un incubateur technologique.'], hdri: 'sky/partly_cloudy_1k.hdr', weather: 'clear', time: 0.48, palette: ['#8a8a3c', '#a89a4a', '#c2b168', '#d8cfa4'], kinds: ['wheat', 'shrub'], npc: ['Captain Singh, Harbourmaster', 'La capitaine Singh, capitaine de port'], npcApp: { skinTone: 'tone-4', outfit: 'raincoat', hair: 'bun', hairColor: 'black' }, quest: ['Trade Routes', 'Routes commerciales'], summary: ['Follow Canadian goods from farm to port.', 'Suivez les produits canadiens de la ferme au port.'], trig: ['Harbour office', 'Bureau du port'], landmark: 'port' },
  { id: 'regions', code: 're', chapter: 'Canada\'s Regions', name: ['Canada\'s Regions', 'Les régions du Canada'], desc: ['Five sub-zones: Atlantic shore, Central lakes, Prairie fields, West Coast rainforest and the Arctic North.', 'Cinq sous-zones : rive atlantique, lacs du Centre, champs des Prairies, forêt pluviale de la côte Ouest et Grand Nord arctique.'], hdri: 'sky/partly_cloudy_1k.hdr', weather: 'clear', time: 0.5, palette: ['#4f7f3a', '#8aa04a', '#c2b168', '#e8eef3'], kinds: ['pine', 'wheat', 'iceberg', 'tundra-grass'], npc: ['Ranger Aputik', 'La garde Aputik'], npcApp: { skinTone: 'tone-3', outfit: 'parka', hair: 'long', hairColor: 'black', accessory: 'scarf' }, quest: ['Coast to Coast to Coast', 'D\'un océan à l\'autre et à l\'autre'], summary: ['Visit all five regions.', 'Visitez les cinq régions.'], trig: ['Lookout', 'Belvédère'], landmark: 'lookout' },
];
for (const d of D) {
  const file = join(root, 'content', 'districts', `${d.id}.json`);
  const qfile = join(root, 'content', 'quests', `${d.id}-intro.json`);
  const npcId = `npc-${d.id}-1`;
  const questId = `${d.id}-intro`;
  const trig = `${d.id}-landmark`;
  if (!existsSync(file)) {
    writeFileSync(file, JSON.stringify({
      $schema: '../schemas/district.schema.json', id: d.id, subject: d.id, chapter: d.chapter,
      name: { en: d.name[0], fr: d.name[1] }, description: { en: d.desc[0], fr: d.desc[1] },
      spawn: { position: [0, 0, 30], yaw: 3.14159 },
      scene: { generator: d.id === 'regions' ? 'regions' : 'district', seed: 1000 + D.indexOf(d), size: 240,
        terrain: { amplitude: d.id === 'regions' ? 6 : 2.5, frequency: 0.03, snow: d.weather === 'snow', palette: d.palette },
        water: [{ position: [60, -0.6, -40], size: [60, 60] }],
        vegetation: { density: 0.4, kinds: d.kinds },
        landmarks: [
          { id: `${d.id}-main`, type: d.landmark, position: [0, 0, -20], label: { en: d.trig[0], fr: d.trig[1] } },
          { id: `${d.id}-station`, type: 'station', position: [40, 0, 40], rotationY: -0.8, label: { en: 'Station', fr: 'Gare' } },
          { id: `${d.id}-lamp-1`, type: 'lamp', position: [6, 0, 10] }, { id: `${d.id}-lamp-2`, type: 'lamp', position: [-6, 0, 10] },
          { id: `${d.id}-flag`, type: 'flagpole', position: [12, 0, 4] },
        ],
        ambience: { hdri: d.hdri, timeOfDay: d.time, weather: d.weather, audio: 'wind', fogDensity: d.weather === 'fog' ? 0.012 : 0.004 } },
      npcs: [{ id: npcId, name: { en: d.npc[0], fr: d.npc[1] }, position: [3, 0, 12], behavior: 'idle', questRefs: [questId],
        idleDialogue: { en: `Welcome to ${d.name[0]}. There is much to learn here.`, fr: `Bienvenue dans ${d.name[1]}. Il y a beaucoup à apprendre ici.` }, appearance: d.npcApp }],
      triggers: [
        { id: trig, position: [0, 0, -12], radius: 4, kind: 'zone', label: { en: d.trig[0], fr: d.trig[1] } },
        { id: `${d.id}-portal-hub`, position: [40, 0, 40], radius: 4, kind: 'portal', toDistrict: 'hub', label: { en: 'Train back to Parliament Hill', fr: 'Train de retour vers la Colline du Parlement' } },
      ],
      quests: [questId],
    }, null, 2) + '\n');
  }
  if (!existsSync(qfile)) {
    writeFileSync(qfile, JSON.stringify({
      $schema: '../schemas/quest.schema.json', id: questId, district: d.id, type: 'dialogue',
      title: { en: d.quest[0], fr: d.quest[1] }, summary: { en: d.summary[0], fr: d.summary[1] }, giverNpc: npcId,
      steps: [
        { id: 'talk', kind: 'talk', npc: npcId, objective: { en: `Talk to ${d.npc[0]}`, fr: `Parlez à ${d.npc[1]}` },
          dialogue: [{ speaker: npcId, text: { en: `Glad you made it. Head to the ${d.trig[0].toLowerCase()} and I'll test what you know.`, fr: `Content de vous voir. Rendez-vous à ${d.trig[1].toLowerCase()} et je testerai vos connaissances.` } }] },
        { id: 'reach', kind: 'reach', trigger: trig, objective: { en: `Reach the ${d.trig[0].toLowerCase()}`, fr: `Rendez-vous à ${d.trig[1].toLowerCase()}` } },
        { id: 'quiz', kind: 'answer', questions: [`q-${d.code}-001`, `q-${d.code}-002`, `q-${d.code}-003`], minCorrect: 2, objective: { en: 'Answer three questions (2 of 3 to pass)', fr: 'Répondez à trois questions (2 sur 3 pour réussir)' } },
      ],
      reward: { stamp: `stamp-${questId}` },
      completionDialogue: [{ speaker: npcId, text: { en: 'Well done. Another stamp for your passport!', fr: 'Bravo. Un autre timbre pour votre passeport!' } }],
    }, null, 2) + '\n');
  }
}
console.log('scaffolded');
