/* TAKRA — service worker.
   Halaman, ikon, gambar pembuka, font, dan pustaka login disimpan agar web (dan aplikasi terpasang) tetap terbuka
   saat sinyal venue hilang. Data pertandingan tidak lewat sini: aplikasi menyimpannya sendiri di perangkat dan
   mengirimnya saat online. Strategi: jaringan dulu (halaman menunggu maks. 4 detik), salinan simpanan bila offline.
   Ganti VERSION setiap menerbitkan versi baru. */
const VERSION = 'takra-v44';
const SUPABASE_LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
const CORE = ['./', './index.html', './manifest.webmanifest', './favicon.ico',
  './media/favicon-32.png', './media/apple-touch-icon.png', './media/icon-192.png', './media/icon-512.png',
  './media/hero-poster.jpg', './media/takra-intro-16x9.jpg', './media/takra-intro-9x16.jpg', SUPABASE_LIB];

self.addEventListener('install', e => {
  // Satu per satu: bila satu file gagal (mis. CDN sesaat tak terjangkau), sisanya tetap tersimpan.
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(CORE.map(u =>
    fetch(u, { cache: 'reload' }).then(r => (r.ok ? c.put(u, r) : null)).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const save = (req, res) => { if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; };
const fromCache = req => caches.match(req, { ignoreSearch: req.mode === 'navigate' });

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (/supabase\.co$/.test(url.hostname)) return;          // API & login selalu langsung ke server
  if (req.headers.has('range')) return;                     // potongan video dilayani browser apa adanya
  const cacheable = url.origin === location.origin || /(cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com)$/.test(url.hostname);
  if (!cacheable) return;
  if (req.mode === 'navigate') {
    // Sinyal lemah ("ada tapi tidak jalan"): jangan biarkan layar putih; setelah 4 detik pakai salinan.
    e.respondWith(new Promise(resolve => {
      let settled = false;
      const timer = setTimeout(() => fromCache(req).then(r => { if (r && !settled) { settled = true; resolve(r); } }), 4000);
      fetch(req).then(res => { save(req, res); if (!settled) { settled = true; clearTimeout(timer); resolve(res); } })
        .catch(() => fromCache(req).then(r => r || caches.match('./index.html')).then(r => { if (!settled) { settled = true; clearTimeout(timer); resolve(r || Response.error()); } }));
    }));
    return;
  }
  e.respondWith(fetch(req).then(res => save(req, res)).catch(() => fromCache(req).then(r => r || Response.error())));
});
