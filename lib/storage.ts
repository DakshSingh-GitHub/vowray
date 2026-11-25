import { ChatSession, ThemeMode } from "./types";

const DB_NAME = "vowray_db";
const DB_VERSION = 1;
const SESSIONS_STORE = "sessions";
const META_STORE = "meta";

const LEGACY_SESSIONS_KEY = "vowray_sessions_v1";
const LEGACY_ACTIVE_SESSION_KEY = "vowray_active_session_v1";

function isIndexedDBAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open IndexedDB."));
  });
}

async function getMeta<T>(key: string): Promise<T | null> {
  if (!isIndexedDBAvailable()) return null;
  try {
    const db = await openDatabase();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(META_STORE, "readonly");
      const store = tx.objectStore(META_STORE);
      const req = store.get(key);
      req.onsuccess = () => {
        const record = req.result as { key: string; value: T } | undefined;
        resolve(record ? record.value : null);
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

async function setMeta<T>(key: string, value: T | null): Promise<void> {
  if (!isIndexedDBAvailable()) return;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(META_STORE, "readwrite");
      const store = tx.objectStore(META_STORE);
      if (value === null) {
        store.delete(key);
      } else {
        store.put({ key, value });
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // Ignore storage errors gracefully
  }
}

export async function loadSessions(): Promise<ChatSession[]> {
  if (!isIndexedDBAvailable()) return [];
  try {
    const db = await openDatabase();
    const sessions = await new Promise<ChatSession[]>((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, "readonly");
      const store = tx.objectStore(SESSIONS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const result = Array.isArray(req.result)
          ? (req.result as ChatSession[])
          : [];
        resolve(result);
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });

    // One-time cleanup/migration if legacy localStorage sessions exist
    if (
      typeof window !== "undefined" &&
      typeof window.localStorage !== "undefined"
    ) {
      const legacyRaw = window.localStorage.getItem(LEGACY_SESSIONS_KEY);
      if (legacyRaw) {
        try {
          const parsed = JSON.parse(legacyRaw);
          if (Array.isArray(parsed) && parsed.length > 0 && sessions.length === 0) {
            for (const item of parsed as ChatSession[]) {
              await putSession(item);
              sessions.push(item);
            }
          }
        } catch {
          // Ignore malformed legacy data
        }
        window.localStorage.removeItem(LEGACY_SESSIONS_KEY);
        window.localStorage.removeItem(LEGACY_ACTIVE_SESSION_KEY);
      }
    }

    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function putSession(session: ChatSession): Promise<void> {
  if (!isIndexedDBAvailable()) return;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, "readwrite");
      const store = tx.objectStore(SESSIONS_STORE);
      store.put(session);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export async function deleteSessionFromDb(id: string): Promise<void> {
  if (!isIndexedDBAvailable()) return;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, "readwrite");
      const store = tx.objectStore(SESSIONS_STORE);
      store.delete(id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // Ignore
  }
}

export async function loadActiveSessionId(): Promise<string | null> {
  return getMeta<string>("activeSessionId");
}

export async function saveActiveSessionId(id: string | null): Promise<void> {
  await setMeta("activeSessionId", id);
}

export async function loadTheme(): Promise<ThemeMode> {
  const saved = await getMeta<ThemeMode>("theme");
  if (saved === "dark" || saved === "light") return saved;
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export async function saveTheme(theme: ThemeMode): Promise<void> {
  await setMeta("theme", theme);
}

export function generateSessionTitle(firstPrompt: string): string {
  const cleaned = firstPrompt.replace(/\s+/g, " ").trim();
  if (!cleaned) return "New conversation";
  const maxLen = 44;
  if (cleaned.length <= maxLen) return cleaned;
  const sliced = cleaned.slice(0, maxLen);
  const lastSpace = sliced.lastIndexOf(" ");
  return (lastSpace > 18 ? sliced.slice(0, lastSpace) : sliced) + "…";
}

export interface GroupedSessions {
  label: "Today" | "Previous 7 Days" | "Older";
  items: ChatSession[];
}

export function groupSessionsChronologically(
  sessions: ChatSession[]
): GroupedSessions[] {
  if (sessions.length === 0) return [];

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const sevenDaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const today: ChatSession[] = [];
  const previous7Days: ChatSession[] = [];
  const older: ChatSession[] = [];

  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  for (const session of sorted) {
    if (session.updatedAt >= startOfToday) {
      today.push(session);
    } else if (session.updatedAt >= sevenDaysAgo) {
      previous7Days.push(session);
    } else {
      older.push(session);
    }
  }

  const groups: GroupedSessions[] = [];
  if (today.length > 0) groups.push({ label: "Today", items: today });
  if (previous7Days.length > 0)
    groups.push({ label: "Previous 7 Days", items: previous7Days });
  if (older.length > 0) groups.push({ label: "Older", items: older });

  return groups;
}
