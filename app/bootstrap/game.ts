import * as THREE from 'three/webgpu';
import type { EventBus } from '@common/event-bus';
import type { GameEvents } from '@application/events';
import type { GameConfig, GraphicsPreset, PresetName } from '@application/ports';
import type { AudioPort, InputPort, PhysicsWorldPort } from '@application/engine-ports';
import type { District, Npc, Soundscape, Trigger } from '@domain/district';
import type { CharacterAppearance, CharacterCatalog } from '@domain/character';
import type { NpcAppearance } from '@domain/district';
import { districtId, triggerId, type DistrictId, type TriggerId } from '@domain/ids';
import { createPlayer, withinRadius, type PlayerComponent } from '@domain/player';
import { GameRenderer, Environment, WorldScene, CharacterView, Weather, CameraRig, AssetLibrary, SkinnedCharacterView, type AppearanceSpec } from '@adapters/rendering';
import { YukaNpcBrain } from '@adapters/ai/yuka-npc-brain';

export interface GameDeps {
  readonly canvas: HTMLCanvasElement;
  readonly bus: EventBus<GameEvents>;
  readonly config: GameConfig;
  readonly physics: PhysicsWorldPort;
  readonly input: InputPort;
  readonly audio: AudioPort;
  readonly catalog: CharacterCatalog;
  readonly assetBase: string;
  readonly forceWebGL?: boolean;
}

export interface Nearby {
  readonly kind: 'npc' | 'trigger';
  readonly id: string;
  readonly npc?: Npc;
  readonly trigger?: Trigger;
}

const PLAYER_RADIUS = 0.35;
const PLAYER_HALF_HEIGHT = 0.55;
const WALK = 4.2;
const SPRINT = 7.5;
const JUMP = 7.5;
const INTERACT_RANGE = 3.2;

/**
 * Engine composition: owns the Three scene, physics, input, camera, NPC brains and the fixed-step loop.
 * Gameplay decisions live in Flow (bootstrap/flow.ts); this class only reports what the player is near.
 */
export class Game {
  readonly scene = new THREE.Scene();
  readonly renderer: GameRenderer;
  readonly rig: CameraRig;
  readonly environment: Environment;
  readonly weather: Weather;
  readonly npcBrain = new YukaNpcBrain();
  world: WorldScene | null = null;
  district: District | null = null;
  player: PlayerComponent;
  playerView: CharacterView | SkinnedCharacterView | null = null;
  library: AssetLibrary | null = null;
  private playerHandle = -1;
  private readonly npcViews = new Map<string, CharacterView | SkinnedCharacterView>();
  private readonly talking = new Set<string>();
  private preset: GraphicsPreset;
  private presetName = 'medium';
  private running = false;
  private elapsed = 0;
  private accumulator = 0;
  private lastTime = 0;
  private readonly insideTriggers = new Set<string>();
  private currentPoi: string | null = null;
  private readonly tmpF = new THREE.Vector3();
  private readonly tmpR = new THREE.Vector3();
  private readonly playerPos = new THREE.Vector3();
  paused = false;
  /** In-flight district load (single-flight: a second request for the same district reuses it). */
  private loadingDistrict: { id: string; promise: Promise<void> } | null = null;
  /** Set by Flow; when false, movement input is ignored (menus open). */
  gameplayEnabled = false;
  onFrame: ((dt: number) => void) | null = null;

  private constructor(
    private readonly deps: GameDeps,
    renderer: GameRenderer,
  ) {
    this.renderer = renderer;
    this.rig = new CameraRig(window.innerWidth / window.innerHeight);
    this.environment = new Environment(this.scene, deps.assetBase);
    this.weather = new Weather();
    this.scene.add(this.weather.group);
    this.preset = deps.config.graphicsPresets.medium;
    this.player = createPlayer(deps.config.startDistrict, [0, 0, 0], 0);
    renderer.attach(this.scene, this.rig.camera);
    window.addEventListener('resize', () => renderer.resize());
  }

  static async create(deps: GameDeps): Promise<Game> {
    const renderer = await GameRenderer.create({ canvas: deps.canvas, forceWebGL: deps.forceWebGL ?? false });
    await deps.physics.init();
    const game = new Game(deps, renderer);
    game.library = await AssetLibrary.create(deps.assetBase, renderer.renderer);
    game.playerHandle = deps.physics.createCharacter([0, 5, 0], PLAYER_RADIUS, PLAYER_HALF_HEIGHT);
    return game;
  }

  get backend(): string {
    return this.renderer.backend;
  }

  get presetLabel(): string {
    return this.presetName;
  }

  applyGraphics(name: PresetName, reducedMotion: boolean): void {
    this.preset = this.deps.config.graphicsPresets[name];
    this.presetName = name;

    this.rig.reducedMotion = reducedMotion;
    this.renderer.applyPreset(this.preset, reducedMotion);
    this.weather.set(this.district?.scene.ambience.weather ?? 'clear', name === 'minimal' ? 0 : Math.round(this.preset.maxInstances * 0.5));
  }

  async setPlayerAppearance(appearance: CharacterAppearance): Promise<void> {
    const view = await this.makeCharacter(this.resolve(appearance));
    this.playerView?.dispose();
    this.playerView = view;
    view.root.name = 'player';
    this.scene.add(view.root);
    this.syncPlayerView();
  }

  /** Real rigged human when the asset library has one, procedural humanoid otherwise. */
  private async makeCharacter(spec: AppearanceSpec): Promise<CharacterView | SkinnedCharacterView> {
    const lib = this.library;
    const bodyKey = spec.body === 'slim' || spec.body === 'tall' ? 'female' : 'male';
    if (lib?.hasCharacter(bodyKey)) {
      try {
        const gltf = await lib.character(bodyKey);
        const entry = lib.characterEntry(bodyKey)!;
        return new SkinnedCharacterView(gltf, entry, bodyKey, spec, lib, this.preset.assetPolicy === 'lite');
      } catch (e) {
        console.warn('character asset failed, using procedural view', e);
      }
    }
    return new CharacterView(spec);
  }

  private resolve(a: CharacterAppearance | (NpcAppearance & { body?: string | undefined; face?: string })): AppearanceSpec {
    const c = this.deps.catalog;
    const val = (opts: readonly { id: string; value?: string }[], id: string, fallback: string) => opts.find((o) => o.id === id)?.value ?? fallback;
    const npc = a as Partial<NpcAppearance>;
    const body = a.body === 'male' ? 'average' : a.body === 'female' ? 'slim' : (a.body ?? 'average');
    return {
      body,
      face: a.face ?? 'round',
      skinColor: val(c.skinTones, a.skinTone, '#c68f64'),
      hair: a.hair,
      hairColor: npc.age === 'elder' ? '#a9a9a9' : val(c.hairColors, a.hairColor, '#1a1412'),
      outfitColor: val(c.outfits, a.outfit, '#c8102e'),
      accessory: a.accessory ?? 'none',
      ...(npc.outfitStyle ? { outfitStyle: npc.outfitStyle } : {}),
      ...(npc.bottomColor ? { bottomColor: npc.bottomColor } : {}),
      ...(npc.hat ? { hat: npc.hat } : {}),
      ...(npc.age ? { age: npc.age } : {}),
      ...(npc.beard !== undefined ? { beard: npc.beard } : {}),
    };
  }

  async loadDistrict(district: District, onProgress?: (f: number) => void): Promise<void> {
    if (this.loadingDistrict) {
      // Wait for whatever is loading; if it is the same district we are done.
      const pending = this.loadingDistrict;
      await pending.promise.catch(() => undefined);
      if (pending.id === district.id && this.district?.id === district.id) {
        onProgress?.(1);
        return;
      }
    }
    if (this.district?.id === district.id && this.world) {
      onProgress?.(1);
      return; // already resident (e.g. hub loaded as the menu backdrop)
    }
    const promise = this.loadDistrictInner(district, onProgress);
    this.loadingDistrict = { id: district.id, promise };
    try {
      await promise;
    } finally {
      if (this.loadingDistrict?.promise === promise) this.loadingDistrict = null;
    }
  }

  private async loadDistrictInner(district: District, onProgress?: (f: number) => void): Promise<void> {
    this.deps.bus.emit('district:load-requested', { district: district.id });
    const t0 = performance.now();
    const stage = (name: string) => console.info(`[truenorth] ${JSON.stringify({ type: 'load:stage', payload: { name, ms: Math.round(performance.now() - t0) } })}`);
    onProgress?.(0.05);
    this.unloadDistrict();
    this.district = district;
    const world = await WorldScene.create(district, this.preset, this.library, (f) => onProgress?.(0.05 + f * 0.45));
    this.world = world;
    this.scene.add(world.group);
    stage('world');
    onProgress?.(0.5);
    // Physics
    const t = world.terrain;
    this.deps.physics.addHeightfield([0, 0, 0], district.scene.size, t.heights, t.rows, t.cols, t.maxHeight);
    for (const c of world.colliders) {
      if (c.kind === 'box') this.deps.physics.addBox(c.center, c.halfExtents, c.rotationY);
      else this.deps.physics.addCylinder(c.center, c.halfExtents[1], c.halfExtents[0]);
    }
    stage('physics');
    onProgress?.(0.55);
    // NPCs
    this.npcBrain.setHeightFunction(world.heightAt);
    for (const npc of district.npcs) {
      const view = await this.makeCharacter(this.resolve({ ...npc.appearance, body: npc.appearance.body ?? (hashNpc(npc.id) ? 'female' : 'male') }));
      view.root.name = `npc:${npc.id}`;
      this.scene.add(view.root);
      this.npcViews.set(npc.id, view);
      const y = world.heightAt(npc.position[0], npc.position[2]);
      this.npcBrain.add(npc.id, [npc.position[0], y, npc.position[2]], npc.behavior, npc.wanderRadius ?? 6);
    }
    stage('npcs');
    onProgress?.(0.7);
    await this.environment.load(district.scene.ambience, this.preset, this.deps.config.featureFlags.dayNightCycle ?? true);
    this.weather.set(this.deps.config.featureFlags.weather === false ? 'clear' : district.scene.ambience.weather, Math.round(this.preset.maxInstances * 0.5));
    this.setZoneAudio(district.scene.ambience.soundscape);
    stage('environment');
    onProgress?.(0.9);
    // Compile every material/pipeline while the loading screen is still up instead of stalling the first frames.
    try {
      await this.renderer.renderer.compileAsync(this.scene, this.rig.camera);
    } catch (e) {
      console.warn('[truenorth] precompile failed', e);
    }
    stage('compile');
    onProgress?.(0.97);
    // Player
    const sp = district.spawn.position;
    this.teleport(sp[0], sp[2], district.spawn.yaw);
    this.player.district = district.id;
    this.insideTriggers.clear();
    this.currentPoi = null;
    this.deps.bus.emit('district:loaded', { district: district.id });
    onProgress?.(1);
  }

  unloadDistrict(): void {
    if (this.world) {
      this.world.dispose();
      this.world = null;
    }
    this.deps.physics.clearStatic();
    for (const v of this.npcViews.values()) v.dispose();
    this.npcViews.clear();
    this.npcBrain.clear();
    this.deps.audio.stopAmbience();
    this.district = null;
  }

  teleport(x: number, z: number, yaw?: number): void {
    const y = (this.world?.heightAt(x, z) ?? 0) + PLAYER_HALF_HEIGHT + PLAYER_RADIUS + 0.2;
    this.player.transform = { position: [x, y, z], yaw: yaw ?? this.player.transform.yaw };
    this.deps.physics.setCharacterPosition(this.playerHandle, [x, y, z]);
    if (yaw !== undefined) this.rig.yaw = yaw;
    this.syncPlayerView();
    this.rig.snapTo(this.playerPos.set(x, y - PLAYER_HALF_HEIGHT - PLAYER_RADIUS, z));
  }

  private syncPlayerView(): void {
    if (!this.playerView) return;
    const [x, y, z] = this.player.transform.position;
    this.playerView.root.position.set(x, y - PLAYER_HALF_HEIGHT - PLAYER_RADIUS, z);
    this.playerView.root.rotation.y = this.player.transform.yaw;
  }

  /** Nearest interactable within range: NPCs first, then non-zone triggers (portals). */
  nearby(): Nearby | null {
    if (!this.district) return null;
    const p = this.player.transform.position;
    let best: Nearby | null = null;
    let bestD = Infinity;
    for (const npc of this.district.npcs) {
      const pose = this.npcBrain.pose(npc.id);
      if (!pose) continue;
      const d = Math.hypot(pose.x - p[0], pose.z - p[2]);
      if (d < INTERACT_RANGE && d < bestD) {
        bestD = d;
        best = { kind: 'npc', id: npc.id, npc };
      }
    }
    if (best) return best;
    for (const t of this.district.triggers) {
      if (t.kind !== 'portal') continue;
      if (withinRadius(p, t.position, t.radius)) return { kind: 'trigger', id: t.id, trigger: t };
    }
    return null;
  }

  npcWorldPosition(id: string): readonly [number, number, number] | null {
    const pose = this.npcBrain.pose(id);
    return pose ? [pose.x, pose.y, pose.z] : null;
  }

  attendNpc(id: string, attend: boolean): void {
    this.npcBrain.attend(id, attend ? this.player.transform.position : null);
    if (attend) this.talking.add(id);
    else this.talking.delete(id);
  }

  hideTrigger(id: TriggerId): void {
    this.world?.setMarkerVisible(id, false);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const loop = async (): Promise<void> => {
      if (!this.running) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - this.lastTime) / 1000);
      this.lastTime = now;
      this.tick(dt);
      await this.renderer.render();
      requestAnimationFrame(() => void loop());
    };
    void loop();
  }

  stop(): void {
    this.running = false;
  }

  private tick(dt: number): void {
    this.elapsed += dt;
    const step = 1 / 60;
    this.accumulator = Math.min(this.accumulator + dt, 0.2);
    let speed = 0;
    while (this.accumulator >= step) {
      speed = this.simulate(step);
      this.accumulator -= step;
    }
    const [px, py, pz] = this.player.transform.position;
    this.playerPos.set(px, py - PLAYER_HALF_HEIGHT - PLAYER_RADIUS, pz);
    this.playerView?.animate(dt, speed, this.player.grounded);
    // NPC views
    for (const [id, view] of this.npcViews) {
      const pose = this.npcBrain.pose(id);
      if (!pose) continue;
      view.root.position.set(pose.x, pose.y, pose.z);
      view.root.rotation.y = pose.yaw;
      view.animate(dt, pose.speed, true, this.talking.has(id));
    }
    if (this.freeCam) {
      this.rig.camera.position.copy(this.freeCam.eye);
      this.rig.camera.lookAt(this.freeCam.target);
    } else this.rig.update(dt, this.playerPos, speed, this.world?.occluders ?? []);
    this.environment.update(this.paused ? 0 : dt, this.playerPos);
    this.world?.update(dt, this.rig.camera.position, this.elapsed);
    this.world?.setNight(this.environment.isNight);
    this.weather.update(dt, this.rig.camera.position, this.elapsed);
    this.onFrame?.(dt);
    if (Math.floor(this.elapsed * 2) !== Math.floor((this.elapsed - dt) * 2)) {
      const s = this.renderer.stats();
      this.deps.bus.emit('debug:frame', { ...s, chunks: this.world ? this.world.pending.length + 1 : 0 });
    }
  }

  private simulate(step: number): number {
    const input = this.gameplayEnabled && !this.paused ? this.deps.input.poll() : null;
    let speed = 0;
    let desired: [number, number, number] = [0, 0, 0];
    if (input) {
      this.rig.look(input.look.dx, input.look.dy);
      const f = this.rig.forward(this.tmpF);
      const r = this.rig.right(this.tmpR);
      const mx = f.x * input.move.y + r.x * input.move.x;
      const mz = f.z * input.move.y + r.z * input.move.x;
      const len = Math.hypot(mx, mz);
      if (len > 0.01) {
        speed = input.sprint ? SPRINT : WALK;
        desired = [(mx / len) * speed * step, 0, (mz / len) * speed * step];
        this.player.transform.yaw = Math.atan2(mx, mz);
      }
      if (input.jump && this.player.grounded) desired[1] = JUMP;
    }
    this.npcBrain.update();
    const res = this.deps.physics.moveCharacter(this.playerHandle, desired);
    this.deps.physics.step(step);
    this.player.transform.position = res.position;
    this.player.grounded = res.grounded;
    this.player.sprinting = !!input?.sprint;
    // fell through the world? put back on the terrain
    if (res.position[1] < -20) {
      const [x, , z] = res.position;
      this.teleport(x, z);
    }
    this.syncPlayerView();
    this.checkTriggers();
    this.checkPois();
    return speed;
  }

  /** POI the player stands in (zone ambience, fast-travel discovery). */
  private checkPois(): void {
    if (!this.district) return;
    const p = this.player.transform.position;
    let inside: string | null = null;
    for (const poi of this.district.pois) if (withinRadius(p, poi.position, poi.radius)) inside = poi.id;
    if (inside === this.currentPoi) return;
    this.currentPoi = inside;
    const poi = this.district.pois.find((x) => x.id === inside);
    this.setZoneAudio(poi?.ambience ?? this.district.scene.ambience.soundscape);
    if (poi) this.deps.bus.emit('poi:entered', { poi: poi.id, district: this.district.id });
  }

  private freeCam: { eye: THREE.Vector3; target: THREE.Vector3 } | null = null;
  /** Detach the camera for screenshots/cinematics; movement input still runs. */
  freeCamera(eye: readonly [number, number, number] | null, target: readonly [number, number, number] = [0, 0, 0]): void {
    this.freeCam = eye ? { eye: new THREE.Vector3(...eye), target: new THREE.Vector3(...target) } : null;
  }

  /** Crossfade to a zone soundscape (loop + one-shots); falls back to a plain loop on older adapters. */
  private setZoneAudio(zone: Soundscape): void {
    const audio = this.deps.audio as AudioPort & { setSoundscape?(z: Soundscape): void };
    if (audio.setSoundscape) audio.setSoundscape(zone);
    else this.deps.audio.playAmbience(zone.loop);
  }

  /** Fast travel to a POI of the current district. */
  fastTravel(poiId: string): boolean {
    const poi = this.district?.pois.find((x) => x.id === poiId && x.fastTravel);
    if (!poi) return false;
    const [x, , z] = poi.position;
    this.teleport(x + 3, z + 3, Math.atan2(-3, -3));
    this.deps.bus.emit('poi:fast-travel', { poi: poi.id });
    return true;
  }

  private checkTriggers(): void {
    if (!this.district) return;
    const p = this.player.transform.position;
    for (const t of this.district.triggers) {
      const inside = withinRadius(p, t.position, t.radius);
      const was = this.insideTriggers.has(t.id);
      if (inside && !was) {
        this.insideTriggers.add(t.id);
        this.deps.bus.emit('player:entered-trigger', { trigger: triggerId(t.id), kind: t.kind });
      } else if (!inside && was) {
        this.insideTriggers.delete(t.id);
        this.deps.bus.emit('player:exited-trigger', { trigger: triggerId(t.id) });
      }
    }
  }

  /** 2-second GPU benchmark on the loaded scene; returns the average fps. */
  async benchmark(durationMs: number): Promise<number> {
    for (let i = 0; i < 5; i++) {
      this.tick(1 / 60);
      await this.renderer.render();
      await new Promise((r) => requestAnimationFrame(r));
    }
    const start = performance.now();
    let frames = 0;
    while (performance.now() - start < durationMs) {
      this.tick(1 / 60);
      await this.renderer.render();
      frames++;
      await new Promise((r) => requestAnimationFrame(r));
    }
    return (frames * 1000) / (performance.now() - start);
  }

  currentDistrictId(): DistrictId {
    return this.district?.id ?? districtId(this.deps.config.startDistrict);
  }

  dispose(): void {
    this.stop();
    this.unloadDistrict();
    this.playerView?.dispose();
    this.renderer.dispose();
  }
}

function hashNpc(id: string): boolean {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h & 1) === 1;
}
