import type { EventBus } from '@common/event-bus';
import type { GameEvents } from '@application/events';
import type { ContentRepository, GameConfig } from '@application/ports';
import type { InputPort, LocalizerPort, AudioPort } from '@application/engine-ports';
import type { SessionStore, StartQuest, AdvanceQuest, AnswerQuestion, UnlockDistrict, SaveProgress, CitizenshipExam, UpdateSettings } from '@application/index';
import type { Quest, QuestState, DialogueLine } from '@domain/quest';
import { currentStep } from '@domain/quest';
import type { Npc, Trigger } from '@domain/district';
import type { Settings } from '@domain/progress';
import { districtId, npcId, questId, questionId, triggerId, type DistrictId, type LocalizedText } from '@domain/ids';
import { Hud, DialogueBox, QuestionPanel, Journal, ExamScreen, SettingsScreen, PauseMenu, LoadingScreen, DebugOverlay, TouchControls } from '@ui/index';
import type { Game } from './game';

export interface FlowDeps {
  readonly ui: HTMLElement;
  readonly bus: EventBus<GameEvents>;
  readonly t: LocalizerPort;
  readonly content: ContentRepository;
  readonly config: GameConfig;
  readonly store: SessionStore;
  readonly game: Game;
  readonly input: InputPort;
  readonly audio: AudioPort;
  readonly useCases: {
    startQuest: StartQuest;
    advance: AdvanceQuest;
    answer: AnswerQuestion;
    travel: UnlockDistrict;
    save: SaveProgress;
    exam: CitizenshipExam;
    settings: UpdateSettings;
  };
  onMainMenu(): void;
  applySettings(settings: Settings): void;
}

type Modal = 'none' | 'dialogue' | 'question' | 'journal' | 'pause' | 'settings' | 'exam' | 'loading';

/** Gameplay orchestration: wires world events to quest use cases and drives the HUD/dialogue/question UI. */
export class Flow {
  readonly hud: Hud;
  private readonly dialogue: DialogueBox;
  private readonly questionPanel: QuestionPanel;
  private readonly journal: Journal;
  private readonly examScreen: ExamScreen;
  private readonly settingsScreen: SettingsScreen;
  private readonly pauseMenu: PauseMenu;
  private readonly loading = new LoadingScreen();
  private readonly debug: DebugOverlay | null;
  private modal: Modal = 'none';
  private readonly unsubs: (() => void)[] = [];
  private questCache = new Map<string, Quest>();
  private lastPrompt: string | null = null;
  private autosaveTimer: number | null = null;
  private busy = false;
  private pendingDialogue: (() => Promise<void>) | null = null;

  constructor(private readonly d: FlowDeps, debugEnabled: boolean) {
    this.hud = new Hud(d.t);
    this.dialogue = new DialogueBox(d.t);
    this.questionPanel = new QuestionPanel(d.t);
    this.journal = new Journal(d.t);
    this.examScreen = new ExamScreen(d.t);
    this.settingsScreen = new SettingsScreen(d.t);
    this.pauseMenu = new PauseMenu(d.t);
    this.debug = debugEnabled ? new DebugOverlay() : null;
    d.ui.append(this.hud.root);
    if (this.debug) d.ui.append(this.debug.root);
    const touchDevice = 'ontouchstart' in window || window.matchMedia('(pointer: coarse)').matches;
    if (touchDevice && d.config.featureFlags.touchControls !== false) {
      const input = d.input as InputPort & { setTouchMove?(x: number, y: number): void; addTouchLook?(dx: number, dy: number): void; pressAction?(a: 'interact'): void };
      const touch = new TouchControls({
        onMove: (x, y) => input.setTouchMove?.(x, y),
        onLook: (dx, dy) => input.addTouchLook?.(dx, dy),
        onInteract: () => input.pressAction?.('interact'),
      });
      d.ui.append(touch.root);
    }
    this.subscribe();
  }

  private subscribe(): void {
    const { bus, t } = this.d;
    this.unsubs.push(
      bus.on('player:entered-trigger', ({ trigger, kind }) => void this.onTrigger(trigger, kind)),
      bus.on('quest:started', ({ quest }) => void this.refreshObjective(quest)),
      bus.on('quest:updated', ({ quest, state }) => void this.onQuestUpdated(quest, state)),
      bus.on('quest:completed', ({ quest }) => void this.onQuestCompleted(quest)),
      bus.on('quest:failed', () => this.hud.toast(t.t('quest.failed'), true)),
      bus.on('stamp:earned', ({ total }) => {
        this.hud.setStamps(total);
        this.hud.toast(t.t('quest.stampEarned', { total }));
        this.d.audio.playSfx('stamp');
      }),
      bus.on('district:unlocked', () => void this.autosave()),
      bus.on('question:answered', ({ correct }) => this.d.audio.playSfx(correct ? 'correct' : 'wrong')),
      bus.on('debug:frame', (s) => {
        this.debug?.update({ ...s, backend: this.d.game.backend, preset: this.d.game.presetLabel, position: this.d.game.player.transform.position });
      }),
    );
    this.d.game.onFrame = () => this.frame();
    this.autosaveTimer = window.setInterval(() => void this.autosave(), 60_000);
  }

  async enterWorld(): Promise<void> {
    const p = this.d.store.progress;
    this.hud.setStamps(p.stamps.length);
    await this.travelTo(p.currentDistrict);
    this.setModal('none');
    this.d.game.start();
    const active = p.activeQuests.find((q) => q.status === 'active');
    if (active) await this.refreshObjective(active.questId);
    else this.hud.setObjective(null, null);
  }

  private async travelTo(id: DistrictId): Promise<void> {
    const res = await this.d.content.getDistrict(id);
    if (!res.ok) {
      this.hud.toast(res.error.message, true);
      return;
    }
    this.setModal('loading');
    this.d.ui.append(this.loading.root);
    this.loading.set(this.d.t.t('loadingDistrict', { district: this.d.t.pick(res.value.name) }), 0);
    await this.d.game.loadDistrict(res.value, (f) => this.loading.set(this.d.t.t('loadingDistrict', { district: this.d.t.pick(res.value.name) }), f));
    this.loading.hide();
    this.setModal('none');
    await this.autosave();
  }

  private setModal(m: Modal): void {
    this.modal = m;
    const gameplay = m === 'none';
    this.d.game.gameplayEnabled = gameplay;
    this.d.game.paused = m === 'pause' || m === 'settings';
    this.d.input.setEnabled(gameplay);
    this.d.audio.duck(!gameplay);
    if (!gameplay) this.d.input.releasePointerLock();
    this.hud.root.hidden = m === 'exam' || m === 'loading';
  }

  private frame(): void {
    if (this.busy) return;
    const { input, game, t } = this.d;
    if (input.consume('pause')) {
      if (this.modal === 'none') this.openPause();
      else if (this.modal === 'pause' || this.modal === 'journal' || this.modal === 'settings') this.closeModal();
      return;
    }
    if (input.consume('journal')) {
      if (this.modal === 'none') void this.openJournal();
      else if (this.modal === 'journal') this.closeModal();
      return;
    }
    if (this.modal !== 'none') return;
    const near = game.nearby();
    const key = input.keyLabel('interact');
    let prompt: string | null = null;
    if (near?.kind === 'npc' && near.npc) prompt = `${t.pick(near.npc.name)}`;
    else if (near?.kind === 'trigger' && near.trigger?.toDistrict) {
      const target = near.trigger.toDistrict;
      prompt = this.d.useCases.travel.isUnlocked(target) ? t.t('hud.travel', { key, district: this.districtName(target) }) : t.t('hud.locked', { district: this.districtName(this.previousDistrict(target)) });
    }
    if (prompt !== this.lastPrompt) {
      this.lastPrompt = prompt;
      this.hud.setPrompt(prompt && near?.kind === 'npc' ? key : null, prompt ? (near?.kind === 'npc' ? t.t('hud.interact', { key }).replace(`${key}`, key) + ` · ${prompt}` : prompt) : null);
    }
    if (input.consume('interact') && near) void this.interact(near);
    this.hud.showClickToPlay(!input.pointerLocked && !('ontouchstart' in window) && !window.matchMedia('(pointer: coarse)').matches, () => input.requestPointerLock());
  }

  private districtName(id: DistrictId | string): string {
    const d = this.districtNames.get(id);
    return d ?? id;
  }
  private readonly districtNames = new Map<string, string>();
  async preloadDistrictNames(): Promise<void> {
    const list = await this.d.content.listDistricts();
    if (list.ok) for (const d of list.value) this.districtNames.set(d.id, this.d.t.pick(d.name));
  }
  private previousDistrict(target: DistrictId): DistrictId {
    const order = this.d.config.unlockRules.order;
    const i = order.indexOf(target);
    return (i > 0 ? order[i - 1] : order[0]) ?? target;
  }

  async interact(near: { kind: 'npc' | 'trigger'; npc?: Npc; trigger?: Trigger }): Promise<void> {
    if (this.busy) return;
    if (near.kind === 'trigger' && near.trigger?.toDistrict) {
      const res = this.d.useCases.travel.travel(near.trigger.toDistrict);
      if (res.ok) await this.travelTo(res.value);
      else this.hud.toast(this.d.t.t('hud.locked', { district: this.districtName(this.previousDistrict(near.trigger.toDistrict)) }), true);
      return;
    }
    if (near.kind === 'npc' && near.npc) await this.talkTo(near.npc);
  }

  private async getQuest(id: string): Promise<Quest | null> {
    const cached = this.questCache.get(id);
    if (cached) return cached;
    const res = await this.d.content.getQuest(questId(id));
    if (!res.ok) return null;
    this.questCache.set(id, res.value);
    return res.value;
  }

  private async talkTo(npc: Npc): Promise<void> {
    const p = this.d.store.progress;
    const names = this.speakerNames();
    this.d.game.attendNpc(npc.id, true);
    // 1. Active quest step involving this NPC
    for (const st of p.activeQuests) {
      const q = await this.getQuest(st.questId);
      if (!q) continue;
      const step = currentStep(q, st);
      if (st.status === 'active' && step?.kind === 'talk' && step.npc === npc.id) {
        await this.showDialogue(npc, step.dialogue, names);
        await this.d.useCases.advance.execute({ kind: 'talked', npc: npcId(npc.id), at: Date.now() });
        await this.afterAdvance(q.id);
        return;
      }
      if (st.status === 'active' && step?.kind === 'answer' && q.giverNpc === npc.id) {
        await this.runQuiz(q, st);
        return;
      }
      if (st.status === 'failed' && q.giverNpc === npc.id) {
        await this.offerQuest(npc, q, names);
        return;
      }
    }
    // 2. Offer a new quest
    for (const ref of npc.questRefs) {
      if (p.completedQuests.includes(questId(ref)) || p.activeQuests.some((a) => a.questId === ref && a.status === 'active')) continue;
      const q = await this.getQuest(ref);
      if (q) {
        await this.offerQuest(npc, q, names);
        return;
      }
    }
    // 3. Idle chatter
    await this.showDialogue(npc, [{ speaker: npc.id, text: npc.idleDialogue }], names);
    this.d.game.attendNpc(npc.id, false);
  }

  private speakerNames(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const n of this.d.game.district?.npcs ?? []) out[n.id] = this.d.t.pick(n.name);
    return out;
  }

  private async offerQuest(npc: Npc, quest: Quest, names: Record<string, string>): Promise<void> {
    const accepted = await new Promise<boolean>((resolve) => {
      this.setModal('dialogue');
      this.d.ui.append(this.dialogue.open({
        speakerNames: names,
        lines: [{ speaker: npc.id, text: npc.idleDialogue }, { speaker: 'narrator', text: quest.summary }],
        acceptLabel: this.d.t.t('dialogue.startQuest'),
        onAccept: () => resolve(true),
        onClose: () => resolve(false),
      }));
    });
    this.dialogue.close();
    this.setModal('none');
    if (!accepted) {
      this.d.game.attendNpc(npc.id, false);
      return;
    }
    const started = await this.d.useCases.startQuest.execute(quest.id);
    if (!started.ok) {
      this.hud.toast(started.error.message, true);
      return;
    }
    this.hud.toast(this.d.t.t('quest.started', { title: this.d.t.pick(quest.title) }));
    const first = quest.steps[0];
    if (first?.kind === 'talk' && first.npc === npc.id) {
      await this.showDialogue(npc, first.dialogue, names);
      await this.d.useCases.advance.execute({ kind: 'talked', npc: npcId(npc.id), at: Date.now() });
      await this.afterAdvance(quest.id);
    } else {
      this.d.game.attendNpc(npc.id, false);
    }
    await this.autosave();
  }

  private showDialogue(npc: Npc, lines: readonly DialogueLine[], names: Record<string, string>): Promise<void> {
    this.d.bus.emit('dialogue:open', { npc: npcId(npc.id), lines });
    return new Promise((resolve) => {
      this.setModal('dialogue');
      this.d.ui.append(this.dialogue.open({ speakerNames: names, lines, onClose: () => {
        this.dialogue.close();
        this.setModal('none');
        this.d.bus.emit('dialogue:closed', { npc: npcId(npc.id) });
        resolve();
      } }));
    });
  }

  /** After a step advanced: if the next step is a quiz, start it right away (the NPC "meets you there"). */
  private async afterAdvance(id: string): Promise<void> {
    const st = this.d.store.progress.activeQuests.find((q) => q.questId === id);
    const q = await this.getQuest(id);
    if (!q || !st || st.status !== 'active') {
      if (q) this.d.game.attendNpc(q.giverNpc, false);
      return;
    }
    const step = currentStep(q, st);
    if (step?.kind === 'answer') await this.runQuiz(q, st);
    else this.d.game.attendNpc(q.giverNpc, false);
  }

  private async runQuiz(quest: Quest, state: QuestState): Promise<void> {
    const step = currentStep(quest, state);
    if (!step || step.kind !== 'answer') return;
    this.busy = true;
    const answeredKey = `${step.id}:answered`;
    const already = state.answers[answeredKey] ?? 0;
    const remaining = step.questions.slice(already);
    let idx = already;
    for (const qid of remaining) {
      const presented = await this.d.useCases.answer.present(quest.id, qid);
      if (!presented.ok) {
        this.hud.toast(presented.error.message, true);
        break;
      }
      idx++;
      await new Promise<void>((resolve) => {
        this.setModal('question');
        this.d.ui.append(this.questionPanel.show({
          index: idx,
          total: step.questions.length,
          presented: presented.value,
          onAnswer: async (key) => {
            const r = await this.d.useCases.answer.answer(questionId(qid), key);
            return r.ok ? r.value : { correct: false, correctKey: '' };
          },
          onContinue: () => {
            this.questionPanel.close();
            resolve();
          },
        }));
      });
      const st = this.d.store.progress.activeQuests.find((q) => q.questId === quest.id);
      if (!st || st.status !== 'active') break;
    }
    this.setModal('none');
    this.busy = false;
    const pending = this.pendingDialogue;
    this.pendingDialogue = null;
    if (pending) await pending();
    this.d.game.attendNpc(quest.giverNpc, false);
    await this.autosave();
  }

  private async onTrigger(trigger: string, kind: 'zone' | 'pickup' | 'portal'): Promise<void> {
    if (kind === 'portal') return;
    const at = Date.now();
    const changed = await this.d.useCases.advance.execute(kind === 'pickup' ? { kind: 'collected', trigger: triggerId(trigger), at } : { kind: 'reached', trigger: triggerId(trigger), at });
    if (changed.ok && changed.value.length > 0) {
      if (kind === 'pickup') {
        this.d.game.hideTrigger(triggerId(trigger));
        this.d.audio.playSfx('click');
      }
      for (const st of changed.value) if (st.status === 'active') await this.afterAdvance(st.questId);
    }
  }

  private async onQuestUpdated(id: string, state: QuestState): Promise<void> {
    if (state.status === 'active') await this.refreshObjective(id);
  }

  private async refreshObjective(id: string): Promise<void> {
    const q = await this.getQuest(id);
    const st = this.d.store.progress.activeQuests.find((s) => s.questId === id);
    if (!q || !st) return;
    const step = currentStep(q, st);
    this.hud.setObjective(this.d.t.pick(q.title), step ? this.d.t.pick(step.objective) : null);
  }

  private async onQuestCompleted(id: string): Promise<void> {
    const q = await this.getQuest(id);
    if (!q) return;
    this.hud.toast(this.d.t.t('quest.completed', { title: this.d.t.pick(q.title) }));
    const next = this.d.store.progress.activeQuests.find((s) => s.status === 'active');
    if (next) await this.refreshObjective(next.questId);
    else this.hud.setObjective(null, null);
    if (q.completionDialogue?.length) {
      const npc = this.d.game.district?.npcs.find((n) => n.id === q.giverNpc);
      if (npc) {
        const show = () => this.showDialogue(npc, q.completionDialogue ?? [], this.speakerNames());
        // If a question panel is open, the quiz loop shows this once the panel closes.
        if (this.modal === 'question' || this.busy) this.pendingDialogue = show;
        else await show();
      }
    }
    await this.autosave();
  }

  private async autosave(): Promise<void> {
    if (!this.d.store.hasProgress) return;
    await this.d.useCases.save.execute();
  }

  private openPause(): void {
    this.setModal('pause');
    this.d.ui.append(this.pauseMenu.show({
      onResume: () => this.closeModal(),
      onSave: async () => (await this.d.useCases.save.execute()).ok,
      onSettings: () => {
        this.pauseMenu.close();
        this.openSettings(() => this.openPause());
      },
      onMainMenu: () => {
        this.closeModal();
        void this.autosave().then(() => this.d.onMainMenu());
      },
    }));
  }

  openSettings(onBack: () => void): void {
    this.setModal('settings');
    this.d.ui.append(this.settingsScreen.show(this.d.store.progress.settings, {
      onChange: (patch) => {
        const s = this.d.useCases.settings.execute(patch);
        this.d.applySettings(s);
        void this.autosave();
      },
      onClose: () => {
        this.settingsScreen.close();
        this.setModal('none');
        onBack();
      },
    }));
  }

  private async openJournal(): Promise<void> {
    const p = this.d.store.progress;
    const quests: { id: string; title: LocalizedText; objective: LocalizedText | null; status: 'active' | 'completed' | 'failed' }[] = [];
    for (const st of p.activeQuests) {
      const q = await this.getQuest(st.questId);
      if (q) quests.push({ id: q.id, title: q.title, objective: currentStep(q, st)?.objective ?? null, status: st.status });
    }
    for (const id of p.completedQuests) {
      const q = await this.getQuest(id);
      if (q) quests.push({ id: q.id, title: q.title, objective: null, status: 'completed' });
    }
    const list = await this.d.content.listDistricts();
    const districts = (list.ok ? list.value : []).filter((d) => d.id !== 'hub').map((d) => ({ id: d.id, name: d.name, unlocked: p.unlockedDistricts.includes(d.id), stamps: p.stamps.filter((s) => s.district === d.id).length }));
    this.setModal('journal');
    const pois = (this.d.game.district?.pois ?? []).filter((x) => x.fastTravel).map((x) => ({ id: x.id, name: x.name }));
    this.d.ui.append(this.journal.show({ progress: p, quests, districts, examUnlocked: this.d.useCases.exam.isUnlocked(), stampsForExam: this.d.config.unlockRules.stampsForExam, pois }, {
      onClose: () => this.closeModal(),
      onFastTravel: (id) => {
        this.closeModal();
        this.d.game.fastTravel(id);
      },
      onExam: (practice) => {
        this.journal.close();
        this.openExam(practice);
      },
    }));
  }

  openExam(practice: boolean): void {
    this.setModal('exam');
    const { exam } = this.d.useCases;
    this.d.ui.append(this.examScreen.showIntro({
      passMark: this.d.config.exam.passMark,
      onBegin: async () => {
        const r = await exam.start({ force: practice });
        if (!r.ok) {
          this.hud.toast(r.error.message, true);
          return null;
        }
        return r.value;
      },
      onAnswer: (qid, key) => {
        const r = exam.answer(qid, key);
        return r.ok ? r.value : this.d.store.exam!;
      },
      onFinish: () => {
        const r = exam.finish();
        void this.autosave();
        return r.ok ? r.value : null;
      },
      remaining: () => exam.remaining(),
      onExit: () => {
        this.examScreen.close();
        this.setModal('none');
      },
    }));
  }

  private closeModal(): void {
    this.pauseMenu.close();
    this.journal.close();
    this.settingsScreen.close();
    this.setModal('none');
  }

  /** Test/debug hooks (exposed on window.__truenorth when enabled). */
  hooks() {
    return {
      teleport: (x: number, z: number) => this.d.game.teleport(x, z),
      interact: () => {
        const n = this.d.game.nearby();
        if (n) void this.interact(n);
        return n?.id ?? null;
      },
      nearby: () => this.d.game.nearby()?.id ?? null,
      state: () => this.d.store.progress,
      travel: (id: string) => {
        const r = this.d.useCases.travel.travel(districtId(id));
        if (r.ok) void this.travelTo(r.value);
        return r.ok;
      },
      openJournal: () => void this.openJournal(),
      fastTravel: (id: string) => this.d.game.fastTravel(id),
      /** Free camera for report screenshots: eye xyz, look-at xyz. */
      camera: (ex: number, ey: number, ez: number, tx: number, ty: number, tz: number) => this.d.game.freeCamera([ex, ey, ez], [tx, ty, tz]),
      openExam: (practice: boolean) => this.openExam(practice),
    };
  }

  refreshLocale(): void {
    this.hud.refreshText();
  }

  dispose(): void {
    for (const u of this.unsubs) u();
    if (this.autosaveTimer) window.clearInterval(this.autosaveTimer);
    this.d.game.onFrame = null;
    this.hud.root.remove();
    this.debug?.root.remove();
    this.closeModal();
    this.dialogue.close();
    this.questionPanel.close();
    this.examScreen.close();
  }
}
