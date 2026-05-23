export interface WordStats {
  seen: number;
  correct: number;
  wrong: number;
  everWrong: boolean;
  lastSeen: string;
}

export type StorageData = Record<string, WordStats>;

const STORAGE_KEY = 'vocab_quiz_stats';

export function getStorageData(): StorageData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Failed to read localStorage:', e);
    return {};
  }
}

export function saveStorageData(data: StorageData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to write to localStorage:', e);
  }
}

export function updateWordStats(wordId: string, isCorrect: boolean): void {
  const data = getStorageData();
  const current = data[wordId] || {
    seen: 0,
    correct: 0,
    wrong: 0,
    everWrong: false,
    lastSeen: ''
  };

  current.seen += 1;
  if (isCorrect) {
    current.correct += 1;
  } else {
    current.wrong += 1;
    current.everWrong = true;
  }
  current.lastSeen = new Date().toISOString();

  data[wordId] = current;
  saveStorageData(data);
}

export function getEverWrongWordIds(): string[] {
  const data = getStorageData();
  return Object.keys(data).filter((id) => data[id].everWrong === true);
}

export function clearStorageData(): void {
  localStorage.removeItem(STORAGE_KEY);
}
