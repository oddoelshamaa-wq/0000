// sw.js
const CACHE_NAME = 'shamaa-v3';
const DB_NAME = 'ShamaaOfflineDB';

// ... (نفس الكود القديم الخاص بـ ASSETS و install و activate) ...

// إضافة مستمع لحدث المزامنة في الخلفية
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-punches') {
        event.waitUntil(syncPunches());
    }
});

async function syncPunches() {
    const db = await openIDB();
    const punches = await getAllPunches(db);

    for (const punch of punches) {
        try {
            // استخدام REST API لـ Firebase للرفع في الخلفية
            const url = `https://brak-nagaf-default-rtdb.firebaseio.com/users/${punch.username}/attendance/${punch.date}.json`;
            
            // تجهيز البيانات (رفع الدخول أو الخروج)
            let body = {};
            if (punch.type === 'in') {
                body = { clockIn: punch.time, status: 'Present', deviceId: punch.deviceId, date: punch.date };
            } else {
                body = { clockOut: punch.time };
            }

            const response = await fetch(url, {
                method: 'PATCH', // استخدام PATCH لتحديث الحقول دون مسح البقية
                body: JSON.stringify(body)
            });

            if (response.ok) {
                // إذا نجح الرفع، احذف البصمة من قاعدة البيانات المحلية
                await deletePunch(db, punch.id);
            }
        } catch (error) {
            console.error('فشل رفع البصمة في الخلفية:', error);
            throw error; // لإعادة المحاولة لاحقاً
        }
    }
}

// دالات مساعدة للتعامل مع IndexedDB داخل الـ Service Worker
function openIDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getAllPunches(db) {
    return new Promise((resolve) => {
        const transaction = db.transaction('punches', 'readonly');
        const store = transaction.objectStore('punches');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
    });
}

function deletePunch(db, id) {
    return new Promise((resolve) => {
        const transaction = db.transaction('punches', 'readwrite');
        const store = transaction.objectStore('punches');
        store.delete(id);
        transaction.oncomplete = () => resolve();
    });
}
