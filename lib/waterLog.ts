import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'savor.dailyWater';
export const ML_PER_FL_OZ = 250 / 8;

const listeners = new Set<(ml: number) => void>();

function todayStamp() {
  const date = new Date();
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

type StoredWater = {
  date: string;
  ml: number;
};

async function readStore(): Promise<StoredWater | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.date !== 'string' || typeof record.ml !== 'number') return null;
    return { date: record.date, ml: record.ml };
  } catch {
    return null;
  }
}

export function mlToFlOz(ml: number) {
  return Math.round(ml / ML_PER_FL_OZ);
}

export async function getTodayWaterMl(): Promise<number> {
  const stored = await readStore();
  if (!stored || stored.date !== todayStamp()) return 0;
  return Math.max(0, Math.round(stored.ml));
}

export async function addTodayWaterMl(deltaMl: number): Promise<{ from: number; to: number }> {
  const from = await getTodayWaterMl();
  const to = from + Math.max(0, Math.round(deltaMl));
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ date: todayStamp(), ml: to } satisfies StoredWater),
  );
  listeners.forEach((listener) => listener(to));
  return { from, to };
}

export function subscribeTodayWater(listener: (ml: number) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
