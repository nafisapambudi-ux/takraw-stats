/* Takraw Stats Indonesia — service worker.
   Halaman, video beranda, font, dan pustaka Supabase disimpan agar web tetap terbuka saat sinyal venue hilang.
   Data pertandingan tidak lewat sini: aplikasi menyimpannya sendiri di perangkat dan mengirimnya saat online.
   Strategi: jaringan dulu, salinan simpanan bila offline. Ganti VERSION setiap menerbitkan versi baru. */
const VERSION = 'takraw-v8';
const CORE = ['./', './index.html', './media/hero-poster.jpg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (/supabase\.co$/.test(url.hostname)) return;          // API & login selalu langsung ke server
  if (req.headers.has('range')) return;                     // potongan video dilayani browser apa adanya
  const cacheable = url.origin === location.origin || /(cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com)$/.test(url.hostname);
  if (!cacheable) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
