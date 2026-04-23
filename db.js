const DB_NAME = 'opentype';
const DB_VERSION = 1;

let db = null;

export async function initDB() {
  if (db) return db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const d = e.target.result;

      if (!d.objectStoreNames.contains('sessions')) {
        const sessions = d.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
        sessions.createIndex('timestamp', 'timestamp');
        sessions.createIndex('mode', 'mode');
      }

      if (!d.objectStoreNames.contains('keystrokes')) {
        const keystrokes = d.createObjectStore('keystrokes', { keyPath: 'id', autoIncrement: true });
        keystrokes.createIndex('sessionId', 'sessionId');
      }
    };

    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

export async function saveSession(data) {
  const d = await initDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('sessions', 'readwrite');
    const req = tx.objectStore('sessions').add({ ...data, timestamp: Date.now() });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveKeystrokes(sessionId, strokes) {
  const d = await initDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('keystrokes', 'readwrite');
    const store = tx.objectStore('keystrokes');
    strokes.forEach(s => store.add({ ...s, sessionId }));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSessions(limit = 100) {
  const d = await initDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('sessions', 'readonly');
    const req = tx.objectStore('sessions').index('timestamp').getAll();
    req.onsuccess = () => {
      const all = req.result.reverse();
      resolve(limit ? all.slice(0, limit) : all);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getKeystrokes(sessionId) {
  const d = await initDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('keystrokes', 'readonly');
    const req = tx.objectStore('keystrokes').index('sessionId').getAll(sessionId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllKeystrokes() {
  const d = await initDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('keystrokes', 'readonly');
    const req = tx.objectStore('keystrokes').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function clearAll() {
  const d = await initDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(['sessions', 'keystrokes'], 'readwrite');
    tx.objectStore('sessions').clear();
    tx.objectStore('keystrokes').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
