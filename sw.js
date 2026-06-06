// sw.js
const DB_NAME = 'ShamaaOfflineDB';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// دي اللحظة اللي الموبايل بيلقط فيها نت، المتصفح بيصحّي الكود ده فوراً
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-punches') {
        event.waitUntil(doSync());
    }
});

async function doSync() {
    const db = await openDB();
    const punches = await getAllPunches(db);

    for (const punch of punches) {
        try {
            // الرفع لـ Firebase باستخدام REST API (عشان نضمن السرعة والخلفية)
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
                // لو اترفعت بنجاح، امسحها من الموبايل عشان ميتكررش الرفع
                await deletePunch(db, punch.id);
            }
        } catch (err) {
            console.error('فشل الرفع، هيحاول تاني أول ما النت يرجع', err);
            throw err; // دي بتخلي المتصفح يحاول مرة تانية لو النت قطع فجأة
        }
    }
}

// دالات التعامل مع قاعدة البيانات العميقة (IndexedDB)
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('punches')) {
                db.createObjectStore('punches', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

function getAllPunches(db) {
    return new Promise((resolve) => {
        const tx = db.transaction('punches', 'readonly');
        tx.objectStore('punches').getAll().onsuccess = (e) => resolve(e.target.result);
    });
}

function deletePunch(db, id) {
    return new Promise((resolve) => {
        const tx = db.transaction('punches', 'readwrite');
        tx.objectStore('punches').delete(id);
        tx.oncomplete = () => resolve();
    });
}
