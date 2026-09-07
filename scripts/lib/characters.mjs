/**
 * Quaternius Universal Base Characters + Universal Animation Library → one GLB per body:
 * body skin (light tone embedded), hairstyles merged as extra skinned meshes on the body's skeleton,
 * and the requested UAL clips retargeted by joint name. Skin tones are emitted as standalone textures.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { copyToDocument, dedup, draco, prune, resample, textureCompress, unpartition } from '@gltf-transform/functions';
import { toktx, Mode } from '@gltf-transform/cli';
import sharp from 'sharp';

export const UBC_URL = 'https://quaternius.itch.io/universal-base-characters';
export const UAL_URL = 'https://quaternius.itch.io/universal-animation-library';

export const BODIES = {
  male: {
    gltf: 'Base Characters/Godot - UE/Superhero_Male_FullBody.gltf',
    meshNode: 'SuperHero_Male',
    skin: { light: 'Base Characters/Textures/T_Superhero_Male_Ligh.png', dark: 'Base Characters/Textures/T_Superhero_Male_Dark.png' },
    hair: ['Hair_Buzzed', 'Hair_SimpleParted', 'Hair_Long', 'Hair_Buns', 'Hair_Beard'],
  },
  female: {
    gltf: 'Base Characters/Godot - UE/Superhero_Female_FullBody.gltf',
    meshNode: 'Superhero_Female',
    skin: { light: 'Base Characters/Textures/T_Superhero_Female_Light_BaseColor.png', dark: 'Base Characters/Textures/T_Superhero_Female_Dark_BaseColor.png' },
    hair: ['Hair_BuzzedFemale', 'Hair_SimpleParted', 'Hair_Long', 'Hair_Buns'],
  },
};
export const ANIMATIONS = ['Idle_Loop', 'Idle_Talking_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Interact', 'Sitting_Idle_Loop'];
const HAIR_DIR = 'Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)';

/** Extract an itch zip once (marker file), returning the directory holding the pack's top-level folder. */
export function unzipOnce(zip, dir) {
  const marker = join(dir, '.extracted');
  if (!existsSync(marker)) {
    mkdirSync(dir, { recursive: true });
    execFileSync('unzip', ['-oq', zip, '-d', dir], { stdio: 'inherit' });
    writeFileSync(marker, `${statSync(zip).size}\n`);
  }
  return dir;
}

/** The exporter wrote `*_png.png` image URIs for files shipped as `*.png`: create the missing aliases. */
function fixImageUris(gltfPath) {
  const gltf = JSON.parse(readFileSync(gltfPath, 'utf8'));
  for (const img of gltf.images ?? []) {
    const p = join(dirname(gltfPath), img.uri);
    const alt = p.replace(/_png\.png$/, '.png');
    if (!existsSync(p) && alt !== p && existsSync(alt)) copyFileSync(alt, p);
  }
}

function copyAccessor(doc, acc, buffer, cache) {
  if (cache.has(acc)) return cache.get(acc);
  const out = doc.createAccessor(acc.getName()).setType(acc.getType()).setNormalized(acc.getNormalized()).setArray(acc.getArray().slice()).setBuffer(buffer);
  cache.set(acc, out);
  return out;
}

/**
 * Build one character. Returns { glb, skin: { light, dark } (PNG buffers), hair: [names], animations: [names], report }.
 */
export async function buildCharacter(io, { body, ubcDir, ualGlb, textureFormat, log = console.log }) {
  const spec = BODIES[body];
  const bodyGltf = join(ubcDir, spec.gltf);
  fixImageUris(bodyGltf);
  const doc = await io.read(bodyGltf);
  doc.setLogger({ debug() {}, info() {}, warn: (m) => log(`  warn ${m}`), error: (m) => log(`  ERROR ${m}`) });
  const root = doc.getRoot();
  const buffer = root.listBuffers()[0];
  const skin = root.listSkins()[0];
  const bodyJoints = skin.listJoints().map((j) => j.getName());
  const nodeByName = new Map(root.listNodes().map((n) => [n.getName(), n]));
  const bodyNode = nodeByName.get(spec.meshNode);
  if (!bodyNode) throw new Error(`${body}: mesh node ${spec.meshNode} not found`);
  const armature = bodyNode.listParents().find((p) => p.propertyType === 'Node') ?? root.getDefaultScene();

  // Skin tone: embed the light texture; both tones are emitted separately for runtime swapping.
  const light = readFileSync(join(ubcDir, spec.skin.light));
  const dark = readFileSync(join(ubcDir, spec.skin.dark));
  const bodyMat = bodyNode.getMesh().listPrimitives()[0].getMaterial();
  bodyMat.getBaseColorTexture().setImage(light).setMimeType('image/png').setName(`${body}_skin_light`);

  // Hairstyles: copy each mesh in and bind it to the body's skeleton.
  const hair = [];
  for (const style of spec.hair) {
    const path = join(ubcDir, HAIR_DIR, `${style}.gltf`);
    if (!existsSync(path)) { log(`  ${body}: hairstyle ${style} missing, skipped`); continue; }
    fixImageUris(path);
    const hdoc = await io.read(path);
    const hnode = hdoc.getRoot().listNodes().find((n) => n.getMesh() && n.getSkin());
    const hjoints = hnode.getSkin().listJoints().map((j) => j.getName());
    const map = copyToDocument(doc, hdoc, [hnode.getMesh()]);
    const mesh = map.get(hnode.getMesh()).setName(style);
    if (hjoints.join() !== bodyJoints.join()) {
      const remap = hjoints.map((n) => bodyJoints.indexOf(n));
      for (const prim of mesh.listPrimitives()) {
        const acc = prim.getAttribute('JOINTS_0');
        const arr = acc.getArray();
        for (let i = 0; i < arr.length; i++) arr[i] = Math.max(0, remap[arr[i]]);
        acc.setArray(arr);
      }
      log(`  ${body}: ${style} joints remapped by name`);
    }
    for (const p of mesh.listPrimitives()) p.getMaterial()?.setName(`${style}_material`);
    armature.addChild(doc.createNode(style).setMesh(mesh).setSkin(skin));
    hair.push(style);
  }

  // Animations from the Universal Animation Library, retargeted by joint name.
  const ual = await io.read(ualGlb);
  const animations = [];
  for (const name of ANIMATIONS) {
    const src = ual.getRoot().listAnimations().find((a) => a.getName() === name);
    if (!src) { log(`  ${body}: clip ${name} not in UAL, skipped`); continue; }
    const anim = doc.createAnimation(name);
    const cache = new Map();
    let dropped = 0;
    for (const ch of src.listChannels()) {
      const target = nodeByName.get(ch.getTargetNode()?.getName());
      if (!target) { dropped++; continue; }
      const s = ch.getSampler();
      const sampler = doc.createAnimationSampler().setInterpolation(s.getInterpolation()).setInput(copyAccessor(doc, s.getInput(), buffer, cache)).setOutput(copyAccessor(doc, s.getOutput(), buffer, cache));
      anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(target).setTargetPath(ch.getTargetPath()).setSampler(sampler));
    }
    if (dropped) log(`  ${body}: ${name}: dropped ${dropped} channel(s) with no matching joint`);
    animations.push(name);
  }

  const normal = /normalTexture/;
  const color = /baseColorTexture|metallicRoughnessTexture|occlusionTexture|emissiveTexture/;
  await doc.transform(resample(), dedup());
  if (textureFormat === 'ktx2') {
    await doc.transform(
      toktx({ mode: Mode.UASTC, encoder: sharp, slots: normal, pattern: /Hair|Eye/, resize: [512, 512], level: 2, rdo: true, rdoLambda: 2, zstd: 18 }),
      toktx({ mode: Mode.UASTC, encoder: sharp, slots: normal, resize: [1024, 1024], level: 2, rdo: true, rdoLambda: 2, zstd: 18 }),
      toktx({ mode: Mode.ETC1S, encoder: sharp, slots: color, resize: [1024, 1024], quality: 128 }),
    );
  } else {
    await doc.transform(
      textureCompress({ encoder: sharp, targetFormat: 'webp', slots: normal, pattern: /Hair|Eye/, resize: [512, 512], quality: 88 }),
      textureCompress({ encoder: sharp, targetFormat: 'webp', slots: normal, resize: [1024, 1024], quality: 88 }),
      textureCompress({ encoder: sharp, targetFormat: 'webp', slots: color, resize: [1024, 1024], quality: 82 }),
    );
  }
  await doc.transform(prune(), dedup(), unpartition(), draco({ method: 'edgebreaker' }));
  const glb = await io.writeBinary(doc);
  return { glb, skin: { light, dark }, hair, animations, joints: bodyJoints.length };
}

/** Verify the contract on final bytes: one skin, 65 joints, hair nodes present, the requested clips. */
export async function inspectCharacter(io, glbBytes) {
  const doc = await io.readBinary(glbBytes);
  const root = doc.getRoot();
  return {
    skins: root.listSkins().length,
    joints: root.listSkins()[0]?.listJoints().length ?? 0,
    animations: root.listAnimations().map((a) => a.getName()),
    meshNodes: root.listNodes().filter((n) => n.getMesh()).map((n) => n.getName()),
    textures: root.listTextures().map((t) => `${t.getName() || t.getURI()}:${t.getMimeType()}:${t.getSize()?.join('x')}:${(t.getImage().byteLength / 1024) | 0}KB`),
  };
}
