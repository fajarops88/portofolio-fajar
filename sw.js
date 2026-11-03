/*
 * sw.js — Service Worker PWA (skill gas-pwa-github)
 * - Halaman HTML: network-first (selalu versi terbaru bila online, cadangan cache saat offline)
 * - Aset statis (css/js/ikon/font): stale-while-revalidate
 * - Permintaan ke Google Apps Script / Google login / Drive TIDAK PERNAH di-cache
 * Naikkan VERSI setiap kali Anda mengubah berkas frontend agar cache lama dibersihkan.
 */
const VERSI = 'portofolio-v1.9.0';
const INTI = ['./', './index.html', './bayar.html', './config.js', './manifest.json', './assets/tema.css', './assets/api.js', './assets/kwitansi.js', './icons/icon-192.png', './icons/icon-512.png'];
const JANGAN_CACHE = ['script.google.com', 'script.googleusercontent.com', 'accounts.google.com', 'oauth2.googleapis.com', 'drive.google.com', 'googleusercontent.com', 'youtube'];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(VERSI).then((c) => c.addAll(INTI)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (ev) => {
  ev.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSI).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;                                         // POST (API) tidak pernah lewat cache
  const url = new URL(req.url);
  if (JANGAN_CACHE.some((d) => url.hostname.includes(d))) return;           // data dinamis & login → langsung ke jaringan
  if (url.pathname.endsWith('/admin.html') || url.pathname.includes('/assets/admin')) return;   // dashboard admin selalu segar
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    ev.respondWith(fetch(req).then((res) => { const salin = res.clone(); caches.open(VERSI).then((c) => c.put(req, salin)); return res; })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html'))));
    return;
  }
  ev.respondWith(caches.match(req).then((tersimpan) => {
    const segar = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) { const salin = res.clone(); caches.open(VERSI).then((c) => c.put(req, salin)); } return res; }).catch(() => tersimpan);
    return tersimpan || segar;
  }));
});