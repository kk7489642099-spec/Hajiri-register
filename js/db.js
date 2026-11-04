// IndexedDB storage layer. Keep database operations in this file.
const DATABASE_NAME = "hajiri-register";
const DATABASE_VERSION = 1;
const STORE_NAMES = ["sites", "workers", "attendance", "transactions"];

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("sites")) {
        db.createObjectStore("sites", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("workers")) {
        const store = db.createObjectStore("workers", { keyPath: "id" });
        store.createIndex("siteId", "siteId", { unique: false });
      }
      if (!db.objectStoreNames.contains("attendance")) {
        const store = db.createObjectStore("attendance", { keyPath: "id" });
        store.createIndex("siteDate", ["siteId", "date"], { unique: true });
      }
      if (!db.objectStoreNames.contains("transactions")) {
        const store = db.createObjectStore("transactions", { keyPath: "id" });
        store.createIndex("siteDate", ["siteId", "date"], { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

let databasePromise;

async function database() {
  if (!databasePromise) databasePromise = openDatabase();
  return databasePromise;
}

export async function getAll(storeName) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getOne(storeName, id) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putOne(storeName, value) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => resolve(value);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function deleteOne(storeName, id) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function replaceAll(snapshot) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAMES, "readwrite");
    for (const storeName of STORE_NAMES) {
      const store = transaction.objectStore(storeName);
      store.clear();
      for (const record of (snapshot[storeName] || [])) store.put(record);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function exportAll() {
  const result = {};
  for (const storeName of STORE_NAMES) result[storeName] = await getAll(storeName);
  return {
    app: "Hajiri Register",
    schemaVersion: DATABASE_VERSION,
    exportedAt: new Date().toISOString(),
    ...result
  };
}
