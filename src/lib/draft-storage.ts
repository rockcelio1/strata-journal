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

/**
 * Salva com controle otimista de versão: aborta a escrita se, no momento
 * do commit, o registro no IndexedDB tiver `savedAt` mais recente que o
 * `baseSavedAt` observado pelo chamador (ex.: outra aba escreveu antes).
 * Lança em falhas reais para permitir retry na UI.
 */
export async function saveDraftStrict(
  key: string,
  value: unknown,
  opts?: { baseSavedAt?: number | null },
): Promise<{ savedAt: number }> {
  const d = await db();
  const now = Date.now();
  const tx = d.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const existing = (await store.get(key)) as { value: unknown; savedAt: number } | undefined;
  if (existing && opts?.baseSavedAt != null && existing.savedAt > opts.baseSavedAt) {
    await tx.done;
    const err = new Error("draft-stale");
    (err as any).code = "STALE";
    (err as any).remoteSavedAt = existing.savedAt;
    throw err;
  }
  await store.put({ value, savedAt: now }, key);
  await tx.done;
  return { savedAt: now };
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
