import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RamadanDayTime {
  day: number;         // 1–30
  date: string;        // e.g. "18 Feb 2026"
  sehri: string;       // "HH:MM" 24h format
  iftar: string;       // "HH:MM" 24h format
}

export interface SavedSettings {
  divisionName: string;
  districtName: string;
  districtBn: string;
  lat: number;
  lng: number;
  timetable: RamadanDayTime[];
}

const SETTINGS_KEY = 'ramadan_settings_v1';
const FASTING_STREAK_KEY = 'fasting_streak_v1';
const APP_TIMEZONE = 'Asia/Dhaka';

export async function saveSettings(settings: SavedSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function loadSettings(): Promise<SavedSettings | null> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedSettings;
  } catch {
    return null;
  }
}

export async function clearSettings(): Promise<void> {
  await AsyncStorage.removeItem(SETTINGS_KEY);
}

export interface FastingStreak {
  count: number;
  lastCompletedDate: string | null; // "YYYY-MM-DD"
}

function getTodayKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) {
    // Safe fallback
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return `${year}-${month}-${day}`;
}

function getYesterdayKey(date: Date = new Date()): string {
  const prev = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  return getTodayKey(prev);
}

export async function loadFastingStreak(): Promise<FastingStreak> {
  const raw = await AsyncStorage.getItem(FASTING_STREAK_KEY);
  if (!raw) return { count: 0, lastCompletedDate: null };
  try {
    return JSON.parse(raw) as FastingStreak;
  } catch {
    return { count: 0, lastCompletedDate: null };
  }
}

export async function markFastingComplete(
  date: Date = new Date()
): Promise<FastingStreak & { alreadyMarked: boolean }> {
  const current = await loadFastingStreak();
  const today = getTodayKey(date);
  if (current.lastCompletedDate === today) {
    return { ...current, alreadyMarked: true };
  }

  const yesterday = getYesterdayKey(date);
  const nextCount = current.lastCompletedDate === yesterday ? current.count + 1 : 1;
  const updated: FastingStreak = { count: nextCount, lastCompletedDate: today };
  await AsyncStorage.setItem(FASTING_STREAK_KEY, JSON.stringify(updated));
  return { ...updated, alreadyMarked: false };
}
