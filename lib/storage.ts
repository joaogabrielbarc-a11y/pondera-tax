import type { TaxState } from "./tax/types";
import { migrateTaxState } from "./tax/seed";

const DB_NAME = "pondera-tax";
const STORE_NAME = "tax-plans";
const PLAN_KEY = "active-2026";
const FALLBACK_KEY = "pondera-tax:active-2026";
type Snapshot = { savedAt: number; state: TaxState };
let saveQueue: Promise<void> = Promise.resolve();

function snapshot(value: unknown): Snapshot | null {
  if (!value) return null;
  const wrapped = value as Partial<Snapshot>;
  return {
    savedAt: Number(wrapped.savedAt) || 0,
    state: migrateTaxState(wrapped.state ?? value),
  };
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME))
        db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Banco local bloqueado por outra aba."));
  });
}

export async function loadTaxState(): Promise<TaxState | null> {
  let fallback: Snapshot | null = null;
  let localError: unknown;
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    if (raw) fallback = snapshot(JSON.parse(raw));
  } catch (error) {
    localError = error;
  }
  let db: IDBDatabase | undefined;
  try {
    db = await openDatabase();
    const stored = await new Promise<unknown>((resolve, reject) => {
      const request = db!
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .get(PLAN_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const primary = snapshot(stored);
    if (!primary) {
      if (localError) throw localError;
      return fallback?.state ?? null;
    }
    return fallback && fallback.savedAt > primary.savedAt
      ? fallback.state
      : primary.state;
  } catch (error) {
    if (fallback) return fallback.state;
    if (localError) throw localError;
    // No fallback data with an inaccessible database: do not silently overwrite a plan.
    throw error;
  } finally {
    db?.close();
  }
}

export function saveTaxState(state: TaxState): Promise<void> {
  const data: Snapshot = { savedAt: Date.now(), state };
  let mirrored = false;
  try {
    // Synchronous mirror prevents loss when closing the page before IndexedDB commits.
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(data));
    mirrored = true;
  } catch {
    /* IndexedDB may still be available. */
  }
  const task = saveQueue
    .catch(() => undefined)
    .then(async () => {
      let db: IDBDatabase | undefined;
      try {
        db = await openDatabase();
        await new Promise<void>((resolve, reject) => {
          const tx = db!.transaction(STORE_NAME, "readwrite");
          tx.objectStore(STORE_NAME).put(data, PLAN_KEY);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () =>
            reject(tx.error ?? new Error("Salvamento interrompido."));
        });
      } catch (error) {
        if (!mirrored) throw error;
      } finally {
        db?.close();
      }
    });
  saveQueue = task;
  return task;
}
