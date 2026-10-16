import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProgressData, SuiteProgress } from '../game/types';

const KEY = '@arrow_escape_progress';

export const DEFAULT_PROGRESS: ProgressData = {
  suites: {},
  lastSuiteId: 1,
  settings: {
    sound: true,
    haptics: true,
    developerMode: false,
  },
};

function freshProgress(): ProgressData {
  return { ...DEFAULT_PROGRESS, suites: {}, settings: { ...DEFAULT_PROGRESS.settings } };
}

export function getSuiteProgress(progress: ProgressData, suiteId: number): SuiteProgress {
  return (
    progress.suites[String(suiteId)] ?? { highestLevel: 1, completedLevels: [], bestScores: {} }
  );
}

export async function loadProgress(): Promise<ProgressData> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return freshProgress();
    const parsed = JSON.parse(raw) as Partial<ProgressData>;
    return {
      ...freshProgress(),
      // Saves from before suites existed have no `suites` and refer to levels that no longer exist.
      suites: parsed.suites ?? {},
      lastSuiteId: parsed.lastSuiteId ?? DEFAULT_PROGRESS.lastSuiteId,
      settings: { ...DEFAULT_PROGRESS.settings, ...parsed.settings },
    };
  } catch {
    return freshProgress();
  }
}

export async function saveProgress(data: ProgressData): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

export async function resetProgress(): Promise<ProgressData> {
  const fresh = freshProgress();
  await saveProgress(fresh);
  return fresh;
}
