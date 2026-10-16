import { create } from 'zustand';
import { GameEngine } from '../game/engine';
import type { GameSnapshot, Level, ProgressData, TapResult } from '../game/types';
import { getLevel, getNextLevelId, getSuite } from '../levels';
import { config } from '../config';
import {
  DEFAULT_PROGRESS,
  getSuiteProgress,
  loadProgress,
  resetProgress as resetStoredProgress,
  saveProgress,
} from '../utils/storage';
import {
  hapticBlocked,
  hapticLose,
  hapticSuccess,
  hapticWin,
} from '../utils/haptics';

type Screen = 'home' | 'suites' | 'levels' | 'game' | 'settings' | 'generator';

interface GameStore {
  screen: Screen;
  progress: ProgressData;
  /** Suite shown on the level select screen. */
  selectedSuiteId: number;
  /** Level currently loaded in the engine. */
  level: Level | null;
  /** True when playing a generator level: progress is not saved and exits return to the generator. */
  playtest: boolean;
  snapshot: GameSnapshot | null;
  lastResult: TapResult | null;
  elapsedSeconds: number;
  shakingArrowId: string | null;
  escapingArrowId: string | null;
  /** True while Auto is showing the hint before moving it. */
  autoPending: boolean;
  engine: GameEngine;

  init: () => Promise<void>;
  setScreen: (screen: Screen) => void;
  openSuite: (suiteId: number) => void;
  /** Resume the last played suite at its furthest unlocked level. */
  continueGame: () => void;
  startLevel: (suiteId: number, levelId: number) => void;
  startPlaytest: (level: Level) => void;
  exitGame: () => void;
  tapArrow: (arrowId: string) => TapResult | null;
  useHint: () => string | null;
  /** Developer mode: show a hint, then move that arrow. */
  autoMove: () => void;
  restartLevel: () => void;
  pause: () => void;
  resume: () => void;
  clearTransient: () => void;
  tick: () => void;
  completeAndAdvance: () => void;
  markLevelComplete: (suiteId: number, levelId: number, moves: number) => Promise<void>;
  toggleSetting: (key: keyof ProgressData['settings']) => Promise<void>;
  resetProgress: () => Promise<void>;
  isLevelUnlocked: (suiteId: number, levelId: number) => boolean;
}

const engine = new GameEngine();

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'home',
  progress: DEFAULT_PROGRESS,
  selectedSuiteId: DEFAULT_PROGRESS.lastSuiteId,
  level: null,
  playtest: false,
  snapshot: null,
  lastResult: null,
  elapsedSeconds: 0,
  shakingArrowId: null,
  escapingArrowId: null,
  autoPending: false,
  engine,

  init: async () => {
    const progress = await loadProgress();
    set({ progress, selectedSuiteId: progress.lastSuiteId });
  },

  setScreen: (screen) => set({ screen }),

  openSuite: (suiteId) => set({ selectedSuiteId: suiteId, screen: 'levels' }),

  continueGame: () => {
    const { progress } = get();
    const suite = getSuite(progress.lastSuiteId) ?? getSuite(1);
    if (!suite || suite.levels.length === 0) {
      set({ screen: 'suites' });
      return;
    }
    const highest = getSuiteProgress(progress, suite.id).highestLevel;
    get().startLevel(suite.id, Math.min(highest, suite.levels.length));
  },

  startLevel: (suiteId, levelId) => {
    const level = getLevel(suiteId, levelId);
    if (!level) return;
    const snapshot = engine.loadLevel(level);
    const { progress } = get();
    if (progress.lastSuiteId !== suiteId) {
      const next = { ...progress, lastSuiteId: suiteId };
      void saveProgress(next);
      set({ progress: next });
    }
    set({
      screen: 'game',
      selectedSuiteId: suiteId,
      level,
      playtest: false,
      snapshot,
      lastResult: null,
      elapsedSeconds: 0,
      shakingArrowId: null,
      escapingArrowId: null,
    });
  },

  startPlaytest: (level) => {
    const snapshot = engine.loadLevel(level);
    set({
      screen: 'game',
      level,
      playtest: true,
      snapshot,
      lastResult: null,
      elapsedSeconds: 0,
      shakingArrowId: null,
      escapingArrowId: null,
    });
  },

  exitGame: () => {
    set({ screen: get().playtest ? 'generator' : 'levels' });
  },

  tapArrow: (arrowId) => {
    const { progress, snapshot } = get();
    if (!snapshot || snapshot.status !== 'playing') return null;

    const result = engine.tapArrow(arrowId);
    const next = engine.getSnapshot();

    if (result.success) {
      void hapticSuccess(progress.settings.haptics);
      set({
        snapshot: next,
        lastResult: result,
        escapingArrowId: arrowId,
        shakingArrowId: null,
      });

      if (result.levelComplete) {
        void hapticWin(progress.settings.haptics);
        const { playtest, level } = get();
        if (!playtest && level) {
          void get().markLevelComplete(level.suiteId, level.id, next.moves);
        }
      }
    } else if (result.blocked) {
      void hapticBlocked(progress.settings.haptics);
      set({
        snapshot: next,
        lastResult: result,
        shakingArrowId: arrowId,
        escapingArrowId: null,
      });
      if (result.gameOver) {
        void hapticLose(progress.settings.haptics);
      }
    }

    return result;
  },

  useHint: () => {
    const id = engine.getHint(get().progress.settings.developerMode);
    set({ snapshot: engine.getSnapshot() });
    return id;
  },

  autoMove: () => {
    const { autoPending, escapingArrowId, snapshot } = get();
    if (autoPending || escapingArrowId || snapshot?.status !== 'playing') return;
    const id = get().useHint();
    if (!id) return;
    set({ autoPending: true });
    setTimeout(() => {
      set({ autoPending: false });
      // A restart or level change in the meantime clears the hint.
      if (get().snapshot?.hintArrowId === id) get().tapArrow(id);
    }, config.animation.autoMoveDelayMs);
  },

  restartLevel: () => {
    const snapshot = engine.reset();
    set({
      snapshot,
      lastResult: null,
      elapsedSeconds: 0,
      shakingArrowId: null,
      escapingArrowId: null,
    });
  },

  pause: () => {
    engine.pause();
    set({ snapshot: engine.getSnapshot() });
  },

  resume: () => {
    engine.resume();
    set({ snapshot: engine.getSnapshot() });
  },

  clearTransient: () => {
    set({ shakingArrowId: null, escapingArrowId: null });
  },

  tick: () => {
    const { snapshot } = get();
    if (!snapshot || snapshot.status !== 'playing') return;
    set({ elapsedSeconds: engine.getElapsedSeconds() });
  },

  completeAndAdvance: () => {
    const { level, playtest } = get();
    if (!level) return;
    if (playtest) {
      set({ screen: 'generator' });
      return;
    }
    const nextId = getNextLevelId(level.suiteId, level.id);
    if (nextId) {
      get().startLevel(level.suiteId, nextId);
    } else {
      set({ screen: 'levels' });
    }
  },

  markLevelComplete: async (suiteId, levelId, moves) => {
    const { progress } = get();
    const suite = getSuiteProgress(progress, suiteId);
    const completedLevels = suite.completedLevels.includes(levelId)
      ? suite.completedLevels
      : [...suite.completedLevels, levelId];

    const prevBest = suite.bestScores[String(levelId)];
    const bestScores = {
      ...suite.bestScores,
      [String(levelId)]:
        prevBest === undefined ? moves : Math.min(prevBest, moves),
    };

    const highestLevel = Math.max(
      suite.highestLevel,
      Math.min(levelId + 1, getSuite(suiteId)?.levels.length ?? levelId),
    );

    const next: ProgressData = {
      ...progress,
      suites: {
        ...progress.suites,
        [String(suiteId)]: { completedLevels, bestScores, highestLevel },
      },
    };

    await saveProgress(next);
    set({ progress: next });
  },

  toggleSetting: async (key) => {
    const { progress } = get();
    const next: ProgressData = {
      ...progress,
      settings: {
        ...progress.settings,
        [key]: !progress.settings[key],
      },
    };
    await saveProgress(next);
    set({ progress: next });
  },

  resetProgress: async () => {
    const progress = await resetStoredProgress();
    set({ progress, screen: 'home', snapshot: null });
  },

  isLevelUnlocked: (suiteId, levelId) => {
    if (config.unlockAllLevels) return true;
    return levelId <= getSuiteProgress(get().progress, suiteId).highestLevel;
  },
}));
