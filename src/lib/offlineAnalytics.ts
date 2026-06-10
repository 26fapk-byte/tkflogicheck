interface AnalyticsEvent {
  name: string;
  timestamp: number;
  data?: Record<string, any>;
}

const DB_NAME = 'logicheck_analytics';
const STORE_NAME = 'events';

export async function trackEvent(name: string, data?: Record<string, any>) {
  const event: AnalyticsEvent = {
    name,
    timestamp: Date.now(),
    data
  };

  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.objectStore(STORE_NAME).add(event);

  if (navigator.onLine) {
    await syncAnalytics();
  }
}

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);

    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { autoIncrement: true });
      }
    };
  });
}

export async function syncAnalytics() {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  
  const events = await new Promise<any[]>((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (events.length === 0) return;

  try {
    await fetch('/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(events)
    });

    const delTx = db.transaction(STORE_NAME, 'readwrite');
    delTx.objectStore(STORE_NAME).clear();
  } catch {}
}

window.addEventListener('online', () => syncAnalytics());
