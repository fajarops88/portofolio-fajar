/*
 * admin.js — inti dashboard admin: gerbang alamat rahasia, login Google (GIS), sesi 2 jam,
 * router hash, komponen UI (toast, modal, konfirmasi), modul Beranda, Profil, CRUD Konten, Pesan Masuk.
 * Semua isi dari server ditampilkan lewat esc() — tidak ada innerHTML dari data mentah.
 */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var e = function (s) { return API.esc(s); };
  var S = { token: '', exp: 0, me: null, kunci: '', info: {}, cache: {}, grafik: [], timer: null, rute: '' };
  var MODUL = {};
  var GRUP = [
    ['Utama', ['beranda']],
    ['Konten', ['profil', 'tentang', 'sertifikat', 'agenda', 'kinerja', 'wawasan', 'keahlian', 'portofolio', 'testimoni', 'kontak']],
    ['Aktivitas', ['pesan', 'statistik']],
    ['Bisnis', ['tagihan', 'notifikasi', 'crm']],
    ['Sistem', ['pengaturan', 'migrasi', 'sistem']]
  ];

  /* =====================================================================
   * KOMPONEN UI
   * ===================================================================== */
  function toast(pesan, jenis) {
    var t = document.createElement('div');
    t.className = 'toast ' + (jenis || 'sukses');
    t.setAttribute('role', jenis === 'galat' ? 'alert' : 'status');
    t.innerHTML = '<span class="ms">' + (jenis === 'galat' ? 'error' : jenis === 'info' ? 'info' : 'check_circle') + '</span><span></span>';
    t.lastChild.textContent = pesan || (jenis === 'galat' ? 'Terjadi kesalahan.' : 'Tersimpan.');
    $('#toast').appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(function () { t.remove(); }, 320); }, jenis === 'galat' ? 6000 : 3500);
  }
  /** modal({judul, isi, tombol:[{teks, kelas, aksi(m)->Promise|bool}], lebar, saatBuka(m)}) */
  function modal(o) {
    var lama = document.activeElement;
    var latar = document.createElement('div');
    latar.className = 'modal-latar';
    latar.innerHTML = '<div class="modal' + (o.lebar ? ' lebar' : '') + '" role="dialog" aria-modal="true" aria-labelledby="mj"><div class="modal-kepala"><h3 id="mj"></h3><button class="btn btn-ikon kecil" type="button" data-tutup aria-label="Tutup"><span class="ms">close</span></button></div><div class="modal-isi"></div>' +
      (o.tombol && o.tombol.length ? '<div class="modal-kaki"></div>' : '') + '</div>';
    $('#mj', latar).textContent = o.judul || '';
    $('.modal-isi', latar).innerHTML = o.isi || '';
    var m = { el: latar, isi: $('.modal-isi', latar), tutup: function () { latar.remove(); document.removeEventListener('keydown', esc); if (lama && lama.focus) lama.focus(); } };
    var esc = function (ev) { if (ev.key === 'Escape') m.tutup(); };
    (o.tombol || []).forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'btn ' + (t.kelas || 'btn-garis'); b.innerHTML = t.teks;
      b.addEventListener('click', function () {
        if (!t.aksi) return m.tutup();
        var hasil = t.aksi(m, b);
        if (hasil && hasil.then) { sibuk(b, true); hasil.then(function (x) { sibuk(b, false); if (x !== false) m.tutup(); }, function () { sibuk(b, false); }); }
        else if (hasil !== false) m.tutup();
      });
      $('.modal-kaki', latar).appendChild(b);
    });
    latar.addEventListener('mousedown', function (ev) { if (ev.target === latar) m.tutup(); });
    $('[data-tutup]', latar).addEventListener('click', m.tutup);
    document.addEventListener('keydown', esc);
    document.body.appendChild(latar);
    var f = $('input:not([type=hidden]):not([readonly]),textarea,select', m.isi);
    setTimeout(function () { (f || $('[data-tutup]', latar)).focus(); }, 30);
    if (o.saatBuka) o.saatBuka(m);
    return m;
  }
  function konfirmasi(judul, pesan, teksYa, bahaya) {
    return new Promise(function (ok) {
      var jawab = false;
      var m = modal({ judul: judul, isi: '<p style="color:var(--abu-2)"></p>', tombol: [
        { teks: 'Batal', kelas: 'btn-garis' },
        { teks: teksYa || 'Ya, lanjutkan', kelas: bahaya ? 'btn-bahaya' : 'btn-utama', aksi: function () { jawab = true; } }] });
      $('p', m.isi).textContent = pesan;
      var asli = m.tutup;
      m.tutup = function () { asli(); ok(jawab); };
      $$('[data-tutup]', m.el).forEach(function (b) { b.onclick = m.tutup; });
    });
  }
  function laci(o) {
    var l = document.createElement('div');
    l.className = 'laci-kanan';
    l.innerHTML = '<div class="panel-laci" role="dialog" aria-modal="true"><div class="kepala"><h3 style="font-size:17px"></h3><button class="btn btn-ikon kecil" type="button" data-tutup aria-label="Tutup"><span class="ms">close</span></button></div><div class="badan"></div>' + (o.kaki ? '<div class="kaki"></div>' : '') + '</div>';
    $('h3', l).textContent = o.judul || '';
    $('.badan', l).innerHTML = o.isi || '';
    if (o.kaki) $('.kaki', l).innerHTML = o.kaki;
    var d = { el: l, badan: $('.badan', l), tutup: function () { l.remove(); document.removeEventListener('keydown', esc); } };
    var esc = function (ev) { if (ev.key === 'Escape') d.tutup(); };
    l.addEventListener('mousedown', function (ev) { if (ev.target === l) d.tutup(); });
    $('[data-tutup]', l).addEventListener('click', d.tutup);
    document.addEventListener('keydown', esc);
    document.body.appendChild(l);
    $('[data-tutup]', l).focus();
    return d;
  }
  function sibuk(b, ya, teks) {
    if (!b) return;
    if (ya) { b.dataset.asli = b.innerHTML; b.disabled = true; b.innerHTML = '<span class="ms putar">progress_activity</span>' + (teks ? '<span>' + e(teks) + '</span>' : ''); }
    else { b.disabled = false; if (b.dataset.asli) b.innerHTML = b.dataset.asli; }
  }
  /** ambil nilai semua [name] di dalam elemen */
  function ambil(el) {
    var o = {};
    $$('[name]', el).forEach(function (i) {
      if (i.type === 'checkbox') o[i.name] = i.checked;
      else if (i.type === 'radio') { if (i.checked) o[i.name] = i.value; }
      else o[i.name] = i.value;
    });
    return o;
  }
  /** tandai galat per kolom dari respons VALIDASI */
  function tandaiGalat(el, galat) {
    $$('.bidang', el).forEach(function (b) { b.classList.remove('salah'); });
    var pertama = null;
    Object.keys(galat || {}).forEach(function (k) {
      var i = $('[name="' + k + '"]', el); if (!i) return;
      var b = i.closest('.bidang'); if (!b) return;
      b.classList.add('salah');
      var g = $('.galat', b);
      if (!g) { g = document.createElement('span'); g.className = 'galat'; b.appendChild(g); }
      g.innerHTML = '<span class="ms" style="font-size:16px">error</span><span></span>'; g.lastChild.textContent = galat[k];
      if (!pertama) pertama = i;
    });
    if (pertama) pertama.focus();
  }
  function bidang(o) {
    // o: {k, label, tipe, nilai, bantu, wajib, maks, opsi:[], atribut, penuh, placeholder, baris}
    var v = o.nilai === undefined || o.nilai === null ? '' : o.nilai, id = 'f_' + o.k + '_' + Math.random().toString(36).slice(2, 6), inp;
    var at = (o.maks ? ' maxlength="' + o.maks + '"' : '') + (o.wajib ? ' required' : '') + (o.placeholder ? ' placeholder="' + e(o.placeholder) + '"' : '') + (o.atribut || '');
    if (o.tipe === 'textarea') inp = '<textarea id="' + id + '" name="' + o.k + '"' + at + (o.baris ? ' style="min-height:' + o.baris * 24 + 'px"' : '') + '>' + e(v) + '</textarea>';
    else if (o.tipe === 'select') inp = '<select id="' + id + '" name="' + o.k + '"' + at + '>' + o.opsi.map(function (x) { var val = Array.isArray(x) ? x[0] : x, lb = Array.isArray(x) ? x[1] : x; return '<option value="' + e(val) + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + e(lb) + '</option>'; }).join('') + '</select>';
    else if (o.tipe === 'saklar') return '<div class="baris-saklar' + (o.penuh ? ' penuh' : '') + '"><span><b>' + e(o.label) + '</b>' + (o.bantu ? '<small>' + e(o.bantu) + '</small>' : '') + '</span><label class="saklar"><input type="checkbox" name="' + o.k + '"' + (v === true || v === 'Ya' || v === 'YA' ? ' checked' : '') + ' aria-label="' + e(o.label) + '"><span></span></label></div>';
    else inp = '<input id="' + id + '" name="' + o.k + '" type="' + (o.tipe || 'text') + '" value="' + e(v) + '"' + at + '>';
    return '<div class="bidang' + (o.penuh ? ' penuh' : '') + '"><label for="' + id + '">' + e(o.label) + (o.wajib ? ' <span style="color:var(--merah)">*</span>' : '') + '</label>' + inp +
      (o.bantu ? '<span class="bantu">' + o.bantu + '</span>' : '') + '<span class="galat"></span></div>';
  }
  function kosong(ikon, teks, tombol) { return '<div class="kosong"><span class="ms">' + ikon + '</span><p>' + e(teks) + '</p>' + (tombol || '') + '</div>'; }
  function lencana(st) {
    var w = { 'baru': 'biru', 'dibaca': 'abu', 'Ya': 'hijau', 'Tidak': 'abu', 'Lunas': 'hijau', 'Gratis': 'hijau', 'Terverifikasi': 'hijau', 'Terkirim': 'hijau', 'Selesai': 'hijau', 'Aktif': 'hijau',
      'Menunggu Verifikasi': 'kuning', 'Menunggu': 'kuning', 'Disetujui': 'hijau', 'Antri': 'kuning', 'Proses': 'kuning', 'Berjalan': 'biru', 'Terlambat': 'merah', 'Ditolak': 'merah', 'Gagal': 'merah',
      'Belum Bayar': 'oranye', 'Batal': 'abu', 'Dihentikan': 'abu', 'Nonaktif': 'abu', 'Terdaftar': 'hijau', 'Tidak Terdaftar': 'merah' }[st] || 'abu';
    var label = { 'baru': 'Baru', 'dibaca': 'Dibaca', 'Ya': 'Tampil', 'Tidak': 'Disembunyikan' }[st] || st;
    return '<span class="lencana ' + w + '">' + e(label) + '</span>';
  }
  function ubahPersen(n) {
    if (n === undefined || n === null) return '';
    var naik = n >= 0;
    return '<small class="' + (naik ? 'naik' : 'turun') + '"><span class="ms" style="font-size:16px">' + (naik ? 'trending_up' : 'trending_down') + '</span>' + (naik ? '+' : '') + String(n).replace('.', ',') + '%</small>';
  }
  function angka(n) { return (Number(n) || 0).toLocaleString('id-ID'); }
  function hariIni(panjang) { return new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: panjang ? 'long' : 'short', year: 'numeric' }); }
  function inisial(n) { var p = String(n || '').split(',')[0].trim().split(/\s+/).filter(Boolean); return p.length ? (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() : 'A'; }

  /** urutan seret-lepas + tombol naik/turun (aksesibel keyboard) */
  function pasangUrut(wadah, selektor, simpan) {
    var seret = null;
    $$(selektor, wadah).forEach(function (it) {
      var pg = $('.pegang', it);
      if (pg) { pg.addEventListener('mousedown', function () { it.draggable = true; }); pg.addEventListener('touchstart', function () { it.draggable = true; }, { passive: true }); }
      it.addEventListener('dragstart', function (ev) { seret = it; it.classList.add('seret'); ev.dataTransfer.effectAllowed = 'move'; try { ev.dataTransfer.setData('text/plain', it.dataset.id); } catch (x) {} });
      it.addEventListener('dragend', function () { it.classList.remove('seret'); it.draggable = false; $$('.target-seret', wadah).forEach(function (x) { x.classList.remove('target-seret'); }); if (seret) { seret = null; simpan(urutan()); } });
      it.addEventListener('dragover', function (ev) {
        if (!seret || seret === it) return; ev.preventDefault();
        var r = it.getBoundingClientRect(), sesudah = ev.clientY > r.top + r.height / 2;
        it.parentNode.insertBefore(seret, sesudah ? it.nextSibling : it);
      });
    });
    wadah.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-geser]'); if (!b) return;
      var it = b.closest(selektor), arah = b.getAttribute('data-geser');
      var tujuan = arah === 'naik' ? it.previousElementSibling : it.nextElementSibling;
      if (!tujuan || !tujuan.matches(selektor)) return;
      it.parentNode.insertBefore(it, arah === 'naik' ? tujuan : tujuan.nextSibling);
      b.focus(); simpan(urutan());
    });
    function urutan() { return $$(selektor, wadah).map(function (x) { return x.dataset.id; }); }
  }

  /* =====================================================================
   * API + SESI
   * ===================================================================== */
  function api(aksi, data, opsi) {
    opsi = opsi || {}; opsi.token = S.token;
    return API.post(aksi, data || {}, opsi).then(function (r) {
      if (!r.ok && r.code === 'AUTH') akhiriSesi('berakhir');
      return r;
    });
  }
  function simpanSesi() { try { sessionStorage.setItem('adm_t', JSON.stringify({ token: S.token, exp: S.exp, me: S.me })); } catch (x) {} }
  function akhiriSesi(alasan) {
    S.token = ''; S.cache = {};
    try { sessionStorage.removeItem('adm_t'); } catch (x) {}
    clearInterval(S.timer);
    $('#aplikasi').hidden = true; $('#layar-masuk').hidden = false;
    $$('.modal-latar,.laci-kanan').forEach(function (x) { x.remove(); });
    tampilMasuk(alasan || 'siap');
  }
  function perbaruiTimer() {
    var sisa = S.exp - Date.now();
    if (sisa <= 0) return akhiriSesi('berakhir');
    var j = Math.floor(sisa / 3600000), m = Math.floor((sisa % 3600000) / 60000);
    $('#sesi-teks').textContent = 'Sesi berakhir dalam ' + (j ? j + ' j ' : '') + m + ' m';
    $('#sesi').classList.toggle('hampir', sisa < 10 * 60000);
  }

  /* ---------- layar masuk ---------- */
  function tampilMasuk(st, x) {
    var k = $('#kartu-masuk'), kembali = '<a class="btn btn-teks" href="./"><span class="ms">arrow_back</span>Kembali ke Landing Page</a>';
    var h = '';
    if (st === 'cek') h = '<span class="ikon-besar"><span class="ms putar">progress_activity</span></span><h1>Memeriksa alamat…</h1>';
    else if (st === 'siap') {
      var adaG = !!S.info.googleClientId;
      h = '<span class="ikon-besar"><span class="ms">lock</span></span><h1>Dashboard Admin</h1><p>Masuk khusus pemilik situs (Super Admin)</p>' +
        (adaG ? '<div id="gis-tombol"><span class="ms putar">progress_activity</span></div>' : '<div class="info-kotak kuning" style="text-align:left"><span class="ms">warning</span><span>Login Google belum dikonfigurasi (GOOGLE_CLIENT_ID kosong). Masuk dengan akses darurat, lalu isi Client ID di Pengaturan → Keamanan.</span></div>') +
        '<div class="catatan"><span class="ms">verified_user</span><span>Hanya akun Google yang terdaftar di <b>Script Properties</b> yang dapat membuka dashboard.</span></div>' +
        (S.info.adaDarurat ? '<button class="btn btn-teks" type="button" id="ke-darurat"><span class="ms">key</span>Masuk dengan akses darurat</button>' : '') + kembali;
    } else if (st === 'verifikasi') h = '<span class="ikon-besar"><span class="ms">lock_clock</span></span><h1>Dashboard Admin</h1><p>Memverifikasi akun Google &amp; kredensial…</p><div class="progres-verif"><i></i></div><div class="catatan"><span class="ms" style="color:var(--utama)">info</span><span>Server mencocokkan token Google dengan email admin di Script Properties.</span></div>';
    else if (st === 'ditolak') h = '<span class="ikon-besar merah"><span class="ms">gpp_bad</span></span><span class="kode">ERR_403_FORBIDDEN</span><h1>Akses Ditolak</h1><p>' + e(x || 'Akun ini tidak terdaftar sebagai Super Admin.') + ' Halaman ini dibatasi hanya untuk pemilik portofolio.</p><button class="btn btn-utama" type="button" id="akun-lain"><span class="ms">switch_account</span>Masuk dengan Akun Lain</button>' + kembali;
    else if (st === 'berakhir') h = '<span class="ikon-besar kuning"><span class="ms">timer_off</span></span><span class="kode">ERR_401_SESSION_EXPIRED</span><h1>Sesi Berakhir</h1><p>Demi keamanan, sesi login otomatis berakhir setelah ' + (S.info.sesiJam || 2) + ' jam. Silakan masuk kembali untuk melanjutkan.</p><button class="btn btn-utama" type="button" id="masuk-lagi"><span class="ms">login</span>Masuk Lagi</button>';
    else if (st === 'gagal') h = '<span class="ikon-besar kuning"><span class="ms">sync_problem</span></span><span class="kode">ERR_502_VERIFIKASI</span><h1>Verifikasi Gagal</h1><p>' + e(x || 'Server tidak dapat dihubungi.') + '</p><button class="btn btn-utama" type="button" id="coba-lagi"><span class="ms">replay</span>Coba Lagi</button>' + kembali;
    else if (st === 'darurat') h = '<span class="ikon-besar"><span class="ms">key</span></span><h1>Akses Darurat</h1><p>Gunakan hanya bila login Google bermasalah. Terkunci 15 menit setelah 5× salah.</p><form id="f-darurat" novalidate>' +
      bidang({ k: 'username', label: 'Nama pengguna', wajib: true, atribut: ' autocomplete="username"' }) + bidang({ k: 'password', label: 'Kata sandi', tipe: 'password', wajib: true, atribut: ' autocomplete="current-password"' }) +
      '<button class="btn btn-utama" type="submit"><span class="ms">login</span>Masuk</button></form>' + (S.info.googleClientId ? '<button class="btn btn-teks" type="button" id="ke-google"><span class="ms">arrow_back</span>Masuk dengan Google</button>' : '') + kembali;
    k.innerHTML = h;
    if (st === 'siap' && S.info.googleClientId) pasangGoogle();
    if ($('#ke-darurat')) $('#ke-darurat').onclick = function () { tampilMasuk('darurat'); };
    if ($('#ke-google')) $('#ke-google').onclick = function () { tampilMasuk('siap'); };
    ['#akun-lain', '#masuk-lagi'].forEach(function (s) { if ($(s)) $(s).onclick = function () { try { google.accounts.id.disableAutoSelect(); } catch (z) {} tampilMasuk('siap'); }; });
    if ($('#coba-lagi')) $('#coba-lagi').onclick = mulai;
    var fd = $('#f-darurat');
    if (fd) fd.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var v = ambil(fd), b = $('button[type=submit]', fd);
      sibuk(b, true, 'Memeriksa…');
      API.post('auth.darurat', { k: S.kunci, username: v.username, password: v.password }).then(function (r) {
        sibuk(b, false);
        if (!r.ok) { if (r.code === 'GATE') return keluarGerbang(); return toast(r.message, 'galat'); }
        terimaSesi(r.data);
      });
    });
  }
  function pasangGoogle() {
    API.muatSkrip('https://accounts.google.com/gsi/client').then(function () {
      google.accounts.id.initialize({ client_id: S.info.googleClientId, callback: kredensialGoogle, auto_select: false, cancel_on_tap_outside: true, use_fedcm_for_prompt: true });
      var w = $('#gis-tombol'); if (!w) return;
      w.innerHTML = '';
      google.accounts.id.renderButton(w, { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'id', width: 280 });
    }).catch(function () {
      var w = $('#gis-tombol'); if (w) w.innerHTML = '<div class="info-kotak merah"><span class="ms">error</span><span>Skrip login Google gagal dimuat. Periksa koneksi atau pemblokir iklan, lalu muat ulang.</span></div>';
    });
  }
  function kredensialGoogle(resp) {
    tampilMasuk('verifikasi');
    API.post('auth.google', { k: S.kunci, credential: resp.credential, urlSitus: location.origin + location.pathname }).then(function (r) {
      if (r.ok) return terimaSesi(r.data);
      if (r.code === 'GATE') return keluarGerbang();
      if (r.code === 'DITOLAK') return tampilMasuk('ditolak', r.message);
      tampilMasuk('gagal', r.message);
    });
  }
  function terimaSesi(d) {
    S.token = d.token; S.exp = d.exp; S.me = d.me; simpanSesi();
    masukAplikasi();
  }
  function keluarGerbang() { try { sessionStorage.removeItem('adm_k'); sessionStorage.removeItem('adm_t'); } catch (x) {} location.replace('./'); }

  function mulai() {
    try { S.kunci = sessionStorage.getItem('adm_k') || ''; } catch (x) {}
    if (!S.kunci) return keluarGerbang();
    tampilMasuk('cek');
    API.post('auth.gerbang', { k: S.kunci, dev: API.devId() }).then(function (r) {
      if (!r.ok) {
        if (r.code === 'GATE' || r.code === 'LOCKED') return keluarGerbang();
        return tampilMasuk('gagal', r.message);
      }
      S.info = r.data || {};
      var t = null;
      try { t = JSON.parse(sessionStorage.getItem('adm_t') || 'null'); } catch (x) {}
      if (t && t.exp > Date.now() + 60000) {
        S.token = t.token; S.exp = t.exp; S.me = t.me;
        api('auth.me').then(function (x) { if (x.ok) masukAplikasi(); });
      } else tampilMasuk('siap');
    });
  }

  /* ---------- kerangka aplikasi ---------- */
  function masukAplikasi() {
    $('#layar-masuk').hidden = true; $('#aplikasi').hidden = false;
    var me = S.me || {};
    $('#tb-nama').textContent = me.darurat ? 'Akses Darurat' : (me.nama || 'Administrator');
    $('#tb-email').textContent = me.darurat ? 'mode darurat' : (me.email || '');
    $('#tb-avatar').innerHTML = me.foto && /^https:/.test(me.foto) ? '<img src="' + e(me.foto) + '" alt="" referrerpolicy="no-referrer">' : e(inisial(me.nama || 'A'));
    renderNav();
    clearInterval(S.timer); perbaruiTimer(); S.timer = setInterval(perbaruiTimer, 30000);
    if (!location.hash || location.hash.indexOf('#/') !== 0) location.hash = '#/beranda'; else rute();
    // pemanasan: 1 panggilan batch berisi data yang hampir pasti dibuka (gas-scale-turbo)
    api('batch', { calls: [{ action: 'konten.list' }, { action: 'profil.get' }, { action: 'pengaturan.get' }, { action: 'pesan.list', data: { status: 'baru', per: 5 } }, { action: 'testimoni.masuk' }] }).then(function (r) {
      if (!r.ok) return;
      var h = r.data.hasil;
      if (h[0].ok) {
        S.cache.konten = h[0].data;
        if (h[0].data._belumSetup) toast('Database belum diperbarui: buka editor Apps Script lalu jalankan setupAppEnvironment() sekali lagi agar menu ' + h[0].data._belumSetup.join(', ') + ' aktif.', 'info');
      }
      if (h[1].ok) S.cache.profil = h[1].data;
      if (h[2].ok) S.cache.pengaturan = h[2].data;
      if (h[3].ok) setLencanaPesan(h[3].data.ringkasan.baru);
      if (h[4] && h[4].ok) { S.cache.testiMasuk = h[4].data; setLencanaTesti(h[4].data.ringkasan.Menunggu || 0); }
    });
    if (me.darurat) toast('Anda masuk dengan akses darurat. Ganti sandinya & isi Google Client ID di Pengaturan → Keamanan.', 'info');
  }
  function setLencanaTesti(n) { S.testiMenunggu = n; var a = $('#sb-hitung-testi'); if (a) { a.textContent = n; a.hidden = !n; } }
  function setLencanaPesan(n) {
    S.pesanBaru = n;
    var a = $('#sb-hitung-pesan'); if (a) { a.textContent = n; a.hidden = !n; }
    var b = $('#nb-pesan'); if (b) { b.textContent = n; b.hidden = !n; }
  }
  function renderNav() {
    var h = '';
    GRUP.forEach(function (g) {
      var isi = g[1].filter(function (id) { return MODUL[id]; });
      if (!isi.length) return;
      h += '<div class="grup">' + e(g[0]) + '</div>';
      isi.forEach(function (id) { var m = MODUL[id]; h += '<a href="#/' + id + '" data-r="' + id + '"><span class="ms">' + m.ikon + '</span>' + e(m.judul) + (id === 'pesan' ? '<span class="hitung" id="sb-hitung-pesan" hidden>0</span>' : id === 'testimoni' ? '<span class="hitung" id="sb-hitung-testi" title="Menunggu persetujuan" hidden>0</span>' : '') + '</a>'; });
    });
    $('#sb-nav').innerHTML = h;
    $('#buka-lembar').onclick = function () { bukaLembar(GRUP[1][1], 'Semua Modul Konten'); };
    $('#buka-lainnya').onclick = function () { bukaLembar(GRUP[3][1].concat(GRUP[4][1]), 'Modul Lainnya', true); };
    $('#lembar-latar').onclick = function (ev) { if (ev.target.id === 'lembar-latar' || ev.target.closest('a')) $('#lembar-latar').classList.remove('buka'); };
    $$('[data-keluar]').forEach(function (a) { a.onclick = function (ev) { ev.preventDefault(); keluar(); }; });
  }
  function bukaLembar(ids, judul, denganKeluar) {
    var ket = { profil: 'Nama, headline, foto, tombol hero', tentang: 'Ringkasan, pengalaman, pendidikan', sertifikat: 'PDF privat, gambar publik', agenda: 'Kuliah, seminar, rapat', kinerja: 'Catatan kegiatan harian', wawasan: 'Artikel & insight', keahlian: 'Skill, kategori, level', portofolio: 'Proyek, gambar, urutan', testimoni: 'Ulasan & rating', kontak: 'Tautan kontak & sosial',
      tagihan: 'Klien, tagihan, verifikasi', notifikasi: 'WhatsApp, email, blast', crm: 'Kontak terpadu', pengaturan: 'Situs, tampilan, keamanan', migrasi: 'Impor dari Fajarfk', sistem: 'Kesehatan sistem' };
    $('#lembar-isi').innerHTML = '<h3 style="font-size:17px;padding:0 4px">' + e(judul) + '</h3><p style="color:var(--abu);font-size:13px;padding:0 4px 8px">Pilih modul yang ingin dikelola</p>' +
      ids.filter(function (id) { return MODUL[id]; }).map(function (id) { return '<a href="#/' + id + '"><span class="ikon"><span class="ms">' + MODUL[id].ikon + '</span></span><span style="flex:1"><b>' + e(MODUL[id].judul) + '</b><small>' + e(ket[id] || '') + '</small></span><span class="ms" style="color:var(--abu)">chevron_right</span></a>'; }).join('') +
      (denganKeluar ? '<a href="#/keluar" data-keluar><span class="ikon" style="background:var(--merah-muda);color:var(--merah)"><span class="ms">logout</span></span><span style="flex:1"><b>Keluar Akun</b><small>Akhiri sesi di perangkat ini</small></span></a>' : '');
    $$('#lembar-isi [data-keluar]').forEach(function (a) { a.onclick = function (ev) { ev.preventDefault(); keluar(); }; });
    $('#lembar-latar').classList.add('buka');
  }
  function keluar() {
    konfirmasi('Keluar dari dashboard?', 'Semua sesi admin Anda akan diakhiri. Anda perlu login ulang untuk masuk kembali.', 'Keluar', true).then(function (ya) {
      if (!ya) return;
      api('auth.keluar').then(function () { try { google.accounts.id.disableAutoSelect(); } catch (x) {} akhiriSesi('siap'); toast('Anda sudah keluar.'); });
    });
  }
  function hancurkanGrafik() { S.grafik.forEach(function (g) { try { g.destroy(); } catch (x) {} }); S.grafik = []; }
  function rute() {
    if (!S.token) return;
    var p = (location.hash || '').replace(/^#\//, '').split('/'), id = p[0] || 'beranda';
    if (id === 'keluar') { history.replaceState(null, '', '#/' + (S.rute || 'beranda')); return keluar(); }
    if (!MODUL[id]) id = 'beranda';
    S.rute = id;
    hancurkanGrafik();
    $$('#sb-nav a, #nav-bawah [data-r]').forEach(function (a) { a.classList.toggle('aktif', a.getAttribute('data-r') === id || (a.getAttribute('data-r') === 'konten' && GRUP[1][1].indexOf(id) > -1) || (a.getAttribute('data-r') === 'lainnya' && GRUP[3][1].concat(GRUP[4][1]).indexOf(id) > -1)); });
    $('#remah-judul').textContent = MODUL[id].judul;
    document.title = MODUL[id].judul + ' · Dashboard Admin';
    var isi = $('#isi');
    isi.innerHTML = '<div class="skeleton" style="height:64px;margin-bottom:20px"></div><div class="grid-kpi"><div class="skeleton" style="height:110px"></div><div class="skeleton" style="height:110px"></div><div class="skeleton" style="height:110px"></div><div class="skeleton" style="height:110px"></div></div><div class="skeleton" style="height:320px"></div>';
    window.scrollTo(0, 0);
    try { MODUL[id].render(isi, p.slice(1)); } catch (err) { console.error(err); isi.innerHTML = kosong('error', 'Modul gagal ditampilkan: ' + err.message); }
  }
  window.addEventListener('hashchange', rute);

  /* ---------- grafik (Chart.js dimuat saat dibutuhkan) ---------- */
  function grafik(kanvas, cfg) {
    return API.muatSkrip(API.LIB.chart).then(function () {
      if (!document.body.contains(kanvas)) return null;
      Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
      Chart.defaults.color = '#5B6472';
      var g = new Chart(kanvas, cfg); S.grafik.push(g); return g;
    }).catch(function () { kanvas.parentNode.innerHTML = kosong('bar_chart', 'Pustaka grafik gagal dimuat (periksa koneksi).'); });
  }
  function bolehEkspor(nama, lembar) {
    // lembar: [{nama, rows:[{...}]}]
    return API.muatSkrip(API.LIB.xlsx).then(function () {
      var wb = XLSX.utils.book_new();
      lembar.forEach(function (l) { XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(l.rows.length ? l.rows : [{ Info: 'Tidak ada data' }]), l.nama.substring(0, 31)); });
      XLSX.writeFile(wb, nama + '.xlsx');
    });
  }

  /* =====================================================================
   * MODUL: BERANDA (A1, UI-07)
   * ===================================================================== */
  MODUL.beranda = { judul: 'Beranda', ikon: 'dashboard', render: function (el) {
    var gambar = function (d) {
      var k = d.kpi;
      setLencanaPesan(k.pesanBaru); setLencanaTesti(k.testimoniMenunggu || 0);
      var puncak = d.seri.reduce(function (m, x) { return x.kunjungan > m.kunjungan ? x : m; }, { kunjungan: -1 });
      el.innerHTML = '<div class="kepala-hal"><div><h1>Ikhtisar Panel Kendali</h1><p>Selamat datang kembali, ' + e(d.namaAdmin || 'Admin') + ' · ' + e(hariIni(true)) + '</p></div><div class="aksi">' +
        '<button class="btn btn-garis" type="button" id="b-segar"><span class="ms">refresh</span>Segarkan</button><a class="btn btn-garis" href="#/profil"><span class="ms">manage_accounts</span>Ubah Profil</a><a class="btn btn-utama" href="#/portofolio/baru"><span class="ms">add</span>Tambah Proyek</a></div></div>' +
        '<div class="grid-kpi">' +
        '<div class="panel kpi"><div class="atas">Kunjungan (30 hari)<span class="ms">insights</span></div><b>' + angka(k.kunjungan) + '</b>' + ubahPersen(k.kunjunganUbah) + '</div>' +
        '<div class="panel kpi"><div class="atas">Klik Proyek<span class="ms">folder_open</span></div><b>' + angka(k.klikProyek) + '</b><small>Rasio klik ' + String(k.ctr).replace('.', ',') + '% dari kunjungan</small></div>' +
        '<div class="panel kpi"><div class="atas">Klik Kontak<span class="ms">forum</span></div><b>' + angka(k.klikKontak) + '</b>' + ubahPersen(k.klikKontakUbah) + '</div>' +
        '<a class="panel kpi sorot" href="#/pesan" style="text-decoration:none"><div class="atas">Pesan Baru<span class="ms">mark_email_unread</span></div><b>' + angka(k.pesanBaru) + '</b><small>' + (k.pesanBaru ? 'Perlu tindak lanjut →' : 'Semua sudah dibaca') + '</small></a></div>' +
        '<div class="grid-2" style="margin-bottom:20px"><section class="panel"><div class="panel-kepala"><div><h2><span class="ms">show_chart</span>Tren Kunjungan</h2><p>Kunjungan per hari — 30 hari terakhir' + (puncak.kunjungan > 0 ? ' · puncak ' + API.tgl(puncak.tanggal) + ': ' + puncak.kunjungan : '') + '</p></div><span class="lencana biru">Total ' + angka(k.kunjungan) + '</span></div><div class="grafik"><canvas id="g-tren" aria-label="Grafik kunjungan 30 hari"></canvas></div></section>' +
        '<section class="panel"><div class="panel-kepala"><div><h2><span class="ms">trending_up</span>Proyek Paling Banyak Diklik</h2><p>30 hari terakhir</p></div></div><div class="daftar-peringkat">' +
        (d.topProyek.length ? d.topProyek.map(function (p, i) { var max = d.topProyek[0].klik || 1; return '<div class="peringkat"><span class="no">' + (i + 1) + '</span><span class="nm"><b>' + e(p.judul) + '</b><span class="bilah"><i style="width:' + Math.round(p.klik / max * 100) + '%"></i></span></span><span class="n">' + angka(p.klik) + ' klik</span></div>'; }).join('') : kosong('ads_click', 'Belum ada klik proyek.')) +
        '</div></section></div>' +
        '<div class="grid-2"><section class="panel"><div class="panel-kepala"><div><h2><span class="ms">inbox</span>Pesan Terbaru</h2><p>Menampilkan ' + d.pesanTerbaru.length + ' dari ' + angka(k.pesanTotal) + ' pesan</p></div><a class="btn btn-teks" href="#/pesan">Lihat semua<span class="ms">arrow_forward</span></a></div>' +
        (d.pesanTerbaru.length ? '<div class="daftar-item">' + d.pesanTerbaru.map(function (m) { return '<a class="item" href="#/pesan/' + e(m.id) + '" style="text-decoration:none"><span class="avatar" style="width:40px;height:40px;border-radius:50%;background:var(--navy);color:var(--kuning);display:grid;place-items:center;font-weight:800;font-size:13px;flex-shrink:0">' + e(inisial(m.nama)) + '</span><span class="badan"><b>' + e(m.nama) + '</b><small>' + e(m.cuplikan) + '</small></span><span class="ujung" style="flex-direction:column;align-items:flex-end">' + lencana(m.status) + '<small style="color:var(--abu);font-size:12px">' + e(API.relatif(m.timestamp)) + '</small></span></a>'; }).join('') + '</div>' : kosong('mail', 'Belum ada pesan masuk.')) +
        '</section><section class="panel"><div class="panel-kepala"><div><h2><span class="ms">dns</span>Status Situs &amp; Sistem</h2></div>' + lencana(d.sistem.statusSitus) + '</div>' +
        '<div class="status-baris"><span><span class="ms">sync</span>Konten diperbarui</span><b>' + e(d.sistem.kontenDiperbarui ? API.relatif(d.sistem.kontenDiperbarui) : '–') + '</b></div>' +
        '<div class="status-baris"><span><span class="ms">table_chart</span>Database Google Sheets</span><span class="lencana hijau">Terhubung</span></div>' +
        '<div class="status-baris"><span><span class="ms">notifications</span>Antrean notifikasi</span>' + (d.sistem.antreanNotif ? '<span class="lencana kuning">Ada antrean</span>' : '<span class="lencana hijau">Kosong</span>') + '</div>' +
        (k.tagihanMenunggu ? '<div class="status-baris"><span><span class="ms">receipt_long</span>Bukti bayar menunggu</span><a class="lencana kuning" href="#/tagihan/verifikasi">' + k.tagihanMenunggu + ' bukti</a></div>' : '') +
        (k.testimoniMenunggu ? '<div class="status-baris"><span><span class="ms">rate_review</span>Testimoni menunggu persetujuan</span><a class="lencana kuning" href="#/testimoni">' + k.testimoniMenunggu + ' testimoni</a></div>' : '') +
        '<div class="status-baris"><span><span class="ms">public</span>Situs publik</span>' + (d.sistem.urlSitus ? '<a href="' + e(API.urlAman(d.sistem.urlSitus)) + '" target="_blank" rel="noopener" style="font-size:13px">Buka ↗</a>' : '<span>–</span>') + '</div>' +
        '<p style="font-size:12px;color:var(--abu);margin-top:10px">Data diperbarui ' + e(API.relatif(d.dibuat)) + ' · versi ' + e(d.sistem.versi) + '</p></section></div>';
      $('#b-segar').onclick = function () { sibuk(this, true); muat(true); };
      grafik($('#g-tren'), { type: 'line', data: { labels: d.seri.map(function (x) { return API.tgl(x.tanggal).replace(/ \d{4}$/, ''); }), datasets: [{ label: 'Kunjungan', data: d.seri.map(function (x) { return x.kunjungan; }), borderColor: '#2563EB', backgroundColor: 'rgba(37,99,235,.10)', fill: true, tension: .35, pointRadius: 0, pointHoverRadius: 5, borderWidth: 2.5 }] },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, interaction: { intersect: false, mode: 'index' }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#EEF1F6' } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 7 } } } } });
    };
    var muat = function (segar) {
      api('adm.beranda', segar ? { _fresh: true } : {}).then(function (r) {
        if (S.rute !== 'beranda') return;
        if (!r.ok) { el.innerHTML = kosong('error', r.message); return; }
        S.cache.beranda = r.data; hancurkanGrafik(); gambar(r.data);
      });
    };
    if (S.cache.beranda) gambar(S.cache.beranda);
    muat(false);
  } };

  /* =====================================================================
   * MODUL: PROFIL (A2, UI-08) — dengan pratinjau hero langsung
   * ===================================================================== */
  function ambilProfil() {
    if (S.cache.profil) return Promise.resolve(S.cache.profil);
    return api('profil.get').then(function (r) { if (r.ok) S.cache.profil = r.data; return r.ok ? r.data : Promise.reject(new Error(r.message)); });
  }
  MODUL.profil = { judul: 'Profil', ikon: 'badge', render: function (el) {
    ambilProfil().then(function (p) {
      el.innerHTML = '<div class="kepala-hal"><div><h1>Profil &amp; Identitas Diri</h1><p>Kelola narasi pembuka, foto, dan teks yang tampil di bagian Hero landing page.</p></div><div class="aksi"><span class="lencana abu"><span class="ms" style="font-size:14px">sync</span>Diperbarui ' + e(p.diperbarui ? API.relatif(p.diperbarui) : '–') + '</span></div></div>' +
        '<div class="grid-2 lebar-kiri"><form class="panel" id="f-profil" novalidate>' +
        '<div class="bagian-form" style="border:0;padding-top:0"><h3><span class="ms">account_circle</span>1. Foto Profil</h3><div class="unggah-foto"><span class="pratinjau" id="pv-foto"></span><div style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;gap:8px;flex-wrap:wrap"><label class="btn btn-utama btn-kecil"><span class="ms">upload_file</span>Unggah Foto<input type="file" accept="image/jpeg,image/png,image/webp" id="in-foto" class="sr-only"></label><button class="btn btn-garis btn-kecil" type="button" id="hapus-foto"><span class="ms">delete</span>Hapus</button></div><span class="bantu" style="font-size:12.5px;color:var(--abu)">JPG, PNG, atau WebP. Dikompres otomatis di browser, maks. 2 MB.</span></div></div><input type="hidden" name="url_foto"></div>' +
        '<div class="bagian-form"><h3><span class="ms">badge</span>2. Identitas &amp; Narasi Hero</h3><div class="grid-form">' +
        bidang({ k: 'nama_lengkap', label: 'Nama lengkap', nilai: p.nama_lengkap, wajib: true, maks: 100 }) + bidang({ k: 'profesi', label: 'Profesi / jabatan', nilai: p.profesi, wajib: true, maks: 80 }) +
        bidang({ k: 'headline', label: 'Headline utama (H1)', nilai: p.headline, wajib: true, maks: 120, penuh: true }) +
        bidang({ k: 'kata_aksen', label: 'Kata aksen pada headline', nilai: p.kata_aksen, maks: 40, penuh: true, bantu: 'Ditulis dengan huruf tulisan tangan (Caveat) bergaris bawah kuning. Harus muncul persis di headline.' }) +
        bidang({ k: 'deskripsi_singkat', label: 'Deskripsi singkat', nilai: p.deskripsi_singkat, tipe: 'textarea', maks: 300, penuh: true, bantu: '<span id="hit-desk">0</span>/300 · disarankan 120–180 karakter' }) + '</div></div>' +
        '<div class="bagian-form"><h3><span class="ms">smart_button</span>3. Tombol &amp; Badge</h3><div class="grid-form">' +
        bidang({ k: 'teks_tombol_1', label: 'Teks tombol utama', nilai: p.teks_tombol_1, maks: 30, placeholder: 'Lihat Portofolio' }) + bidang({ k: 'teks_tombol_2', label: 'Teks tombol kedua', nilai: p.teks_tombol_2, maks: 30, placeholder: 'Tentang Saya' }) +
        bidang({ k: 'tahun_pengalaman', label: 'Tahun pengalaman (badge kuning)', nilai: p.tahun_pengalaman, tipe: 'number', atribut: ' min="0" max="60"' }) + '</div></div>' +
        '<div class="bagian-form"><h3><span class="ms">play_circle</span>4. Media Tambahan</h3><div class="grid-form">' +
        bidang({ k: 'url_video_intro', label: 'URL video perkenalan (opsional)', nilai: p.url_video_intro, penuh: true, placeholder: 'https://youtu.be/…', bantu: 'YouTube atau Google Drive. Bila diisi, tombol "Video Perkenalan" muncul di hero.' }) +
        '<div class="bidang penuh"><label for="in-cv-url">CV / Resume (PDF, opsional)</label><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="in-cv-url" name="url_cv" value="' + e(p.url_cv) + '" placeholder="https://drive.google.com/file/d/…" style="flex:1;min-width:200px"><label class="btn btn-garis btn-kecil" style="min-height:46px"><span class="ms">upload</span>Unggah PDF<input type="file" accept="application/pdf" id="in-cv" class="sr-only"></label></div><span class="galat"></span></div></div></div>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;flex-wrap:wrap"><a class="btn btn-garis" href="./" target="_blank" rel="noopener"><span class="ms">visibility</span>Lihat di situs</a><button class="btn btn-utama" type="submit"><span class="ms">save</span>Simpan Profil</button></div></form>' +
        '<aside><div class="panel" style="position:sticky;top:84px"><div class="panel-kepala"><div><h2><span class="ms">preview</span>Pratinjau Hero</h2><p>Berubah otomatis saat Anda mengetik.</p></div></div><div class="pratinjau-hero"><div class="bar"><i style="background:#FF6B6B"></i><i style="background:#FFC300"></i><i style="background:#3DD68C"></i><span style="margin-left:6px">landing page</span></div><div class="isi-hero"><div><span class="eyebrow" id="pv-profesi" style="font-size:10px"></span><h3 id="pv-headline" style="margin:8px 0"></h3><p id="pv-desk" style="font-size:12.5px;color:var(--abu-2)"></p><div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap"><span class="btn btn-utama btn-kecil" id="pv-t1" style="min-height:30px;font-size:12px"></span><span class="btn btn-garis btn-kecil" id="pv-t2" style="min-height:30px;font-size:12px"></span></div></div><div style="position:relative"><div class="foto" id="pv-foto2"></div><span class="lencana kuning" id="pv-th" style="position:absolute;left:-8px;bottom:-8px"></span></div></div></div></div></aside></div>';
      var f = $('#f-profil');
      f.elements.url_foto.value = p.url_foto || '';
      var pv = function () {
        var v = ambil(f), h = v.headline || '', a = (v.kata_aksen || '').trim(), i = a ? h.toLowerCase().indexOf(a.toLowerCase()) : -1;
        $('#pv-profesi').textContent = v.profesi;
        $('#pv-headline').innerHTML = i > -1 ? e(h.slice(0, i)) + '<span class="aksen">' + e(h.substr(i, a.length)) + '</span>' + e(h.slice(i + a.length)) : e(h);
        $('#pv-desk').textContent = v.deskripsi_singkat; $('#hit-desk').textContent = (v.deskripsi_singkat || '').length;
        $('#pv-t1').textContent = v.teks_tombol_1 || 'Lihat Portofolio'; $('#pv-t2').textContent = v.teks_tombol_2 || 'Tentang Saya';
        $('#pv-th').textContent = v.tahun_pengalaman ? v.tahun_pengalaman + '+ Tahun' : ''; $('#pv-th').hidden = !v.tahun_pengalaman;
        var foto = v.url_foto ? '<img src="' + e(v.url_foto) + '" alt="" referrerpolicy="no-referrer">' : '<span class="ms" style="font-size:40px">photo_camera</span>';
        $('#pv-foto').innerHTML = foto; $('#pv-foto2').innerHTML = v.url_foto ? foto : e(inisial(v.nama_lengkap));
        var bA = f.elements.kata_aksen.closest('.bidang');
        if (a && i < 0) { bA.classList.add('salah'); $('.galat', bA).textContent = 'Kata aksen tidak ditemukan di headline'; } else if (bA.classList.contains('salah') && (!a || i > -1)) bA.classList.remove('salah');
      };
      f.addEventListener('input', pv); pv();
      $('#in-foto').onchange = function () {
        var fl = this.files[0]; if (!fl) return;
        var lbl = this.closest('label'); lbl.classList.add('btn-kecil'); toast('Mengompres & mengunggah foto…', 'info');
        API.kompresGambar(fl, 1000, .86).then(function (b) {
          if (b.ukuran > 2 * 1024 * 1024) throw new Error('Foto masih ' + (b.ukuran / 1048576).toFixed(1) + ' MB setelah dikompres. Batas 2 MB.');
          return api('berkas.unggah', { jenis: 'foto', berkas: { nama: b.nama, mime: b.mime, b64: b.b64 } }, { timeout: 90000 });
        }).then(function (r) { if (!r.ok) throw new Error(r.message); f.elements.url_foto.value = r.data.url; pv(); toast('Foto terunggah. Klik Simpan Profil untuk menerapkan.'); })
          .catch(function (x) { toast(x.message, 'galat'); });
        this.value = '';
      };
      $('#hapus-foto').onclick = function () { f.elements.url_foto.value = ''; pv(); };
      $('#in-cv').onchange = function () {
        var fl = this.files[0]; if (!fl) return;
        if (fl.size > 2 * 1024 * 1024) { toast('Ukuran PDF ' + (fl.size / 1048576).toFixed(1) + ' MB melebihi batas 2 MB.', 'galat'); this.value = ''; return; }
        toast('Mengunggah CV…', 'info');
        API.kompresGambar(fl).then(function (b) { return api('berkas.unggah', { jenis: 'cv', berkas: { nama: b.nama, mime: b.mime, b64: b.b64 } }, { timeout: 90000 }); })
          .then(function (r) { if (!r.ok) throw new Error(r.message); f.elements.url_cv.value = r.data.url; toast('CV terunggah. Klik Simpan Profil.'); }).catch(function (x) { toast(x.message, 'galat'); });
        this.value = '';
      };
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var b = $('button[type=submit]', f), data = Object.assign({}, S.cache.profil || {}, ambil(f));
        sibuk(b, true, 'Menyimpan…');
        api('profil.simpan', data).then(function (r) {
          sibuk(b, false);
          if (!r.ok) { tandaiGalat(f, r.data && r.data.galat); return toast(r.message, 'galat'); }
          S.cache.profil = Object.assign({}, S.cache.profil, r.data); delete S.cache.beranda;
          toast(r.message);
        });
      });
    }).catch(function (x) { el.innerHTML = kosong('error', x.message); });
  } };

  /* =====================================================================
   * MODUL: CRUD KONTEN (A3–A7: Tentang, Keahlian, Portofolio, Testimoni, Kontak)
   * ===================================================================== */
  function ambilKonten(paksa) {
    if (S.cache.konten && !paksa) return Promise.resolve(S.cache.konten);
    return api('konten.list').then(function (r) { if (!r.ok) return Promise.reject(new Error(r.message)); S.cache.konten = r.data; return r.data; });
  }
  var JENIS_TENTANG = [['pengalaman', 'Pengalaman', 'work_history'], ['pendidikan', 'Pendidikan', 'school'], ['minat', 'Minat & Fokus', 'interests'], ['tujuan_karier', 'Tujuan Karier', 'target']];
  var IKON_SARAN = ['code', 'terminal', 'web', 'database', 'analytics', 'dashboard', 'design_services', 'traffic', 'directions_bus', 'sailing', 'flight', 'description', 'gavel', 'groups', 'school', 'psychology', 'campaign', 'mail', 'chat', 'work', 'link', 'photo_camera', 'smart_display', 'public', 'call'];

  var KONTEN = {
    tentang: { tabel: 'Tentang', judul: 'Tentang Saya', ikon: 'info', tunggal: 'entri' },
    keahlian: { tabel: 'Keahlian', judul: 'Keahlian', ikon: 'psychology', tunggal: 'keahlian' },
    portofolio: { tabel: 'Portofolio', judul: 'Portofolio', ikon: 'folder_special', tunggal: 'proyek' },
    testimoni: { tabel: 'Testimoni', judul: 'Testimoni', ikon: 'format_quote', tunggal: 'testimoni' },
    kontak: { tabel: 'Kontak', judul: 'Kontak & Sosial', ikon: 'share', tunggal: 'tautan' }
  };
  function formKonten(kunci, x, jenisAwal) {
    var c = KONTEN[kunci], rows = (S.cache.konten || {})[c.tabel] || [];
    var kat = function (k) { var s = {}; rows.forEach(function (r) { if (r[k]) s[r[k]] = 1; }); return Object.keys(s); };
    var dl = function (id, list) { return '<datalist id="' + id + '">' + list.map(function (v) { return '<option value="' + e(v) + '">'; }).join('') + '</datalist>'; };
    var tampil = c.tabel !== 'Tentang' ? bidang({ k: 'tampil', label: 'Tampilkan di landing page', tipe: 'saklar', nilai: x.tampil === undefined ? true : x.tampil, penuh: true }) : '';
    if (kunci === 'tentang') {
      var j = x.jenis || jenisAwal || 'pengalaman';
      return '<div class="grid-form">' + bidang({ k: 'jenis', label: 'Jenis', tipe: 'select', nilai: j, opsi: JENIS_TENTANG.map(function (a) { return [a[0], a[1]]; }), penuh: true }) +
        (j === 'tujuan_karier' ? bidang({ k: 'deskripsi', label: 'Tujuan karier', tipe: 'textarea', nilai: x.deskripsi, wajib: true, maks: 1000, penuh: true }) :
         j === 'minat' ? bidang({ k: 'judul', label: 'Nama minat / fokus', nilai: x.judul, wajib: true, maks: 40, penuh: true, placeholder: 'mis. Transportasi Cerdas' }) :
         bidang({ k: 'judul', label: j === 'pendidikan' ? 'Jenjang / gelar' : 'Jabatan / posisi', nilai: x.judul, wajib: true, maks: 150, penuh: true }) +
         bidang({ k: 'instansi', label: j === 'pendidikan' ? 'Institusi' : 'Instansi / perusahaan', nilai: x.instansi, maks: 150 }) +
         bidang({ k: 'periode', label: 'Periode', nilai: x.periode, maks: 50, placeholder: j === 'pendidikan' ? '2013 – 2017' : 'Jan 2024 – Sekarang', bantu: 'Tulis "Sekarang" agar diberi penanda aktif.' }) +
         bidang({ k: 'deskripsi', label: 'Deskripsi (opsional)', tipe: 'textarea', nilai: x.deskripsi, maks: 1000, penuh: true })) + '</div>';
    }
    if (kunci === 'keahlian') return '<div class="grid-form">' + bidang({ k: 'nama_skill', label: 'Nama keahlian', nilai: x.nama_skill, wajib: true, maks: 60 }) +
      bidang({ k: 'kategori', label: 'Kategori', nilai: x.kategori, wajib: true, maks: 60, atribut: ' list="dl-kat"', bantu: 'Keahlian dikelompokkan per kategori di landing page.' }) + dl('dl-kat', kat('kategori')) +
      '<div class="bidang penuh"><label for="lv">Tingkat kemahiran: <b id="lv-n">' + (x.level || 80) + '</b>%</label><input id="lv" type="range" name="level" min="0" max="100" step="1" value="' + e(x.level === undefined || x.level === '' ? 80 : x.level) + '" oninput="document.getElementById(\'lv-n\').textContent=this.value"><span class="galat"></span></div>' +
      bidang({ k: 'ikon', label: 'Ikon (Material Symbols)', nilai: x.ikon, maks: 40, atribut: ' list="dl-ikon"', bantu: 'Nama ikon dari fonts.google.com/icons, mis. code, traffic.' }) + dl('dl-ikon', IKON_SARAN) +
      '<div class="bidang"><span class="label">Pratinjau ikon</span><span class="kotak-ikon" id="pv-ikon" style="width:46px;height:46px;border-radius:12px;background:#E5EEFF;color:var(--utama);display:grid;place-items:center"><span class="ms">' + e(x.ikon || 'bolt') + '</span></span></div>' + tampil + '</div>';
    if (kunci === 'portofolio') return '<div class="grid-form"><div class="bidang penuh"><span class="label">Gambar proyek (rasio 16:10 disarankan)</span><div class="unggah-foto lebar"><span class="pratinjau" id="pv-gbr">' + (x.url_gambar ? '<img src="' + e(x.url_gambar) + '" alt="" referrerpolicy="no-referrer">' : '<span class="ms">image</span>') + '</span><div style="display:flex;flex-direction:column;gap:8px"><label class="btn btn-garis btn-kecil"><span class="ms">upload_file</span>Pilih Gambar<input type="file" accept="image/jpeg,image/png,image/webp" id="in-gbr" class="sr-only"></label><small style="color:var(--abu)" id="ket-gbr">Dikompres otomatis, maks. 2 MB.</small></div></div><input type="hidden" name="url_gambar" value="' + e(x.url_gambar) + '"><span class="galat"></span></div>' +
      bidang({ k: 'judul', label: 'Judul proyek', nilai: x.judul, wajib: true, maks: 100 }) + bidang({ k: 'kategori', label: 'Kategori', nilai: x.kategori, wajib: true, maks: 50, atribut: ' list="dl-kat"' }) + dl('dl-kat', kat('kategori')) +
      bidang({ k: 'deskripsi_singkat', label: 'Deskripsi singkat', tipe: 'textarea', nilai: x.deskripsi_singkat, maks: 300, penuh: true, baris: 4 }) +
      bidang({ k: 'teknologi', label: 'Teknologi (pisahkan dengan koma)', nilai: x.teknologi, maks: 200, placeholder: 'Google Apps Script, Sheets' }) + bidang({ k: 'tahun', label: 'Tahun', nilai: x.tahun, maks: 4, placeholder: '2026', atribut: ' inputmode="numeric"' }) +
      bidang({ k: 'url_tautan', label: 'Tautan proyek', nilai: x.url_tautan, penuh: true, placeholder: 'https://…', bantu: 'Wajib berawalan https://. Klik tombol panah tercatat di statistik.' }) + tampil + '</div>';
    if (kunci === 'testimoni') {
      var r = Number(x.rating) || 5, bt = '';
      for (var n = 1; n <= 5; n++) bt += '<label style="cursor:pointer"><input type="radio" name="rating" value="' + n + '" class="sr-only"' + (n === r ? ' checked' : '') + '><span class="ms isi" data-bintang="' + n + '" style="font-size:30px;color:' + (n <= r ? 'var(--kuning-redup)' : '#C3C6D7') + '">star</span></label>';
      return '<div class="grid-form">' + bidang({ k: 'nama', label: 'Nama pemberi ulasan', nilai: x.nama, wajib: true, maks: 80 }) + bidang({ k: 'jabatan_instansi', label: 'Jabatan / instansi', nilai: x.jabatan_instansi, maks: 120 }) +
        '<div class="bidang penuh"><span class="label">Rating</span><div role="radiogroup" aria-label="Rating" id="rg-bintang" style="display:flex;gap:2px">' + bt + '</div><span class="galat"></span></div>' +
        bidang({ k: 'isi', label: 'Isi testimoni', tipe: 'textarea', nilai: x.isi, wajib: true, maks: 500, penuh: true }) +
        '<div class="bidang penuh"><span class="label">Foto (opsional)</span><div class="unggah-foto"><span class="pratinjau" id="pv-gbr" style="width:64px;height:64px;border-radius:50%">' + (x.url_foto ? '<img src="' + e(x.url_foto) + '" alt="" referrerpolicy="no-referrer">' : '<span class="ms">person</span>') + '</span><label class="btn btn-garis btn-kecil"><span class="ms">upload_file</span>Pilih Foto<input type="file" accept="image/jpeg,image/png,image/webp" id="in-gbr" class="sr-only"></label></div><input type="hidden" name="url_foto" value="' + e(x.url_foto) + '"><span class="galat"></span></div>' + tampil + '</div>';
    }
    if (kunci === 'kontak') return '<div class="grid-form">' + bidang({ k: 'label', label: 'Label', nilai: x.label, wajib: true, maks: 50, placeholder: 'mis. LinkedIn' }) +
      bidang({ k: 'ikon', label: 'Ikon', nilai: x.ikon, maks: 40, atribut: ' list="dl-ikon"', placeholder: 'mail / work / chat / code' }) + dl('dl-ikon', IKON_SARAN) +
      bidang({ k: 'url', label: 'Tautan', nilai: x.url, wajib: true, penuh: true, placeholder: 'https://… , mailto:… , atau tel:…', bantu: 'Bantu isi: <button type="button" class="btn btn-teks" data-isi="mailto:">Email</button><button type="button" class="btn btn-teks" data-isi="https://wa.me/62">WhatsApp</button><button type="button" class="btn btn-teks" data-isi="https://www.linkedin.com/in/">LinkedIn</button><button type="button" class="btn btn-teks" data-isi="https://github.com/">GitHub</button>' }) + tampil + '</div>';
    return '';
  }
  function bukaFormKonten(kunci, x, jenisAwal, selesai) {
    var c = KONTEN[kunci], baru = !x.id, berkas = null;
    var m = modal({ judul: (baru ? 'Tambah ' : 'Ubah ') + c.tunggal, isi: '<form id="f-konten" novalidate>' + formKonten(kunci, x, jenisAwal) + '</form>', lebar: kunci === 'portofolio',
      tombol: [{ teks: 'Batal' }, { teks: '<span class="ms">save</span>' + (baru ? 'Tambahkan' : 'Simpan'), kelas: 'btn-utama', aksi: function (mm) {
        var f = $('#f-konten', mm.isi), data = ambil(f);
        if (x.id) data.id = x.id;
        if (kunci === 'tentang' && data.jenis === 'minat') { data.instansi = ''; data.periode = ''; }
        var kirim = { tabel: c.tabel, data: data };
        if (berkas) kirim.berkas = berkas;
        return api('konten.simpan', kirim, { timeout: 90000 }).then(function (r) {
          if (!r.ok) { tandaiGalat(f, r.data && r.data.galat); toast(r.message, 'galat'); return false; }
          var list = S.cache.konten[c.tabel], i = list.findIndex(function (z) { return z.id === r.data.id; });
          if (i > -1) list[i] = r.data; else list.push(r.data);
          toast(r.message); delete S.cache.beranda; if (selesai) selesai();
        });
      } }] });
    var f = $('#f-konten', m.isi);
    var bukaUlang = function () {
      var jn = $('[name=jenis]', f);
      if (jn) jn.addEventListener('change', function () { var v = ambil(f); f.innerHTML = formKonten('tentang', Object.assign({}, x, v)); bukaUlang(); });
      var ik = $('[name=ikon]', f), pv = $('#pv-ikon', f);
      if (ik && pv) ik.addEventListener('input', function () { $('.ms', pv).textContent = ik.value || 'bolt'; });
      $$('[data-isi]', f).forEach(function (b) { b.onclick = function () { var u = $('[name=url]', f); u.value = b.getAttribute('data-isi'); u.focus(); }; });
      $$('#rg-bintang input', f).forEach(function (r) { r.onchange = function () { $$('[data-bintang]', f).forEach(function (s) { s.style.color = Number(s.getAttribute('data-bintang')) <= Number(r.value) ? 'var(--kuning-redup)' : '#C3C6D7'; }); }; });
      var ig = $('#in-gbr', f);
      if (ig) ig.onchange = function () {
        var fl = ig.files[0]; if (!fl) return;
        API.kompresGambar(fl, kunci === 'testimoni' ? 400 : 1600, .84).then(function (b) {
          if (b.ukuran > 2 * 1024 * 1024) throw new Error('Gambar ' + (b.ukuran / 1048576).toFixed(1) + ' MB melebihi batas 2 MB setelah dikompres.');
          berkas = { nama: b.nama, mime: b.mime, b64: b.b64 };
          $('#pv-gbr', f).innerHTML = '<img src="data:' + b.mime + ';base64,' + b.b64 + '" alt="">';
          if ($('#ket-gbr', f)) $('#ket-gbr', f).textContent = fl.name + ' · ' + Math.round(b.ukuran / 1024) + ' KB (diunggah saat disimpan)';
        }).catch(function (z) { berkas = null; toast(z.message, 'galat'); });
      };
    };
    bukaUlang();
  }
  function itemKonten(kunci, r) {
    var c = KONTEN[kunci], sembunyi = c.tabel !== 'Tentang' && r.tampil !== 'Ya', g = '', judul = '', sub = '', ekstra = '';
    if (kunci === 'tentang') { judul = r.judul || (r.deskripsi || '').substring(0, 80); sub = [r.instansi, r.periode].filter(Boolean).join(' · ') || (r.jenis === 'tujuan_karier' ? 'Tujuan karier' : ''); g = '<span class="gambar" style="width:44px;height:44px"><span class="ms">' + (JENIS_TENTANG.filter(function (j) { return j[0] === r.jenis; })[0] || [0, 0, 'info'])[2] + '</span></span>'; if (/sekarang/i.test(r.periode || '')) ekstra = '<span class="lencana kuning">Aktif</span>'; }
    if (kunci === 'keahlian') { judul = r.nama_skill; sub = r.kategori; g = '<span class="gambar" style="width:44px;height:44px"><span class="ms">' + e(r.ikon || 'bolt') + '</span></span>'; ekstra = '<span class="lencana biru">' + e(r.level) + '%</span>'; }
    if (kunci === 'portofolio') { judul = r.judul; sub = [r.kategori, r.tahun, r.teknologi].filter(Boolean).join(' · '); g = '<span class="gambar">' + (r.url_gambar ? '<img src="' + e(r.url_gambar) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="ms">image</span>') + '</span>'; }
    if (kunci === 'testimoni') { judul = r.nama + ' · ' + '★'.repeat(Number(r.rating) || 0); sub = '“' + r.isi + '”'; g = '<span class="gambar" style="width:44px;height:44px;border-radius:50%;background:var(--navy);color:var(--kuning);font-weight:800">' + (r.url_foto ? '<img src="' + e(r.url_foto) + '" alt="" referrerpolicy="no-referrer">' : e(inisial(r.nama))) + '</span>'; }
    if (kunci === 'kontak') { judul = r.label; sub = r.url; g = '<span class="gambar" style="width:44px;height:44px"><span class="ms">' + e(r.ikon || 'link') + '</span></span>'; }
    return '<div class="item' + (sembunyi ? ' tersembunyi' : '') + '" data-id="' + e(r.id) + '"><span class="ms pegang" title="Seret untuk mengurutkan" aria-hidden="true">drag_indicator</span>' + g +
      '<span class="badan"><b>' + e(judul) + '</b><small>' + e(sub) + '</small></span><span class="ujung">' + ekstra +
      (c.tabel !== 'Tentang' ? '<label class="saklar" title="Tampil di landing page"><input type="checkbox" data-tampil' + (sembunyi ? '' : ' checked') + ' aria-label="Tampilkan ' + e(judul) + '"><span></span></label>' : '') +
      '<button class="btn btn-ikon mini" type="button" data-geser="naik" aria-label="Pindah ke atas"><span class="ms">arrow_upward</span></button><button class="btn btn-ikon mini" type="button" data-geser="turun" aria-label="Pindah ke bawah"><span class="ms">arrow_downward</span></button>' +
      (kunci === 'portofolio' && r.url_tautan ? '<a class="btn btn-ikon mini" href="' + e(API.urlAman(r.url_tautan)) + '" target="_blank" rel="noopener" aria-label="Buka tautan"><span class="ms">open_in_new</span></a>' : '') +
      '<button class="btn btn-ikon mini" type="button" data-ubah aria-label="Ubah"><span class="ms">edit</span></button><button class="btn btn-ikon mini merah" type="button" data-hapus aria-label="Hapus"><span class="ms">delete</span></button></span></div>';
  }
  function modulKonten(kunci) {
    var c = KONTEN[kunci];
    return { judul: c.judul, ikon: c.ikon, render: function (el, param) {
      var filter = { cari: '', kat: '', status: '', jenis: 'pengalaman' };
      var gambar = function () {
        var semua = S.cache.konten[c.tabel] || [], rows = semua.slice();
        var tampilN = semua.filter(function (r) { return r.tampil === 'Ya'; }).length;
        var kepala = '<div class="kepala-hal"><div><h1>' + e(c.judul) + '</h1><p>' + e({
          tentang: 'Kelola ringkasan diri, riwayat pengalaman, pendidikan, minat, dan tujuan karier.', keahlian: 'Atur daftar keahlian, tingkat kemahiran, dan kategori yang tampil di publik.',
          portofolio: semua.length + ' proyek terdaftar (' + tampilN + ' tampil, ' + (semua.length - tampilN) + ' disembunyikan).', testimoni: 'Ulasan dari rekan kerja dan klien. Bagian Testimoni di situs hanya tampil bila ada minimal 1 testimoni aktif.',
          kontak: 'Tautan kontak & media sosial untuk bagian Kontak, info bar, dan footer.' }[kunci]) + '</p></div><div class="aksi"><a class="btn btn-garis" href="./#' + ({ tentang: 'about', keahlian: 'skills', portofolio: 'portfolio', testimoni: 'testimoni', kontak: 'contact' }[kunci]) + '" target="_blank" rel="noopener"><span class="ms">visibility</span>Pratinjau</a><button class="btn btn-utama" type="button" id="b-tambah"><span class="ms">add</span>Tambah ' + e(c.tunggal) + '</button></div></div>';
        var atas = '';
        if (kunci === 'tentang') {
          var hitung = {}; semua.forEach(function (r) { hitung[r.jenis] = (hitung[r.jenis] || 0) + 1; });
          var p = S.cache.profil || {};
          atas = '<section class="panel" style="margin-bottom:20px"><div class="panel-kepala"><div><h2><span class="ms">format_quote</span>Ringkasan Diri</h2><p>Paragraf utama di bagian "Tentang Saya". Pisahkan paragraf dengan baris kosong.</p></div></div><form id="f-ringkas">' +
            bidang({ k: 'ringkasan_tentang', label: 'Ringkasan', tipe: 'textarea', nilai: p.ringkasan_tentang, maks: 1500, baris: 6, bantu: '<span id="hit-r">' + String(p.ringkasan_tentang || '').length + '</span>/1.500 karakter' }) +
            '<div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn btn-utama btn-kecil" type="submit"><span class="ms">save</span>Simpan Ringkasan</button></div></form></section>' +
            '<div class="tab" role="tablist">' + JENIS_TENTANG.map(function (j) { return '<button type="button" role="tab" data-jenis="' + j[0] + '" aria-selected="' + (filter.jenis === j[0]) + '"><span class="ms" style="font-size:18px">' + j[2] + '</span>' + e(j[1]) + '<span class="jumlah">' + (hitung[j[0]] || 0) + '</span></button>'; }).join('') + '</div>';
          rows = rows.filter(function (r) { return r.jenis === filter.jenis; });
        } else {
          var kats = {}; semua.forEach(function (r) { var k = r.kategori; if (k) kats[k] = 1; });
          if (kunci === 'keahlian') {
            var rata = semua.length ? Math.round(semua.reduce(function (s, r) { return s + Number(r.level || 0); }, 0) / semua.length) : 0;
            atas = '<div class="grid-kpi"><div class="panel kpi"><div class="atas">Total keahlian<span class="ms">psychology</span></div><b>' + semua.length + '</b><small>' + Object.keys(kats).length + ' kategori</small></div><div class="panel kpi"><div class="atas">Tampil<span class="ms">visibility</span></div><b>' + tampilN + '</b><small>' + (semua.length - tampilN) + ' disembunyikan</small></div><div class="panel kpi"><div class="atas">Rata-rata kemahiran<span class="ms">trending_up</span></div><b>' + rata + '%</b><small>dari semua keahlian</small></div></div>';
          }
          if (kunci === 'testimoni') {
            var rr = semua.length ? (semua.reduce(function (s, r) { return s + Number(r.rating || 0); }, 0) / semua.length).toFixed(1).replace('.', ',') : '0';
            var tm = S.cache.testiMasuk && S.cache.testiMasuk.ringkasan ? S.cache.testiMasuk.ringkasan.Menunggu || 0 : 0;
            atas = '<div class="grid-kpi"><div class="panel kpi"><div class="atas">Total testimoni<span class="ms">format_quote</span></div><b>' + semua.length + '</b><small>' + tampilN + ' tampil · ' + (semua.length - tampilN) + ' disembunyikan</small></div><div class="panel kpi"><div class="atas">Rata-rata rating<span class="ms">star</span></div><b>' + rr + '</b><small>dari 5 bintang</small></div><div class="panel kpi"><div class="atas">Bagian di situs<span class="ms">public</span></div><b style="font-size:20px">' + (tampilN ? 'Terlihat' : 'Tersembunyi') + '</b><small>' + (tampilN ? 'Ada testimoni aktif' : 'Aktifkan minimal 1 testimoni') + '</small></div>' +
              '<a class="panel kpi ' + (tm ? 'sorot' : '') + '" href="#masuk-testi" data-ke-masuk style="text-decoration:none"><div class="atas">Menunggu persetujuan<span class="ms">rate_review</span></div><b>' + tm + '</b><small>' + (tm ? 'Tinjau sekarang →' : 'Tidak ada antrean') + '</small></a></div>' +
              '<section class="panel" id="masuk-testi" style="margin-bottom:20px"></section>';
          }
          if (kunci === 'kontak') {
            atas = '<section class="panel" style="margin-bottom:20px"><div class="panel-kepala"><div><h2><span class="ms">visibility</span>Pratinjau Tombol Publik</h2><p>Urutan & visibilitas di bawah langsung memengaruhi bagian Kontak dan footer.</p></div></div><div style="display:flex;flex-wrap:wrap;gap:10px">' +
              semua.filter(function (r) { return r.tampil === 'Ya'; }).map(function (r) { return '<span class="chip" style="background:var(--putih);border:1px solid var(--garis);padding:10px 14px"><span class="ms" style="color:var(--utama)">' + e(r.ikon || 'link') + '</span>' + e(String(r.url).replace(/^mailto:|^tel:|^https:\/\/(www\.)?/, '')) + '</span>'; }).join('') + '</div></section>';
          }
          if (semua.length > 4 && kunci !== 'kontak') atas += '<div class="alat"><span class="cari"><span class="ms">search</span><input class="input" id="cari" placeholder="Cari…" value="' + e(filter.cari) + '" aria-label="Cari"></span>' +
            (Object.keys(kats).length ? '<select class="input" id="f-kat" aria-label="Filter kategori"><option value="">Semua kategori</option>' + Object.keys(kats).map(function (k) { return '<option' + (filter.kat === k ? ' selected' : '') + '>' + e(k) + '</option>'; }).join('') + '</select>' : '') +
            '<select class="input" id="f-st" aria-label="Filter status"><option value="">Semua status</option><option value="Ya"' + (filter.status === 'Ya' ? ' selected' : '') + '>Tampil</option><option value="Tidak"' + (filter.status === 'Tidak' ? ' selected' : '') + '>Disembunyikan</option></select></div>';
          if (filter.cari) { var q = filter.cari.toLowerCase(); rows = rows.filter(function (r) { return JSON.stringify(r).toLowerCase().indexOf(q) > -1; }); }
          if (filter.kat) rows = rows.filter(function (r) { return r.kategori === filter.kat; });
          if (filter.status) rows = rows.filter(function (r) { return r.tampil === filter.status; });
        }
        var tersaring = rows.length !== semua.filter(function (r) { return kunci !== 'tentang' || r.jenis === filter.jenis; }).length;
        el.innerHTML = kepala + atas + '<section class="panel"><div class="panel-kepala"><div><h2><span class="ms">reorder</span>Daftar ' + e(c.tunggal) + '</h2><p>' + (tersaring ? 'Hapus filter untuk mengatur urutan.' : 'Seret ikon ⋮⋮ atau gunakan tombol panah untuk mengatur urutan tampil.') + '</p></div><span class="lencana abu">' + rows.length + ' entri</span></div>' +
          (rows.length ? '<div class="daftar-item" id="daftar">' + rows.map(function (r) { return itemKonten(kunci, r); }).join('') + '</div>' : kosong(c.ikon, 'Belum ada ' + c.tunggal + '.', '<button class="btn btn-utama btn-kecil" type="button" data-tambah2><span class="ms">add</span>Tambah ' + e(c.tunggal) + '</button>')) + '</section>';
        if (kunci === 'testimoni') {
          panelTestiMasuk($('#masuk-testi'), gambar);
          var km = $('[data-ke-masuk]', el); if (km) km.onclick = function (ev) { ev.preventDefault(); $('#masuk-testi').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
        }
        // event
        var tambah = function () { bukaFormKonten(kunci, {}, filter.jenis, gambar); };
        $('#b-tambah').onclick = tambah; if ($('[data-tambah2]', el)) $('[data-tambah2]', el).onclick = tambah;
        $$('[data-jenis]', el).forEach(function (b) { b.onclick = function () { filter.jenis = b.getAttribute('data-jenis'); gambar(); }; });
        if ($('#cari')) { var tmr; $('#cari').oninput = function () { var v = this.value; clearTimeout(tmr); tmr = setTimeout(function () { filter.cari = v; gambar(); var c2 = $('#cari'); c2.focus(); c2.setSelectionRange(v.length, v.length); }, 300); }; }
        if ($('#f-kat')) $('#f-kat').onchange = function () { filter.kat = this.value; gambar(); };
        if ($('#f-st')) $('#f-st').onchange = function () { filter.status = this.value; gambar(); };
        var fr = $('#f-ringkas');
        if (fr) {
          fr.oninput = function () { $('#hit-r').textContent = fr.elements.ringkasan_tentang.value.length; };
          fr.onsubmit = function (ev) {
            ev.preventDefault(); var b = $('button', fr); sibuk(b, true);
            ambilProfil().then(function (p) { return api('profil.simpan', Object.assign({}, p, { ringkasan_tentang: fr.elements.ringkasan_tentang.value })); }).then(function (r) {
              sibuk(b, false); if (!r.ok) return toast(r.data && r.data.galat ? Object.keys(r.data.galat).map(function (k) { return r.data.galat[k]; }).join('; ') : r.message, 'galat');
              S.cache.profil = Object.assign({}, S.cache.profil, r.data); toast('Ringkasan tersimpan.');
            });
          };
        }
        var d = $('#daftar');
        if (!d) return;
        if (!tersaring) pasangUrut(d, '.item', function (ids) {
          // urutan untuk seluruh tabel: id terurut di tab ini + sisanya mengikuti urutan lama
          var list = S.cache.konten[c.tabel], lain = list.filter(function (r) { return ids.indexOf(r.id) < 0; });
          var semuaId = kunci === 'tentang' ? list.map(function (r) { return r.id; }).filter(function (id) { return ids.indexOf(id) < 0; }).concat(ids) : ids.concat(lain.map(function (r) { return r.id; }));
          S.cache.konten[c.tabel] = semuaId.map(function (id, i) { var r = list.filter(function (z) { return z.id === id; })[0]; r.urutan = i + 1; return r; });
          api('konten.urut', { tabel: c.tabel, ids: semuaId }).then(function (r) { if (r.ok) toast('Urutan tersimpan.'); else { toast(r.message, 'galat'); ambilKonten(true).then(gambar); } });
        });
        else $$('.pegang,[data-geser]', d).forEach(function (x) { x.style.visibility = 'hidden'; });
        d.addEventListener('click', function (ev) {
          var it = ev.target.closest('.item'); if (!it) return;
          var r = S.cache.konten[c.tabel].filter(function (z) { return z.id === it.dataset.id; })[0]; if (!r) return;
          if (ev.target.closest('[data-ubah]')) bukaFormKonten(kunci, r, null, gambar);
          if (ev.target.closest('[data-hapus]')) konfirmasi('Hapus ' + c.tunggal + '?', '"' + (r.judul || r.nama_skill || r.nama || r.label || '') + '" akan dihapus permanen dari landing page.', 'Hapus', true).then(function (ya) {
            if (!ya) return;
            api('konten.hapus', { tabel: c.tabel, ids: [r.id] }).then(function (x) { if (!x.ok) return toast(x.message, 'galat'); S.cache.konten[c.tabel] = S.cache.konten[c.tabel].filter(function (z) { return z.id !== r.id; }); toast('Dihapus.'); gambar(); });
          });
        });
        d.addEventListener('change', function (ev) {
          if (!ev.target.matches('[data-tampil]')) return;
          var it = ev.target.closest('.item'), on = ev.target.checked, r = S.cache.konten[c.tabel].filter(function (z) { return z.id === it.dataset.id; })[0];
          r.tampil = on ? 'Ya' : 'Tidak'; it.classList.toggle('tersembunyi', !on);       // optimistik
          api('konten.tampil', { tabel: c.tabel, id: r.id, tampil: on }).then(function (x) {
            if (!x.ok) { r.tampil = on ? 'Tidak' : 'Ya'; ev.target.checked = !on; it.classList.toggle('tersembunyi', on); return toast(x.message, 'galat'); }
            toast(x.message); if (kunci === 'kontak' || kunci === 'testimoni' || kunci === 'portofolio' || kunci === 'keahlian') gambar();
          });
        });
      };
      Promise.all([ambilKonten(), kunci === 'tentang' ? ambilProfil() : null, kunci === 'testimoni' ? muatTestiMasuk() : null]).then(function () { gambar(); if (param && param[0] === 'baru') bukaFormKonten(kunci, {}, null, gambar); })
        .catch(function (x) { el.innerHTML = kosong('error', x.message); });
    } };
  }
  Object.keys(KONTEN).forEach(function (k) { MODUL[k] = modulKonten(k); });

  /* =====================================================================
   * ANTREAN FORMULIR TESTIMONI (v1.2) — tampil di situs hanya setelah disetujui
   * ===================================================================== */
  var MODE_TESTI = [['Semua', 'Semua pengunjung — tombol "Tulis testimoni" tampil di situs'], ['Tautan', 'Hanya lewat tautan pribadi klien'], ['Nonaktif', 'Nonaktif — formulir ditutup']];
  function muatTestiMasuk() {
    return api('testimoni.masuk').then(function (r) {
      if (r.ok) { S.cache.testiMasuk = r.data; setLencanaTesti(r.data.ringkasan.Menunggu || 0); }
      else S.cache.testiMasuk = { galat: pesanBelumDeploy(r) };
    });
  }
  /** frontend sudah 1.2 tetapi Apps Script belum diterapkan ulang → pesan yang bisa ditindaklanjuti */
  function pesanBelumDeploy(r) {
    return /tidak dikenal|tidak boleh di-batch/i.test(r.message || '') ? 'Backend Apps Script belum versi 1.2. Tambahkan berkas 12_Testimoni.gs, jalankan setupAppEnvironment, lalu Deploy → Kelola deployment → Versi baru.' : r.message;
  }
  function kontakTesti(k) {
    if (!k) return '';
    var em = k.indexOf('@') > -1, u = em ? 'mailto:' + k : 'https://wa.me/' + String(k).replace(/\D/g, '').replace(/^0/, '62');
    return '<a href="' + e(u) + '"' + (em ? '' : ' target="_blank" rel="noopener"') + '><span class="ms">' + (em ? 'mail' : 'chat') + '</span>' + e(k) + '</a>';
  }
  function kartuMasuk(r) {
    var tunggu = r.status === 'Menunggu', n = Math.max(0, Math.min(5, Number(r.rating) || 0));
    return '<article class="kartu-antre' + (tunggu ? '' : ' selesai') + '" data-id="' + e(r.id) + '">' +
      '<div class="km-kepala"><span class="km-avatar">' + e(inisial(r.nama)) + '</span><div class="km-nama"><b>' + e(r.nama) + '</b><small>' + e([r.jabatan, r.instansi].filter(Boolean).join(' · ') || (r.jenis === 'Instansi' ? 'Instansi' : 'Perorangan')) + '</small></div>' +
      '<div class="km-lencana"><span class="lencana ' + (r.jenis === 'Instansi' ? 'biru' : 'abu') + '"><span class="ms" style="font-size:13px">' + (r.jenis === 'Instansi' ? 'apartment' : 'person') + '</span>' + e(r.jenis || '-') + '</span>' +
      (r.klien_id ? '<span class="lencana hijau" title="' + e(r.klien_nama) + '"><span class="ms" style="font-size:13px">verified</span>Klien</span>' : '') + lencana(r.status) + '</div></div>' +
      '<div class="km-bintang" aria-label="Rating ' + n + ' dari 5">' + '★'.repeat(n) + '<span>' + '★'.repeat(5 - n) + '</span></div>' +
      '<blockquote class="km-isi">' + e(r.isi) + '</blockquote>' +
      '<div class="km-meta"><span><span class="ms">schedule</span>' + e(API.relatif(r.dikirim)) + '</span>' + (r.kontak ? kontakTesti(r.kontak) : '') +
      '<span title="Pengirim mencentang persetujuan publikasi"><span class="ms ok">check_circle</span>Setuju ditampilkan</span>' +
      (r.jenis === 'Instansi' ? '<span title="Pengirim menyatakan berwenang mewakili instansi"><span class="ms ok">check_circle</span>Berwenang atas nama instansi</span>' : '') +
      (r.tampil_nama === 'singkat' ? '<span><span class="ms">badge</span>Minta nama singkat</span>' : '') +
      (r.diubah_admin === 'Ya' ? '<span><span class="ms">edit_note</span>Dirapikan admin</span>' : '') + '</div>' +
      '<div class="km-aksi">' + (tunggu ? '<button class="btn btn-utama btn-kecil" type="button" data-m="setujui"><span class="ms">task_alt</span>Tinjau &amp; setujui</button><button class="btn btn-garis btn-kecil" type="button" data-m="tolak"><span class="ms">block</span>Tolak</button>'
        : (r.status === 'Ditolak' ? '<button class="btn btn-garis btn-kecil" type="button" data-m="setujui"><span class="ms">undo</span>Setujui</button>' : '') +
          '<button class="btn btn-teks btn-kecil" type="button" data-m="hapus" style="color:var(--merah)"><span class="ms">delete</span>Hapus dari antrean</button>') + '</div></article>';
  }
  function panelTestiMasuk(w, segarkan) {
    if (!w) return;
    var d = S.cache.testiMasuk;
    if (!d) { w.innerHTML = '<div class="skeleton" style="height:140px"></div>'; return; }
    if (d.galat) { w.innerHTML = kosong('error', d.galat); return; }
    var tunggu = d.rows.filter(function (r) { return r.status === 'Menunggu'; }), riwayat = d.rows.filter(function (r) { return r.status !== 'Menunggu'; });
    w.innerHTML = '<div class="panel-kepala"><div><h2><span class="ms">rate_review</span>Testimoni Masuk</h2><p>Kiriman dari formulir situs dan tautan pribadi klien. Tidak tampil di situs sebelum Anda setujui.</p></div>' +
      (tunggu.length ? '<span class="lencana kuning">' + tunggu.length + ' menunggu</span>' : '<span class="lencana hijau">Tidak ada antrean</span>') + '</div>' +
      (d.belumSetup ? '<div class="info-kotak kuning" style="margin-bottom:14px"><span class="ms">warning</span><span>Database belum diperbarui. Buka editor Apps Script, jalankan <b>setupAppEnvironment</b> sekali lagi, lalu muat ulang halaman ini.</span></div>' : '') +
      '<div class="mode-testi"><div class="bidang"><label for="mode-testi">Siapa yang boleh mengisi formulir</label><select id="mode-testi">' + MODE_TESTI.map(function (m) { return '<option value="' + m[0] + '"' + (d.mode === m[0] ? ' selected' : '') + '>' + e(m[1]) + '</option>'; }).join('') + '</select></div>' +
      (d.mode === 'Semua' && d.urlFormulir ? '<div class="bidang"><span class="label">Tautan formulir umum</span><div class="url-salin"><input class="input mono" readonly value="' + e(d.urlFormulir) + '" aria-label="Tautan formulir testimoni"><button class="btn btn-garis btn-kecil" type="button" id="salin-ft"><span class="ms">content_copy</span>Salin</button></div></div>' :
       d.mode === 'Tautan' ? '<div class="info-kotak" style="align-self:end"><span class="ms">link</span><span>Bagikan tautan pribadi dari <a href="#/tagihan/klien">Klien &amp; Tagihan</a> → ikon <b>Minta testimoni</b> di baris klien.</span></div>' :
       d.mode === 'Nonaktif' ? '<div class="info-kotak" style="align-self:end"><span class="ms">lock</span><span>Formulir ditutup. Testimoni tetap bisa Anda tambahkan sendiri lewat tombol Tambah testimoni.</span></div>' : '') + '</div>' +
      (tunggu.length ? '<div class="daftar-masuk">' + tunggu.map(kartuMasuk).join('') + '</div>' : '<div class="kosong" style="padding:24px 12px"><span class="ms">inbox</span><p>Belum ada testimoni yang menunggu persetujuan.</p></div>') +
      (riwayat.length ? '<button class="btn btn-teks btn-kecil" type="button" id="b-riwayat-testi" style="margin-top:10px"><span class="ms">' + (S.testiRiwayat ? 'expand_less' : 'history') + '</span>' + (S.testiRiwayat ? 'Sembunyikan riwayat' : 'Riwayat: ' + riwayat.length + ' sudah diproses') + '</button>' +
        (S.testiRiwayat ? '<div class="daftar-masuk" style="margin-top:10px">' + riwayat.map(kartuMasuk).join('') + '</div>' : '') : '');
    var sf = $('#salin-ft', w); if (sf) sf.onclick = function () { var u = d.urlFormulir; if (navigator.clipboard) navigator.clipboard.writeText(u).then(function () { toast('Tautan formulir disalin.'); }, function () { toast(u, 'info'); }); else toast(u, 'info'); };
    var br = $('#b-riwayat-testi', w); if (br) br.onclick = function () { S.testiRiwayat = !S.testiRiwayat; panelTestiMasuk(w, segarkan); };
    $('#mode-testi', w).onchange = function () {
      var sel = this, v = sel.value, lama = d.mode; sel.disabled = true;
      api('pengaturan.simpan', { nilai: { testimoni_formulir: v } }).then(function (r) {
        sel.disabled = false;
        if (!r.ok) { sel.value = lama; return toast(r.data && r.data.galat ? r.data.galat.testimoni_formulir : r.message, 'galat'); }
        d.mode = v; if (S.cache.pengaturan && S.cache.pengaturan.nilai) S.cache.pengaturan.nilai.testimoni_formulir = v;
        toast(v === 'Semua' ? 'Tombol "Tulis testimoni" kini tampil di situs.' : v === 'Tautan' ? 'Formulir hanya bisa diisi lewat tautan pribadi klien.' : 'Formulir testimoni ditutup.');
        panelTestiMasuk(w, segarkan);
      });
    };
    $$('.kartu-antre [data-m]', w).forEach(function (b) {
      b.onclick = function () {
        var r = d.rows.filter(function (x) { return x.id === b.closest('.kartu-antre').dataset.id; })[0]; if (!r) return;
        var m = b.dataset.m, selesai = function () { delete S.cache.beranda; muatTestiMasuk().then(segarkan); };
        if (m === 'setujui') setujuiTesti(r, selesai);
        if (m === 'tolak') konfirmasi('Tolak testimoni ini?', 'Testimoni dari ' + r.nama + ' tidak akan tampil di situs. Data tetap tersimpan di riwayat sampai Anda hapus.', 'Tolak', true).then(function (ya) {
          if (ya) api('testimoni.tolak', { id: r.id }).then(function (x) { toast(x.message, x.ok ? '' : 'galat'); if (x.ok) selesai(); });
        });
        if (m === 'hapus') konfirmasi('Hapus dari antrean?', 'Data kiriman ' + r.nama + ' (termasuk kontaknya) dihapus permanen. ' + (r.status === 'Disetujui' ? 'Testimoni yang sudah tampil di situs TIDAK ikut terhapus.' : ''), 'Hapus', true).then(function (ya) {
          if (ya) api('testimoni.hapusMasuk', { ids: [r.id] }).then(function (x) { toast(x.message, x.ok ? '' : 'galat'); if (x.ok) selesai(); });
        });
      };
    });
  }
  function setujuiTesti(r, selesai) {
    var u = r.usulan || {}, isiAsli = String(r.isi || '');
    var m = modal({ judul: 'Setujui testimoni', lebar: true, isi: '<form id="f-setuju" novalidate><div class="info-kotak" style="margin-bottom:16px"><span class="ms">info</span><span>Testimoni tampil atas nama pengirim. Rapikan ejaan bila perlu, tetapi <b>jangan mengubah maknanya</b>. Perubahan isi dicatat sebagai "dirapikan admin".</span></div><div class="grid-form">' +
      bidang({ k: 'nama', label: 'Nama yang ditampilkan', nilai: u.nama, wajib: true, maks: 80, bantu: 'Pilihan pengirim: ' + (r.tampil_nama === 'singkat' ? '<b>nama singkat</b>' : 'nama lengkap') + '.' }) +
      bidang({ k: 'jabatan_instansi', label: 'Jabatan / instansi', nilai: u.jabatan_instansi, maks: 120 }) +
      bidang({ k: 'rating', label: 'Rating', tipe: 'select', nilai: String(r.rating || 5), opsi: [5, 4, 3, 2, 1].map(function (n) { return [String(n), '★'.repeat(n) + '  (' + n + ')']; }), bantu: 'Penilaian dari pengirim.' }) +
      bidang({ k: 'tampil', label: 'Langsung tampil di situs', tipe: 'saklar', nilai: true, bantu: 'Matikan untuk menyimpan dulu tanpa menampilkan.' }) +
      bidang({ k: 'isi', label: 'Isi testimoni', tipe: 'textarea', nilai: isiAsli, wajib: true, maks: 500, penuh: true, baris: 5, bantu: '<span id="ket-ubah"></span>' }) + '</div></form>',
      tombol: [{ teks: 'Batal' }, { teks: '<span class="ms">task_alt</span>Setujui', kelas: 'btn-utama', aksi: function (mm) {
        var f = $('#f-setuju', mm.isi), x = ambil(f); x.id = r.id;
        return api('testimoni.setujui', x).then(function (h) {
          if (!h.ok) { tandaiGalat(f, h.data && h.data.galat); toast(h.message, 'galat'); return false; }
          if (S.cache.konten) (S.cache.konten.Testimoni = S.cache.konten.Testimoni || []).push(h.data.testimoni);
          toast(h.message); selesai();
        });
      } }] });
    var ta = $('textarea[name=isi]', m.isi), ket = $('#ket-ubah', m.isi);
    ta.addEventListener('input', function () { ket.textContent = ta.value.trim() !== isiAsli.trim() ? 'Isi berbeda dari kiriman asli — akan ditandai "dirapikan admin".' : ''; ket.style.color = 'var(--oranye)'; });
  }

  /* =====================================================================
   * MODUL: PESAN MASUK (A8, UI-14)
   * ===================================================================== */
  MODUL.pesan = { judul: 'Pesan Masuk', ikon: 'mail', render: function (el, param) {
    var f = { status: '', cari: '', halaman: 1, per: 10, dari: '', sampai: '' }, pilih = {};
    var muat = function () {
      api('pesan.list', f).then(function (r) {
        if (S.rute !== 'pesan') return;
        if (!r.ok) { el.innerHTML = kosong('error', r.message); return; }
        gambar(r.data);
      });
    };
    var gambar = function (d) {
      var g = d.ringkasan; setLencanaPesan(g.baru);
      var ubah = g.mingguLalu ? Math.round((g.mingguIni - g.mingguLalu) / g.mingguLalu * 100) : null;
      el.innerHTML = '<div class="kepala-hal"><div><h1>Kotak Pesan Masuk</h1><p><span class="lencana biru">' + g.baru + ' Baru</span> · ' + angka(g.total) + ' total pesan dari formulir kontak.</p></div><div class="aksi"><button class="btn btn-garis" type="button" id="b-semua-baca"' + (g.baru ? '' : ' disabled') + '><span class="ms">mark_email_read</span>Tandai Semua Dibaca</button><button class="btn btn-garis" type="button" id="b-ekspor"><span class="ms">download</span>Ekspor Excel</button></div></div>' +
        '<div class="grid-kpi"><div class="panel kpi"><div class="atas">Belum dibaca<span class="ms">mark_email_unread</span></div><b>' + g.baru + '</b><small>perlu ditindaklanjuti</small></div><div class="panel kpi"><div class="atas">Pekan ini<span class="ms">inbox</span></div><b>' + g.mingguIni + '</b>' + (ubah === null ? '<small>7 hari terakhir</small>' : ubahPersen(ubah)) + '</div><div class="panel kpi"><div class="atas">Total pesan<span class="ms">forum</span></div><b>' + angka(g.total) + '</b><small>sejak awal</small></div></div>' +
        '<section class="panel"><div class="alat"><span class="cari"><span class="ms">search</span><input class="input" id="p-cari" placeholder="Cari nama, email, atau isi pesan" value="' + e(f.cari) + '" aria-label="Cari pesan"></span>' +
        '<select class="input" id="p-st" aria-label="Filter status"><option value="">Semua status</option><option value="baru"' + (f.status === 'baru' ? ' selected' : '') + '>Baru</option><option value="dibaca"' + (f.status === 'dibaca' ? ' selected' : '') + '>Dibaca</option></select>' +
        '<input class="input" type="date" id="p-dari" value="' + e(f.dari) + '" aria-label="Dari tanggal"><input class="input" type="date" id="p-sampai" value="' + e(f.sampai) + '" aria-label="Sampai tanggal"><button class="btn btn-ikon" type="button" id="p-segar" aria-label="Muat ulang"><span class="ms">refresh</span></button></div>' +
        (d.rows.length ? '<div class="tabel-wadah"><table class="tabel"><thead><tr><th style="width:36px"><input type="checkbox" id="p-semua" aria-label="Pilih semua"></th><th>Status</th><th>Pengirim</th><th>Cuplikan pesan</th><th>Waktu</th><th class="aksi">Aksi</th></tr></thead><tbody>' +
          d.rows.map(function (m) { return '<tr class="' + (m.status === 'baru' ? 'baru' : '') + '" data-id="' + e(m.id) + '"><td><input type="checkbox" data-pilih' + (pilih[m.id] ? ' checked' : '') + ' aria-label="Pilih pesan ' + e(m.nama) + '"></td><td>' + lencana(m.status) + '</td><td class="sel-utama"><b>' + e(m.nama) + '</b><small>' + e(m.email) + '</small></td><td style="max-width:420px"><span style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--abu-2)">' + e(m.pesan) + '</span></td><td style="white-space:nowrap;color:var(--abu);font-size:13px" title="' + e(m.timestamp) + '">' + e(API.relatif(m.timestamp)) + '</td><td class="aksi"><button class="btn btn-ikon mini" type="button" data-buka aria-label="Buka pesan"><span class="ms">visibility</span></button></td></tr>'; }).join('') +
          '</tbody></table></div><div class="paginasi"><span>Menampilkan ' + ((d.halaman - 1) * d.per + 1) + '–' + Math.min(d.total, d.halaman * d.per) + ' dari ' + d.total + ' pesan</span><span class="tombol"><button class="btn btn-ikon kecil" type="button" id="p-mundur"' + (d.halaman > 1 ? '' : ' disabled') + ' aria-label="Halaman sebelumnya"><span class="ms">chevron_left</span></button><span style="align-self:center;padding:0 8px">' + d.halaman + ' / ' + Math.max(1, Math.ceil(d.total / d.per)) + '</span><button class="btn btn-ikon kecil" type="button" id="p-maju"' + (d.halaman * d.per < d.total ? '' : ' disabled') + ' aria-label="Halaman berikutnya"><span class="ms">chevron_right</span></button></span></div>'
          : kosong('inbox', f.cari || f.status || f.dari ? 'Tidak ada pesan yang cocok dengan filter.' : 'Belum ada pesan masuk.')) +
        '<div class="bilah-pilih" id="p-bilah" hidden><b id="p-n">0</b> dipilih<span style="flex:1"></span><button class="btn btn-garis btn-kecil" type="button" id="p-baca"><span class="ms">done_all</span>Tandai Dibaca</button><button class="btn btn-bahaya btn-kecil" type="button" id="p-hapus"><span class="ms">delete</span>Hapus</button></div></section>';
      var segarPilih = function () { var n = Object.keys(pilih).length; $('#p-bilah').hidden = !n; $('#p-n').textContent = n; };
      segarPilih();
      var tm;
      $('#p-cari').oninput = function () { var v = this.value; clearTimeout(tm); tm = setTimeout(function () { f.cari = v; f.halaman = 1; muat(); }, 350); };
      $('#p-st').onchange = function () { f.status = this.value; f.halaman = 1; muat(); };
      $('#p-dari').onchange = function () { f.dari = this.value; f.halaman = 1; muat(); };
      $('#p-sampai').onchange = function () { f.sampai = this.value; f.halaman = 1; muat(); };
      $('#p-segar').onclick = muat;
      if ($('#p-mundur')) { $('#p-mundur').onclick = function () { f.halaman--; muat(); }; $('#p-maju').onclick = function () { f.halaman++; muat(); }; }
      if ($('#p-semua')) $('#p-semua').onchange = function () { var on = this.checked; d.rows.forEach(function (m) { if (on) pilih[m.id] = 1; else delete pilih[m.id]; }); $$('[data-pilih]', el).forEach(function (c) { c.checked = on; }); segarPilih(); };
      $('section.panel', el).addEventListener('change', function (ev) { if (!ev.target.matches('[data-pilih]')) return; var id = ev.target.closest('tr').dataset.id; if (ev.target.checked) pilih[id] = 1; else delete pilih[id]; segarPilih(); });
      $$('tbody tr', el).forEach(function (tr) { tr.addEventListener('click', function (ev) { if (ev.target.closest('input')) return; bukaPesan(d.rows.filter(function (m) { return m.id === tr.dataset.id; })[0]); }); });
      $('#b-semua-baca').onclick = function () { var b = this; sibuk(b, true); api('pesan.tandai', { semua: true, status: 'dibaca' }).then(function (r) { sibuk(b, false); toast(r.message, r.ok ? '' : 'galat'); muat(); }); };
      $('#p-baca').onclick = function () { api('pesan.tandai', { ids: Object.keys(pilih), status: 'dibaca' }).then(function (r) { toast(r.message, r.ok ? '' : 'galat'); pilih = {}; muat(); }); };
      $('#p-hapus').onclick = function () { var ids = Object.keys(pilih); konfirmasi('Hapus ' + ids.length + ' pesan?', 'Pesan yang dihapus tidak bisa dikembalikan.', 'Hapus', true).then(function (ya) { if (ya) api('pesan.hapus', { ids: ids }).then(function (r) { toast(r.message, r.ok ? '' : 'galat'); pilih = {}; muat(); }); }); };
      $('#b-ekspor').onclick = function () {
        var b = this; sibuk(b, true);
        api('pesan.list', Object.assign({}, f, { semua: true })).then(function (r) {
          if (!r.ok) throw new Error(r.message);
          return bolehEkspor('Pesan-Masuk-' + new Date().toISOString().slice(0, 10), [{ nama: 'Pesan', rows: r.data.rows.map(function (m) { return { Waktu: m.timestamp, Nama: m.nama, Email: m.email, WhatsApp: m.no_wa, Pesan: m.pesan, Status: m.status, Perangkat: m.perangkat }; }) }]);
        }).then(function () { sibuk(b, false); toast('Berkas Excel diunduh.'); }).catch(function (x) { sibuk(b, false); toast(x.message, 'galat'); });
      };
      if (param && param[0]) { var m0 = d.rows.filter(function (m) { return m.id === param[0]; })[0]; param = null; if (m0) bukaPesan(m0); }
    };
    var bukaPesan = function (m) {
      if (!m) return;
      var subjek = encodeURIComponent('Re: Pesan Anda di situs portofolio'), isiBalas = encodeURIComponent('\n\n---\nPada ' + m.timestamp + ', ' + m.nama + ' menulis:\n' + m.pesan);
      var wa = m.no_wa ? 'https://wa.me/' + String(m.no_wa).replace(/^0/, '62') : '';
      var l = laci({ judul: 'Detail Pesan', isi: '<div style="display:flex;gap:14px;align-items:center"><span style="width:52px;height:52px;border-radius:50%;background:var(--navy);color:var(--kuning);display:grid;place-items:center;font-weight:800">' + e(inisial(m.nama)) + '</span><div style="min-width:0"><b style="color:var(--navy);font-size:17px;display:block">' + e(m.nama) + '</b><span style="color:var(--abu);font-size:13px;word-break:break-all">' + e(m.email) + '</span></div><button class="btn btn-ikon kecil" type="button" id="salin-em" aria-label="Salin email" style="margin-left:auto"><span class="ms">content_copy</span></button></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' + lencana(m.status === 'baru' ? 'dibaca' : m.status) + '<span style="color:var(--abu);font-size:13px"><span class="ms" style="font-size:15px;vertical-align:-3px">schedule</span> ' + e(API.tgl(m.timestamp, true)) + ' WITA</span>' + (m.perangkat ? '<span class="lencana abu">' + e(m.perangkat) + '</span>' : '') + (m.no_wa ? '<span class="lencana hijau">WA ' + e(m.no_wa) + '</span>' : '') + '</div><div class="isi-pesan"></div>',
        kaki: '<a class="btn btn-utama" href="mailto:' + e(m.email) + '?subject=' + subjek + '&body=' + isiBalas + '"><span class="ms">reply</span>Balas via Email</a>' + (wa ? '<a class="btn btn-hijau" href="' + e(wa) + '" target="_blank" rel="noopener"><span class="ms">chat</span>WhatsApp</a>' : '') + '<button class="btn btn-garis" type="button" id="m-belum"><span class="ms">mark_email_unread</span>Tandai Belum Dibaca</button><button class="btn btn-teks" type="button" id="m-hapus" style="color:var(--merah)"><span class="ms">delete</span>Hapus</button>' });
      $('.isi-pesan', l.el).textContent = m.pesan;
      $('#salin-em', l.el).onclick = function () { if (navigator.clipboard) navigator.clipboard.writeText(m.email).then(function () { toast('Email disalin.'); }); };
      if (m.status === 'baru') api('pesan.tandai', { ids: [m.id], status: 'dibaca' }).then(function (r) { if (r.ok) { m.status = 'dibaca'; var tr = $('tr[data-id="' + m.id + '"]', el); if (tr) { tr.classList.remove('baru'); tr.children[1].innerHTML = lencana('dibaca'); } setLencanaPesan(Math.max(0, (S.pesanBaru || 1) - 1)); delete S.cache.beranda; } });
      $('#m-belum', l.el).onclick = function () { api('pesan.tandai', { ids: [m.id], status: 'baru' }).then(function (r) { toast(r.message, r.ok ? '' : 'galat'); l.tutup(); muat(); }); };
      $('#m-hapus', l.el).onclick = function () { konfirmasi('Hapus pesan ini?', 'Pesan dari ' + m.nama + ' akan dihapus permanen.', 'Hapus', true).then(function (ya) { if (ya) api('pesan.hapus', { ids: [m.id] }).then(function (r) { toast(r.message, r.ok ? '' : 'galat'); l.tutup(); muat(); }); }); };
    };
    muat();
  } };

  /* ---------- ekspor untuk berkas modul lain ---------- */
  window.ADM = { MODUL: MODUL, S: S, api: api, toast: toast, modal: modal, konfirmasi: konfirmasi, laci: laci, sibuk: sibuk, ambil: ambil, tandaiGalat: tandaiGalat, bidang: bidang,
    kosong: kosong, lencana: lencana, ubahPersen: ubahPersen, angka: angka, inisial: inisial, grafik: grafik, ekspor: bolehEkspor, ambilProfil: ambilProfil,
    ambilKonten: ambilKonten, pesanBelumDeploy: pesanBelumDeploy, $: $, $$: $$, e: e };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulai); else setTimeout(mulai, 0);
})();