/*
 * api.js — klien REST untuk backend Google Apps Script (dipakai index, bayar, admin)
 * - POST dengan Content-Type text/plain → tidak memicu preflight CORS
 * - permintaan baca yang identik digabung (dedupe in-flight)
 * - bila respons membawa nq > 0, antrean notifikasi dikosongkan lewat pub.drain (sekali, ditunda 1,2 dtk)
 * - swr(): tampilkan data tersimpan dulu, lalu perbarui dari server (stale-while-revalidate)
 */
(function () {
  'use strict';
  var CFG = window.APP_CONFIG || {};
  var URL_API = CFG.API_URL || '';
  var inflight = {};
  var drainTimer = null;

  function simpan(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function baca(k) { try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function hapus(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function devId() {
    var d = null;
    try { d = localStorage.getItem('pf_dev'); } catch (e) {}
    if (!d) {
      d = 'd' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      try { localStorage.setItem('pf_dev', d); } catch (e) {}
    }
    return d;
  }
  function perangkat() {
    var w = Math.min(window.innerWidth || 1024, screen.width || 1024);
    return w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
  }
  function siap() { return URL_API && URL_API.indexOf('GANTI_') === -1; }

  function jadwalDrain() {
    if (drainTimer) return;
    drainTimer = setTimeout(function () { drainTimer = null; post('pub.drain', {}, { senyap: true }); }, 1200);
  }

  /** post(action, data, {token, timeout, senyap, tanpaDedupe}) → Promise<{ok,data,message,code}> (tidak pernah reject) */
  function post(action, data, opsi) {
    opsi = opsi || {};
    if (!siap()) return Promise.resolve({ ok: false, code: 'CONFIG', message: 'URL API belum diisi di config.js.' });
    var body = JSON.stringify({ action: action, data: data || {}, token: opsi.token || undefined });
    var kunci = opsi.tanpaDedupe ? null : action + '|' + body;
    if (kunci && inflight[kunci]) return inflight[kunci];
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, opsi.timeout || 45000) : null;
    var p = fetch(URL_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body, redirect: 'follow', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.nq > 0 && action !== 'pub.drain') jadwalDrain(); return j || { ok: false, message: 'Respons kosong.' }; })
      .catch(function (e) {
        var batal = e && e.name === 'AbortError';
        return { ok: false, code: batal ? 'TIMEOUT' : 'JARINGAN', message: batal ? 'Server terlalu lama merespons. Coba lagi.' : 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.' };
      })
      .then(function (j) { if (t) clearTimeout(t); if (kunci) delete inflight[kunci]; return j; });
    if (kunci) inflight[kunci] = p;
    return p;
  }

  /** GET sederhana (tanpa preflight) — dipakai untuk konten publik & verifikasi kwitansi */
  function get(params) {
    if (!siap()) return Promise.resolve({ ok: false, code: 'CONFIG', message: 'URL API belum diisi di config.js.' });
    var q = Object.keys(params || {}).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    var kunci = 'GET|' + q;
    if (inflight[kunci]) return inflight[kunci];
    var p = fetch(URL_API + (q ? '?' + q : ''), { method: 'GET', redirect: 'follow' })
      .then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, code: 'JARINGAN', message: 'Tidak dapat terhubung ke server.' }; })
      .then(function (j) { delete inflight[kunci]; return j; });
    inflight[kunci] = p;
    return p;
  }

  /** kirim tanpa menunggu (statistik saat halaman ditutup) */
  function beacon(action, data) {
    if (!siap()) return false;
    var body = JSON.stringify({ action: action, data: data || {} });
    try {
      if (navigator.sendBeacon) return navigator.sendBeacon(URL_API, new Blob([body], { type: 'text/plain;charset=utf-8' }));
    } catch (e) {}
    try { fetch(URL_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body, keepalive: true }); } catch (e) {}
    return true;
  }

  /** stale-while-revalidate: onData(data, dariCache) bisa dipanggil 2× */
  function swr(kunciCache, pengambil, onData, maksUmurMs) {
    var c = baca('swr_' + kunciCache);
    if (c && c.d !== undefined && (!maksUmurMs || Date.now() - c.t < maksUmurMs)) { try { onData(c.d, true); } catch (e) { console.error(e); } }
    return pengambil().then(function (r) {
      if (r && r.ok) { simpan('swr_' + kunciCache, { t: Date.now(), d: r.data }); onData(r.data, false); }
      return r;
    });
  }

  /** escape teks untuk disisipkan ke HTML */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /** hanya izinkan tautan aman */
  function urlAman(u, izinkanMailto) {
    u = String(u || '').trim();
    if (/^https:\/\//i.test(u)) return u;
    if (izinkanMailto && /^(mailto:|tel:)/i.test(u)) return u;
    return '';
  }
  function rupiah(n) { return 'Rp ' + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  var BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var BULAN_PANJANG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  function tgl(s, panjang) {
    var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (!m) return String(s || '');
    return +m[3] + ' ' + (panjang ? BULAN_PANJANG : BULAN)[+m[2] - 1] + ' ' + m[1] + (m[4] ? ', ' + m[4] + ':' + m[5] : '');
  }
  function relatif(s) {
    var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return tgl(s);
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 8, +m[5], +(m[6] || 0)), d = (Date.now() - t) / 1000;   // server WITA (UTC+8)
    if (d < 60) return 'baru saja';
    if (d < 3600) return Math.floor(d / 60) + ' mnt lalu';
    if (d < 86400) return Math.floor(d / 3600) + ' jam lalu';
    if (d < 172800) return 'Kemarin';
    if (d < 604800) return Math.floor(d / 86400) + ' hari lalu';
    return tgl(s);
  }
  /** muat skrip CDN sekali saja */
  var dimuat = {};
  function muatSkrip(src) {
    if (dimuat[src]) return dimuat[src];
    dimuat[src] = new Promise(function (ok, gagal) {
      var s = document.createElement('script');
      s.src = src; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = ok; s.onerror = function () { delete dimuat[src]; gagal(new Error('Gagal memuat ' + src)); };
      document.head.appendChild(s);
    });
    return dimuat[src];
  }
  var LIB = {
    chart: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js',
    xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
    autotable: 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',
    qr: 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js'
  };

  /** kompres gambar di browser (sisi terpanjang maks. 1600 px) → {nama, mime, b64, ukuran} */
  function kompresGambar(file, maks, kualitas) {
    maks = maks || 1600; kualitas = kualitas || 0.82;
    return new Promise(function (ok, gagal) {
      if (!file) return gagal(new Error('Berkas belum dipilih.'));
      var jenis = file.type;
      var bacaB64 = function (blob, mime) {
        var fr = new FileReader();
        fr.onload = function () { var b64 = String(fr.result).split(',')[1] || ''; ok({ nama: file.name, mime: mime, b64: b64, ukuran: Math.round(b64.length * 0.75) }); };
        fr.onerror = function () { gagal(new Error('Gagal membaca berkas.')); };
        fr.readAsDataURL(blob);
      };
      if (jenis === 'application/pdf') return bacaB64(file, jenis);
      if (!/^image\/(jpeg|png|webp)$/.test(jenis)) return gagal(new Error('Format tidak didukung. Gunakan JPG, PNG, atau WEBP.'));
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, maks / Math.max(w, h));
        var cv = document.createElement('canvas');
        cv.width = Math.round(w * s); cv.height = Math.round(h * s);
        var cx = cv.getContext('2d');
        var keluar = jenis === 'image/png' && file.size < 600 * 1024 ? 'image/png' : 'image/jpeg';
        if (keluar === 'image/jpeg') { cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); }
        cx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) { if (!b) return gagal(new Error('Gagal mengompres gambar.')); bacaB64(b, keluar); }, keluar, kualitas);
      };
      img.onerror = function () { URL.revokeObjectURL(url); gagal(new Error('Gambar rusak atau tidak bisa dibaca.')); };
      img.src = url;
    });
  }

  window.API = { post: post, get: get, beacon: beacon, swr: swr, devId: devId, perangkat: perangkat, siap: siap,
    esc: esc, urlAman: urlAman, rupiah: rupiah, tgl: tgl, relatif: relatif, muatSkrip: muatSkrip, LIB: LIB,
    kompresGambar: kompresGambar, simpan: simpan, baca: baca, hapus: hapus, BULAN_PANJANG: BULAN_PANJANG };
})();
