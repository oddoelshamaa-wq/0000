const CACHE_NAME = 'shamaa-v4';
// ... (نفس قائمة ASSETS السابقة)

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// مستمع لحدث المزامنة في الخلفية
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-punches') {
        event.waitUntil(syncPunchesInBackground());
    }
});

async function syncPunchesInBackground() {
    // نفتح قاعدة البيانات المحلية (IndexedDB) لجلب البصمات المنتظرة
    const punches = await getPendingPunchesFromIndexedDB();
    
    for (const punch of punches) {
        try {
            // استخدام رابط Firebase REST API مباشرة
            const url = `https://brak-nagaf-default-rtdb.firebaseio.com/users/${punch.username}/attendance/${punch.date}.json`;
            
            let data = {};
            if (punch.type === 'in') {
                data = { clockIn: punch.time, status: 'Present', deviceId: punch.deviceId, date: punch.date };
            } else {
                data = { clockOut: punch.time };
            }

            const response = await fetch(url, {
                method: 'PATCH',
                body: JSON.stringify(data)
            });

            if (response.ok) {
                // إذا تم الإرسال بنجاح، نحذفها من الانتظار
                await deletePunchFromIndexedDB(punch.id);
            }
        } catch (error) {
            console.error('Background sync failed for a punch', error);
        }
    }
}

// دالات مساعدة للتعامل مع IndexedDB (لأن LocalStorage لا يعمل في الخلفية)
function getPendingPunchesFromIndexedDB() {
    return new Promise((resolve) => {
        const request = indexedDB.open("ShamaaDB", 1);
        request.onupgradeneeded = e => e.target.result.createObjectStore("syncQueue", { keyPath: "id", autoIncrement: true });
        request.onsuccess = e => {
            const db = e.target.result;
            const transaction = db.transaction("syncQueue", "readonly");
            const store = transaction.objectStore("syncQueue");
            resolve(store.getAll());
        };
    });
}

function deletePunchFromIndexedDB(id) {
    return new Promise((resolve) => {
        const request = indexedDB.open("ShamaaDB", 1);
        request.onsuccess = e => {
            const db = e.target.result;
            const transaction = db.transaction("syncQueue", "readwrite");
            transaction.objectStore("syncQueue").delete(id);
            resolve();
        };
    });
}
