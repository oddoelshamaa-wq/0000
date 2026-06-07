// sw.js

const CACHE_NAME = 'shamaa-cache-v2';
const OFFLINE_URL = '/';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        '/',
        '/index.html'
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(keyList.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
  }
});

// ====== هنا السحر بتاع فتح النت في الخلفية ======
self.addEventListener('sync', event => {
  if (event.tag === 'sync-punches') {
    event.waitUntil(syncPunchesInBackground());
  }
});

async function syncPunchesInBackground() {
  // فتح قاعدة البيانات المحلية (IndexedDB) اللي حفظنا فيها البصمة
  const db = await openDB();
  const punches = await getAllPunches(db);
  
  for (const punch of punches) {
    try {
      // محاولة رفع البصمة لـ Firebase
      const response = await fetch(`https://brak-nagaf-default-rtdb.firebaseio.com/users/${punch.username}/attendance/${punch.date}.json`, {
        method: 'PATCH',
        body: JSON.stringify(punch.data),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        // لو اترفعت بنجاح، نمسحها من المحلي عشان مترفعهش تاني
        await deletePunch(db, punch.id);
      }
    } catch (error) {
      console.error('فشل الرفع في الخلفية', error);
    }
  }
}

// دوال مساعدة لقاعدة البيانات المحلية IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ShamaaPunchDB', 1);
    request.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('punches')) {
        db.createObjectStore('punches', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = e => resolve(e.target.result);
    request.onerror = e => reject(e.target.error);
  });
}

function getAllPunches(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('punches', 'readonly');
    const store = tx.objectStore('punches');
    const request = store.getAll();
    request.onsuccess = e => resolve(e.target.result);
    request.onerror = e => reject(e.target.error);
  });
}

function deletePunch(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('punches', 'readwrite');
    const store = tx.objectStore('punches');
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = e => reject(e.target.error);
  });
}
