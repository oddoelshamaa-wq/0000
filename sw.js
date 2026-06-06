const CACHE_NAME = 'shamaa-v4';
const DB_NAME = 'ShamaaOfflineDB';

// عند تثبيت الـ Service Worker
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// تفعيل المزامنة في الخلفية
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-punches') {
        event.waitUntil(syncPunches());
    }
});

// وظيفة المزامنة ورفع البيانات لـ Firebase
async function syncPunches() {
    const db = await openDB();
    const punches = await getAllPunches(db);

    for (const punch of punches) {
        try {
            // استخدام REST API الخاص بـ Firebase للرفع من الخلفية
            const url = `https://brak-nagaf-default-rtdb.firebaseio.com/users/${punch.username}/attendance/${punch.date}.json`;
            
            // جلب البيانات الحالية للتأكد من عدم مسح بيانات موجودة
            const response = await fetch(url);
            const currentData = await response.json() || {};

            let updateData = {};
            if (punch.type === 'in') {
                updateData = { ...currentData, clockIn: punch.time, status: 'Present', date: punch.date, deviceId: punch.deviceId };
            } else {
                updateData = { ...currentData, clockOut: punch.time };
            }

            await fetch(url, {
                method: 'PATCH',
                body: JSON.stringify(updateData)
            });

            // حذف البصمة من قاعدة البيانات المحلية بعد نجاح الرفع
            await deletePunch(db, punch.id);
            console.log('تم رفع البصمة من الخلفية بنجاح:', punch);
        } catch (error) {
            console.error('فشلت المزامنة في الخلفية، سيتم المحاولة لاحقاً', error);
            throw error; // لضمان إعادة المحاولة عند توفر الإنترنت مرة أخرى
        }
    }
}

// دالات التعامل مع IndexedDB (قاعدة البيانات المحلية)
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            e.target.result.createObjectStore('punches', { keyPath: 'id', autoIncrement: true });
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function getAllPunches(db) {
    return new Promise((resolve) => {
        const transaction = db.transaction('punches', 'readonly');
        const store = transaction.objectStore('punches');
        store.getAll().onsuccess = (e) => resolve(e.target.result);
    });
}

async function deletePunch(db, id) {
    return new Promise((resolve) => {
        const transaction = db.transaction('punches', 'readwrite');
        const store = transaction.objectStore('punches');
        store.delete(id).onsuccess = () => resolve();
    });
}
