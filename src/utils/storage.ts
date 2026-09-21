import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProgressData } from '../game/types';

const KEY = '@arrow_escape_progress';

export const DEFAULT_PROGRESS: ProgressData = {
  highestLevel: 1,
  completedLevels: [],
  bestScores: {},
  settings: {
    sound: true,
    haptics: true,
  },
};

export async function loadProgress(): Promise<ProgressData> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PROGRESS, settings: { ...DEFAULT_PROGRESS.settings } };
    const parsed = JSON.parse(raw) as ProgressData;
    return {
      ...DEFAULT_PROGRESS,
      ...parsed,
      settings: { ...DEFAULT_PROGRESS.settings, ...parsed.settings },
      completedLevels: parsed.completedLevels ?? [],
      bestScores: parsed.bestScores ?? {},
    };
  } catch {
    return { ...DEFAULT_PROGRESS, settings: { ...DEFAULT_PROGRESS.settings } };
  }
}

export async function saveProgress(data: ProgressData): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

export async function resetProgress(): Promise<ProgressData> {
  const fresh = {
    ...DEFAULT_PROGRESS,
    settings: { ...DEFAULT_PROGRESS.settings },
  };
  await saveProgress(fresh);
  return fresh;
}
