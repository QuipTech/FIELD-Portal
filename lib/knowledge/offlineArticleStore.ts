import type { KnowledgeArticle } from "../types/knowledgeArticle";

// Knowledge articles saved for offline reading ("Save offline"), kept in
// IndexedDB with the PDF itself (a Blob), so both open without a signal.
export interface OfflineArticle {
  id: string;
  savedAt: string;
  article: KnowledgeArticle;
  // Null when the PDF couldn't be fetched (e.g. the bucket refuses
  // cross-origin reads); the article text is still saved.
  pdf: Blob | null;
}

const DATABASE_NAME = "fieldOfflineKnowledge";
const STORE_NAME = "articles";

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const runInStore = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const request = run(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).finally(() => database.close());
};

export const saveOfflineArticle = async (saved: OfflineArticle): Promise<void> => {
  await runInStore("readwrite", (store) => store.put(saved));
};

export const findOfflineArticle = async (id: string): Promise<OfflineArticle | null> =>
  (await runInStore<OfflineArticle | undefined>("readonly", (store) => store.get(id))) ?? null;

export const removeOfflineArticle = async (id: string): Promise<void> => {
  await runInStore("readwrite", (store) => store.delete(id));
};
