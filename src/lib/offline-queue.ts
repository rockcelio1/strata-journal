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

export async function listQueued(): Promise<QueuedRdo[]> {
  const db = await getDb();
  return (await db.getAll(STORE)) as QueuedRdo[];
}

export async function removeQueued(local_id: string) {
  const db = await getDb();
  await db.delete(STORE, local_id);
}

/** Roda a fila pendente; chama `sender` para cada item; mantém na fila se falhar. */
export async function flushQueue(sender: (payload: any) => Promise<{ id: string }>) {
  if (!navigator.onLine) return;
  const items = await listQueued();
  for (const it of items) {
    if (it.status === "sincronizado") continue;
    await markQueued(it.local_id, { status: "enviando", error: undefined });
    try {
      const res = await sender(it.payload);
      await markQueued(it.local_id, { status: "sincronizado", remote_id: res.id });
    } catch (e: any) {
      await markQueued(it.local_id, { status: "erro", error: e?.message ?? "Falha" });
    }
  }
}
