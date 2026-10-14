const C = 'bukutamu-v13', A = ['./', 'index.html', 'style.css', 'config.js', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'logo.png', 'logo-full.png'];
// Pasang tetap berhasil walau ada satu file yang gagal diambil.
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => Promise.allSettled(A.map(u => c.add(new Request(u, { cache: 'reload' }))))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => clients.claim())));
// File aplikasi: ambil dari jaringan dulu (selalu versi terbaru), cadangan dari cache saat offline atau sinyal lemah.
// File luar (font, library Excel): cache dulu.
self.addEventListener('fetch', e => {
    const r = e.request; if (r.method !== 'GET') return;
    const own = new URL(r.url).origin === location.origin, put = res => { const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)); return res };
    e.respondWith(own
        ? Promise.race([fetch(r, { cache: 'no-cache' }), new Promise((_, j) => setTimeout(j, 4000))]).then(res => res.ok ? put(res) : res).catch(() => caches.match(r).then(x => x || (r.mode === 'navigate' ? caches.match('index.html') : Response.error())))
        : caches.match(r).then(x => x || fetch(r).then(put)))
});
