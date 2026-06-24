import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "rdo-drafts";
const STORE = "drafts";

let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  if (!dbp) {
    dbp = openDB(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      },
    });
  }
  return dbp;
}

export async function saveDraft(key: string, value: unknown) {
  try {
    const d = await db();
    await d.put(STORE, { value, savedAt: Date.now() }, key);
  } catch {
    /* noop */
  }
}

export async function loadDraft<T = unknown>(key: string): Promise<{ value: T; savedAt: number } | null> {
  try {
    const d = await db();
    return (await d.get(STORE, key)) ?? null;
  } catch {
    return null;
  }
}

export async function clearDraft(key: string) {
  try {
    const d = await db();
    await d.delete(STORE, key);
  } catch {
    /* noop */
  }
}
