import type { TaxState } from "./tax/types";
import { migrateTaxState } from "./tax/seed";

const DB_NAME = "pondera-tax";
const STORE_NAME = "tax-plans";
const PLAN_KEY = "active-2026";
const FALLBACK_KEY = "pondera-tax:active-2026";

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
  });
}

export async function loadTaxState(): Promise<TaxState | null> {
  try {
    const db = await openDatabase();
    const value = await new Promise<TaxState | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(PLAN_KEY);
      request.onsuccess = () =>
        resolve(request.result ? migrateTaxState(request.result) : null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return value;
  } catch {
    const raw = localStorage.getItem(FALLBACK_KEY);
    return raw ? migrateTaxState(JSON.parse(raw)) : null;
  }
}

export async function saveTaxState(state: TaxState) {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(state, PLAN_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(state));
  }
}
