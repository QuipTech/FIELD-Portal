import type { NewHistoryEntry } from "@/lib/types/historyEntry";

// History entries saved while out of range, kept in IndexedDB (it stores
// the photo Files as they are, unlike localStorage) until they sync.
export interface QueuedHistoryEntry {
  id: string;
  machineId: string;
  queuedAt: string;
  entry: NewHistoryEntry;
}

const DATABASE_NAME = "fieldOfflineHistory";
const STORE_NAME = "queuedEntries";

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const runInStore = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = run(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).finally(() => database.close()) as Promise<T>;
};

export const queueHistoryEntry = async (queued: QueuedHistoryEntry): Promise<void> => {
  await runInStore("readwrite", (store) => store.put(queued));
};

export const listQueuedHistoryEntries = async (machineId: string): Promise<QueuedHistoryEntry[]> => {
  const all = await runInStore<QueuedHistoryEntry[]>("readonly", (store) => store.getAll());
  return all.filter((queued) => queued.machineId === machineId).sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
};

export const removeQueuedHistoryEntry = async (id: string): Promise<void> => {
  await runInStore("readwrite", (store) => store.delete(id));
};
