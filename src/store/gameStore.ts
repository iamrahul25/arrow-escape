import { create } from 'zustand';
import { GameEngine } from '../game/engine';
import type { GameSnapshot, ProgressData, TapResult } from '../game/types';
import { getLevel, getNextLevelId, LEVELS } from '../levels';
import {
  DEFAULT_PROGRESS,
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

type Screen = 'home' | 'levels' | 'game' | 'settings';

interface GameStore {
  screen: Screen;
  progress: ProgressData;
  snapshot: GameSnapshot | null;
  lastResult: TapResult | null;
  elapsedSeconds: number;
  shakingArrowId: string | null;
  escapingArrowId: string | null;
  engine: GameEngine;

  init: () => Promise<void>;
  setScreen: (screen: Screen) => void;
  startLevel: (levelId: number) => void;
  tapArrow: (arrowId: string) => TapResult | null;
  useHint: () => string | null;
  restartLevel: () => void;
  pause: () => void;
  resume: () => void;
  clearTransient: () => void;
  tick: () => void;
  completeAndAdvance: () => void;
  markLevelComplete: (levelId: number, moves: number) => Promise<void>;
  toggleSetting: (key: 'sound' | 'haptics') => Promise<void>;
  resetProgress: () => Promise<void>;
  isLevelUnlocked: (levelId: number) => boolean;
}

const engine = new GameEngine();

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'home',
  progress: DEFAULT_PROGRESS,
  snapshot: null,
  lastResult: null,
  elapsedSeconds: 0,
  shakingArrowId: null,
  escapingArrowId: null,
  engine,

  init: async () => {
    const progress = await loadProgress();
    set({ progress });
  },

  setScreen: (screen) => set({ screen }),

  startLevel: (levelId) => {
    const level = getLevel(levelId);
    if (!level) return;
    const snapshot = engine.loadLevel(level);
    set({
      screen: 'game',
      snapshot,
      lastResult: null,
      elapsedSeconds: 0,
      shakingArrowId: null,
      escapingArrowId: null,
    });
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
        void get().markLevelComplete(next.levelId, next.moves);
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
    const id = engine.getHint();
    set({ snapshot: engine.getSnapshot() });
    return id;
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
    const { snapshot } = get();
    if (!snapshot) return;
    const nextId = getNextLevelId(snapshot.levelId);
    if (nextId) {
      get().startLevel(nextId);
    } else {
      set({ screen: 'levels' });
    }
  },

  markLevelComplete: async (levelId, moves) => {
    const { progress } = get();
    const completedLevels = progress.completedLevels.includes(levelId)
      ? progress.completedLevels
      : [...progress.completedLevels, levelId];

    const prevBest = progress.bestScores[String(levelId)];
    const bestScores = {
      ...progress.bestScores,
      [String(levelId)]:
        prevBest === undefined ? moves : Math.min(prevBest, moves),
    };

    const highestLevel = Math.max(
      progress.highestLevel,
      Math.min(levelId + 1, LEVELS.length),
    );

    const next: ProgressData = {
      ...progress,
      completedLevels,
      bestScores,
      highestLevel,
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

  isLevelUnlocked: (levelId) => {
    const { progress } = get();
    return levelId <= progress.highestLevel;
  },
}));
