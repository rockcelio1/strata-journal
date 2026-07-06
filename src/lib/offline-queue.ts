// Offline queue (IndexedDB) for RDOs criados sem conexão.
import { openDB, type IDBPDatabase } from "idb";

export type SyncStatus = "pendente" | "enviando" | "sincronizado" | "erro";

export interface QueuedRdo {
  local_id: string;
  payload: any;
  status: SyncStatus;
  created_at: number;
  remote_id?: string;
  error?: string;
}

const DB_NAME = "diario-de-obra";
const STORE = "rdo_queue";
let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (typeof window === "undefined") throw new Error("IndexedDB only no cliente");
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "local_id" });
        }
      },
    });
  }
  return dbPromise;
}

export function newLocalId() {
  return (crypto as any).randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function enqueueRdo(payload: any): Promise<QueuedRdo> {
  const item: QueuedRdo = {
    local_id: newLocalId(),
    payload,
    status: navigator.onLine ? "enviando" : "pendente",
    created_at: Date.now(),
  };
  const db = await getDb();
  await db.put(STORE, item);
  return item;
}

export async function markQueued(local_id: string, patch: Partial<QueuedRdo>) {
  const db = await getDb();
  const cur = (await db.get(STORE, local_id)) as QueuedRdo | undefined;
  if (!cur) return;
  await db.put(STORE, { ...cur, ...patch });
}

export async function updateQueuedPayload(
  local_id: string,
  updater: (payload: any) => any,
) {
  const db = await getDb();
  const cur = (await db.get(STORE, local_id)) as QueuedRdo | undefined;
  if (!cur) return;
  await db.put(STORE, {
    ...cur,
    payload: updater(cur.payload),
    status: "pendente",
    error: undefined,
  });
}

export async function listQueued(): Promise<QueuedRdo[]> {
  const db = await getDb();
  return (await db.getAll(STORE)) as QueuedRdo[];
}

export async function removeQueued(local_id: string) {
  const db = await getDb();
  await db.delete(STORE, local_id);
}

export interface FlushProgress { index: number; total: number; current: QueuedRdo; }

/** Roda a fila pendente; chama `sender` para cada item; mantém na fila se falhar. */
export async function flushQueue(
  sender: (payload: any) => Promise<{ id: string }>,
  onProgress?: (p: FlushProgress) => void,
): Promise<{ ok: number; fail: number }> {
  if (!navigator.onLine) return { ok: 0, fail: 0 };
  const items = (await listQueued()).filter((i) => i.status !== "sincronizado");
  let ok = 0, fail = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    onProgress?.({ index: i + 1, total: items.length, current: it });
    await markQueued(it.local_id, { status: "enviando", error: undefined });
    try {
      const res = await sender(it.payload);
      await markQueued(it.local_id, { status: "sincronizado", remote_id: res.id });
      ok++;
    } catch (e: any) {
      await markQueued(it.local_id, { status: "erro", error: e?.message ?? "Falha" });
      fail++;
    }
  }
  return { ok, fail };
}

export async function retryQueued(local_id: string) {
  await markQueued(local_id, { status: "pendente", error: undefined });
}
