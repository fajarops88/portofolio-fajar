/*
 * admin-laporan.js — modul Statistik & Laporan (A9, UI-15), Pengaturan (A10, UI-16),
 * Migrasi data Fajarfk, dan Status Sistem.
 */
(function () {
  'use strict';
  var A = window.ADM, $ = A.$, $$ = A.$$, e = A.e, api = A.api, toast = A.toast;
  var JENIS = { kunjungan: 'Kunjungan', klik_proyek: 'Klik proyek', klik_kontak: 'Klik kontak', klik_cta: 'Klik tombol (CTA)' };
  var CTA = { hubungi_saya: 'Tombol "Hubungi Saya"', lihat_portofolio: 'Tombol "Lihat Portofolio"', tentang_saya: 'Tombol "Tentang Saya"', video: 'Video perkenalan', unduh_cv: 'Lihat CV', logo: 'Logo navigasi' };
  function hariStr(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function geserHari(n) { var d = new Date(); d.setDate(d.getDate() + n); return hariStr(d); }

  /* =====================================================================
   * STATISTIK & LAPORAN
   * ===================================================================== */
  A.MODUL.statistik = { judul: 'Statistik & Laporan', ikon: 'analytics', render: function (el) {
    var f = { dari: geserHari(-29), sampai: geserHari(0), preset: 30, jenis: '', tab: 'log', cari: '', hal: 1 }, D = null, PESAN = [];
    var muat = function () {
      el.querySelector('#st-isi') && ($('#st-isi').style.opacity = '.5');
      Promise.all([api('stat.laporan', { dari: f.dari, sampai: f.sampai }), api('pesan.list', { dari: f.dari, sampai: f.sampai, semua: true })]).then(function (r) {
        if (A.S.rute !== 'statistik') return;
        if (!r[0].ok) { el.innerHTML = A.kosong('error', r[0].message); return; }
        D = r[0].data; PESAN = r[1].ok ? r[1].data.rows : [];
        gambar();
      });
    };
    var gambar = function () {
      var t = D.total, u = D.ubah;
      $$('canvas', el).forEach(function () {});
      A.S.grafik.forEach(function (g) { try { g.destroy(); } catch (x) {} }); A.S.grafik = [];
      var ctr = t.kunjungan ? (t.klik_proyek / t.kunjungan * 100).toFixed(1).replace('.', ',') : '0';
      el.innerHTML = '<div class="kepala-hal"><div><h1>Statistik &amp; Laporan</h1><p>Pantau kunjungan dan interaksi, lalu unduh laporan sesuai filter. Waktu server: WITA (GMT+8).</p></div><div class="aksi"><button class="btn btn-garis" type="button" id="x-xlsx"><span class="ms">table_view</span>Unduh Excel</button><button class="btn btn-garis" type="button" id="x-pdf"><span class="ms">picture_as_pdf</span>Unduh PDF</button><button class="btn btn-ikon" type="button" id="x-segar" aria-label="Muat ulang"><span class="ms">refresh</span></button></div></div>' +
        '<div class="alat"><div class="seg" role="group" aria-label="Rentang cepat">' + [7, 30, 90].map(function (n) { return '<button type="button" data-preset="' + n + '" aria-pressed="' + (f.preset === n) + '">' + n + ' Hari</button>'; }).join('') + '</div>' +
        '<input class="input" type="date" id="s-dari" value="' + f.dari + '" aria-label="Dari tanggal"><span style="color:var(--abu)">–</span><input class="input" type="date" id="s-sampai" value="' + f.sampai + '" aria-label="Sampai tanggal">' +
        '<span class="lencana abu" style="margin-left:auto">' + e(API.tgl(D.dari)) + ' – ' + e(API.tgl(D.sampai)) + '</span></div>' +
        '<div id="st-isi"><div class="grid-kpi">' +
        '<div class="panel kpi"><div class="atas">Total kunjungan<span class="ms">visibility</span></div><b>' + A.angka(t.kunjungan) + '</b>' + A.ubahPersen(u.kunjungan) + '</div>' +
        '<div class="panel kpi"><div class="atas">Klik proyek<span class="ms">folder_special</span></div><b>' + A.angka(t.klik_proyek) + '</b><small>CTR ' + ctr + '% dari kunjungan</small></div>' +
        '<div class="panel kpi"><div class="atas">Klik tautan kontak<span class="ms">quickreply</span></div><b>' + A.angka(t.klik_kontak) + '</b>' + A.ubahPersen(u.klik_kontak) + '</div>' +
        '<div class="panel kpi"><div class="atas">Klik tombol CTA<span class="ms">ads_click</span></div><b>' + A.angka(t.klik_cta) + '</b>' + A.ubahPersen(u.klik_cta) + '</div></div>' +
        '<div class="grid-2" style="margin-bottom:20px"><section class="panel"><div class="panel-kepala"><div><h2><span class="ms">show_chart</span>Kunjungan per Hari</h2><p>Garis biru: kunjungan · garis kuning: klik proyek</p></div></div><div class="grafik"><canvas id="g-harian" aria-label="Grafik kunjungan per hari"></canvas></div></section>' +
        '<section class="panel"><div class="panel-kepala"><div><h2><span class="ms">devices</span>Proporsi Perangkat</h2><p>Berdasarkan kunjungan</p></div></div><div class="grafik kecil"><canvas id="g-perangkat" aria-label="Grafik proporsi perangkat"></canvas></div></section></div>' +
        '<div class="grid-2 sama" style="margin-bottom:20px"><section class="panel"><div class="panel-kepala"><div><h2><span class="ms">bar_chart</span>Klik per Proyek</h2><p>' + D.perProyek.length + ' proyek diklik</p></div></div><div class="grafik"><canvas id="g-proyek" aria-label="Grafik klik per proyek"></canvas></div></section>' +
        '<section class="panel"><div class="panel-kepala"><div><h2><span class="ms">share</span>Klik Tautan Kontak</h2><p>Kanal yang paling sering diklik</p></div></div><div class="grafik"><canvas id="g-kontak" aria-label="Grafik klik kontak"></canvas></div></section></div>' +
        '<section class="panel"><div class="tab" role="tablist"><button type="button" role="tab" data-tab="log" aria-selected="' + (f.tab === 'log') + '"><span class="ms" style="font-size:18px">list_alt</span>Log Statistik<span class="jumlah">' + D.log.length + '</span></button><button type="button" role="tab" data-tab="pesan" aria-selected="' + (f.tab === 'pesan') + '"><span class="ms" style="font-size:18px">mail</span>Pesan Masuk<span class="jumlah">' + PESAN.length + '</span></button></div><div id="tabel-st"></div></section></div>';
      var kosongkan = function (id, teks) { var c = $(id); if (c) c.parentNode.innerHTML = A.kosong('bar_chart', teks); };
      A.grafik($('#g-harian'), { type: 'line', data: { labels: D.harian.map(function (h) { return API.tgl(h.tanggal).replace(/ \d{4}$/, ''); }), datasets: [
        { label: 'Kunjungan', data: D.harian.map(function (h) { return h.kunjungan; }), borderColor: '#2563EB', backgroundColor: 'rgba(37,99,235,.1)', fill: true, tension: .35, pointRadius: 0, borderWidth: 2.5 },
        { label: 'Klik proyek', data: D.harian.map(function (h) { return h.klik_proyek; }), borderColor: '#F8BE00', backgroundColor: 'transparent', tension: .35, pointRadius: 0, borderWidth: 2, borderDash: [5, 4] }] },
        options: { maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' }, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#EEF1F6' } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } } } } });
      var pr = D.perangkat, totP = pr.mobile + pr.tablet + pr.desktop;
      if (totP) A.grafik($('#g-perangkat'), { type: 'doughnut', data: { labels: ['Desktop', 'Ponsel', 'Tablet'], datasets: [{ data: [pr.desktop, pr.mobile, pr.tablet], backgroundColor: ['#0B1F3A', '#2563EB', '#FFC300'], borderWidth: 0 }] },
        options: { maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { callbacks: { label: function (c) { return c.label + ': ' + c.raw + ' (' + Math.round(c.raw / totP * 100) + '%)'; } } } } } });
      else kosongkan('#g-perangkat', 'Belum ada kunjungan pada rentang ini.');
      var bar = function (id, rows, warna) {
        if (!rows.length) return kosongkan(id, 'Belum ada klik pada rentang ini.');
        var top = rows.slice(0, 10);
        A.grafik($(id), { type: 'bar', data: { labels: top.map(function (r) { var l = CTA[r.label] || r.label; return l.length > 28 ? l.slice(0, 27) + '…' : l; }), datasets: [{ label: 'Klik', data: top.map(function (r) { return r.jumlah; }), backgroundColor: warna, borderRadius: 6, maxBarThickness: 26 }] },
          options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#EEF1F6' } }, y: { grid: { display: false } } } } });
      };
      bar('#g-proyek', D.perProyek, '#2563EB');
      bar('#g-kontak', D.perKontak.length ? D.perKontak : D.perCta, '#0B1F3A');
      tabel();
      $$('[data-preset]', el).forEach(function (b) { b.onclick = function () { f.preset = +b.dataset.preset; f.dari = geserHari(-(f.preset - 1)); f.sampai = geserHari(0); muat(); }; });
      $('#s-dari').onchange = function () { f.dari = this.value; f.preset = 0; muat(); };
      $('#s-sampai').onchange = function () { f.sampai = this.value; f.preset = 0; muat(); };
      $('#x-segar').onclick = muat;
      $$('[data-tab]', el).forEach(function (b) { b.onclick = function () { f.tab = b.dataset.tab; f.hal = 1; f.cari = ''; $$('[data-tab]', el).forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); }); tabel(); }; });
      $('#x-xlsx').onclick = function () { eksporExcel(this); };
      $('#x-pdf').onclick = function () { eksporPdf(this); };
    };
    var barisLog = function () {
      return D.log.filter(function (r) { return (!f.jenis || r.jenis_event === f.jenis) && (!f.cari || JSON.stringify(r).toLowerCase().indexOf(f.cari.toLowerCase()) > -1); });
    };
    var barisPesan = function () { return PESAN.filter(function (m) { return !f.cari || [m.nama, m.email, m.pesan].join(' ').toLowerCase().indexOf(f.cari.toLowerCase()) > -1; }); };
    var tabel = function () {
      var w = $('#tabel-st'), per = 50, rows = f.tab === 'log' ? barisLog() : barisPesan(), hal = Math.min(f.hal, Math.max(1, Math.ceil(rows.length / per)));
      var potong = rows.slice((hal - 1) * per, hal * per);
      w.innerHTML = '<div class="alat"><span class="cari"><span class="ms">search</span><input class="input" id="t-cari" placeholder="Cari di tabel" value="' + e(f.cari) + '" aria-label="Cari di tabel"></span>' +
        (f.tab === 'log' ? '<select class="input" id="t-jenis" aria-label="Jenis event"><option value="">Semua event</option>' + Object.keys(JENIS).map(function (k) { return '<option value="' + k + '"' + (f.jenis === k ? ' selected' : '') + '>' + JENIS[k] + '</option>'; }).join('') + '</select>' : '') + '</div>' +
        (potong.length ? '<div class="tabel-wadah"><table class="tabel"><thead>' + (f.tab === 'log' ? '<tr><th>Waktu</th><th>Jenis</th><th>Target</th><th>Perangkat</th><th style="text-align:right">Jumlah</th></tr>' : '<tr><th>Waktu</th><th>Nama</th><th>Email</th><th>Pesan</th><th>Status</th></tr>') + '</thead><tbody>' +
          potong.map(function (r) {
            return f.tab === 'log' ? '<tr><td class="mono">' + e(r.waktu) + '</td><td>' + e(JENIS[r.jenis_event] || r.jenis_event) + '</td><td>' + e(CTA[r.target] || r.target || '–') + '</td><td>' + e(r.perangkat || '–') + (r.arsip ? ' <span class="lencana abu">rangkuman</span>' : '') + '</td><td style="text-align:right">' + r.jumlah + '</td></tr>'
              : '<tr><td class="mono">' + e(r.timestamp) + '</td><td>' + e(r.nama) + '</td><td>' + e(r.email) + '</td><td style="max-width:380px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + e(r.pesan) + '</td><td>' + A.lencana(r.status) + '</td></tr>';
          }).join('') + '</tbody></table></div><div class="paginasi"><span>' + rows.length + ' baris' + (D.logTerpotong && f.tab === 'log' ? ' (3.000 terbaru)' : '') + '</span><span class="tombol"><button class="btn btn-ikon kecil" type="button" data-hal="-1"' + (hal > 1 ? '' : ' disabled') + ' aria-label="Sebelumnya"><span class="ms">chevron_left</span></button><span style="align-self:center;padding:0 8px">' + hal + ' / ' + Math.max(1, Math.ceil(rows.length / per)) + '</span><button class="btn btn-ikon kecil" type="button" data-hal="1"' + (hal * per < rows.length ? '' : ' disabled') + ' aria-label="Berikutnya"><span class="ms">chevron_right</span></button></span></div>'
          : A.kosong(f.tab === 'log' ? 'list_alt' : 'mail', 'Tidak ada data pada rentang/filter ini.'));
      var tm;
      $('#t-cari').oninput = function () { var v = this.value; clearTimeout(tm); tm = setTimeout(function () { f.cari = v; f.hal = 1; tabel(); var c = $('#t-cari'); c.focus(); c.setSelectionRange(v.length, v.length); }, 300); };
      if ($('#t-jenis')) $('#t-jenis').onchange = function () { f.jenis = this.value; f.hal = 1; tabel(); };
      $$('[data-hal]', w).forEach(function (b) { b.onclick = function () { f.hal = hal + Number(b.dataset.hal); tabel(); }; });
    };
    var nama = function () { return 'Laporan-Portofolio-' + f.dari + '_' + f.sampai; };
    var eksporExcel = function (b) {
      A.sibuk(b, true);
      A.ekspor(nama(), [
        { nama: 'Ringkasan', rows: Object.keys(JENIS).map(function (k) { return { Metrik: JENIS[k], Jumlah: D.total[k], 'Periode sebelumnya': D.totalLalu[k], 'Perubahan (%)': D.ubah[k] }; }) },
        { nama: 'Harian', rows: D.harian.map(function (h) { return { Tanggal: h.tanggal, Kunjungan: h.kunjungan, 'Klik proyek': h.klik_proyek, 'Klik kontak': h.klik_kontak, 'Klik CTA': h.klik_cta }; }) },
        { nama: 'Per Proyek', rows: D.perProyek.map(function (r) { return { Proyek: r.label, Klik: r.jumlah }; }) },
        { nama: 'Per Kontak', rows: D.perKontak.map(function (r) { return { Kontak: r.label, Klik: r.jumlah }; }) },
        { nama: 'Perangkat', rows: [{ Desktop: D.perangkat.desktop, Ponsel: D.perangkat.mobile, Tablet: D.perangkat.tablet }] },
        { nama: 'Log', rows: barisLog().map(function (r) { return { Waktu: r.waktu, Jenis: JENIS[r.jenis_event] || r.jenis_event, Target: CTA[r.target] || r.target, Perangkat: r.perangkat, Jumlah: r.jumlah }; }) },
        { nama: 'Pesan', rows: barisPesan().map(function (m) { return { Waktu: m.timestamp, Nama: m.nama, Email: m.email, WhatsApp: m.no_wa, Pesan: m.pesan, Status: m.status }; }) }
      ]).then(function () { A.sibuk(b, false); toast('Laporan Excel diunduh.'); }).catch(function (x) { A.sibuk(b, false); toast(x.message, 'galat'); });
    };
    var eksporPdf = function (b) {
      A.sibuk(b, true);
      API.muatSkrip(API.LIB.jspdf).then(function () { return API.muatSkrip(API.LIB.autotable); }).then(function () {
        var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }), y = 18, warna = [11, 31, 58];
        doc.setFillColor(11, 31, 58); doc.rect(0, 0, 210, 26, 'F'); doc.setFillColor(255, 195, 0); doc.rect(0, 26, 210, 1.4, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('Laporan Statistik Portofolio', 14, 13);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.text('Periode ' + API.tgl(D.dari, true) + ' – ' + API.tgl(D.sampai, true) + ' · dibuat ' + new Date().toLocaleString('id-ID'), 14, 20);
        y = 34;
        var tbl = function (judul, head, body) {
          if (!body.length) return;
          doc.setTextColor(11, 31, 58); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.text(judul, 14, y);
          doc.autoTable({ startY: y + 3, head: [head], body: body, theme: 'grid', styles: { fontSize: 8.5, cellPadding: 2 }, headStyles: { fillColor: warna, textColor: 255 }, alternateRowStyles: { fillColor: [245, 248, 252] }, margin: { left: 14, right: 14 } });
          y = doc.lastAutoTable.finalY + 10; if (y > 260) { doc.addPage(); y = 18; }
        };
        tbl('Ringkasan', ['Metrik', 'Jumlah', 'Periode sebelumnya', 'Perubahan'], Object.keys(JENIS).map(function (k) { return [JENIS[k], D.total[k], D.totalLalu[k], (D.ubah[k] >= 0 ? '+' : '') + D.ubah[k] + '%']; }));
        tbl('Perangkat (kunjungan)', ['Desktop', 'Ponsel', 'Tablet'], [[D.perangkat.desktop, D.perangkat.mobile, D.perangkat.tablet]]);
        tbl('Klik per Proyek', ['Proyek', 'Klik'], D.perProyek.map(function (r) { return [r.label, r.jumlah]; }));
        tbl('Klik Tautan Kontak', ['Kontak', 'Klik'], D.perKontak.map(function (r) { return [r.label, r.jumlah]; }));
        tbl('Kunjungan Harian', ['Tanggal', 'Kunjungan', 'Klik proyek', 'Klik kontak', 'Klik CTA'], D.harian.filter(function (h) { return h.kunjungan || h.klik_proyek || h.klik_kontak || h.klik_cta; }).map(function (h) { return [h.tanggal, h.kunjungan, h.klik_proyek, h.klik_kontak, h.klik_cta]; }));
        tbl('Pesan Masuk', ['Waktu', 'Nama', 'Email', 'Pesan', 'Status'], barisPesan().slice(0, 300).map(function (m) { return [m.timestamp, m.nama, m.email, String(m.pesan).slice(0, 120), m.status]; }));
        tbl('Log Statistik (maks. 500 baris)', ['Waktu', 'Jenis', 'Target', 'Perangkat', 'Jml'], barisLog().slice(0, 500).map(function (r) { return [r.waktu, JENIS[r.jenis_event] || r.jenis_event, CTA[r.target] || r.target, r.perangkat, r.jumlah]; }));
        var n = doc.getNumberOfPages();
        for (var i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120); doc.text('Halaman ' + i + ' dari ' + n, 196, 290, { align: 'right' }); }
        doc.save(nama() + '.pdf');
      }).then(function () { A.sibuk(b, false); toast('Laporan PDF diunduh.'); }).catch(function (x) { A.sibuk(b, false); toast(x.message, 'galat'); });
    };
    muat();
  } };

  /* =====================================================================
   * PENGATURAN (A10, UI-16) + KEAMANAN
   * ===================================================================== */
  function kontras(hex1, hex2) {
    var l = function (h) { var n = parseInt(h.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
    var a = l(hex1), b = l(hex2); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  }
  A.MODUL.pengaturan = { judul: 'Pengaturan', ikon: 'settings', render: function (el, param) {
    var tab = (param && param[0]) || 'situs';
    var TAB = [['situs', 'Situs & SEO', 'travel_explore'], ['tampilan', 'Tampilan', 'palette'], ['infobar', 'Info Bar', 'view_day'], ['notifikasi', 'Notifikasi', 'notifications'], ['tagihan', 'Tagihan', 'receipt_long'], ['keamanan', 'Keamanan', 'shield_lock']];
    var muat = function () {
      api('pengaturan.get').then(function (r) {
        if (!r.ok) { el.innerHTML = A.kosong('error', r.message); return; }
        A.S.cache.pengaturan = r.data; gambar(r.data);
      });
    };
    var gambar = function (P) {
      var v = P.nilai, b = A.bidang, nonaktif = v.status_situs === 'Nonaktif';
      var isi = '';
      if (tab === 'situs') isi = '<div class="grid-form">' + b({ k: 'judul_situs', label: 'Judul situs (tab browser & mesin pencari)', nilai: v.judul_situs, wajib: true, maks: 80, penuh: true, bantu: 'Maksimal 60 karakter disarankan.' }) +
        b({ k: 'meta_deskripsi', label: 'Meta deskripsi', tipe: 'textarea', nilai: v.meta_deskripsi, maks: 160, penuh: true, baris: 3, bantu: '<span id="hit-md">' + String(v.meta_deskripsi || '').length + '</span>/160 karakter' }) +
        b({ k: 'tagline_footer', label: 'Tagline footer', nilai: v.tagline_footer, maks: 150, penuh: true }) +
        '<div class="penuh"><span class="label">Pratinjau hasil pencarian Google</span><div class="serp" style="margin-top:8px"><div class="url">' + e((P.info.url_situs || 'https://akun.github.io/portofolio/').replace(/admin\.html.*$/, '')) + '</div><div class="jdl" id="sp-j"></div><div class="dsk" id="sp-d"></div></div>' +
        '<div class="info-kotak kuning" style="margin-top:10px"><span class="ms">info</span><span>Pratinjau tautan di WhatsApp/Facebook/LinkedIn memakai teks statis di <code>index.html</code> (crawler media sosial tidak menjalankan JavaScript). Ubah juga tag <code>og:title</code> & <code>og:description</code> di berkas itu bila perlu.</span></div></div></div>';
      if (tab === 'tampilan') isi = '<div class="grid-form"><div class="bidang penuh"><label for="wu">Warna utama brand (tombol & aksen)</label><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><input type="color" id="wu-pick" value="' + e(v.warna_utama || '#2563EB') + '" style="width:56px;height:46px;border:0;background:none;padding:0" aria-label="Pilih warna"><input id="wu" name="warna_utama" value="' + e(v.warna_utama || '#2563EB') + '" maxlength="7" style="width:140px" class="mono"></div><span class="galat"></span></div>' +
        '<div class="penuh"><span class="label">Palet terverifikasi</span><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' + [['#2563EB', 'Royal Blue'], ['#1D4ED8', 'Biru Tua'], ['#0B1F3A', 'Navy'], ['#0F7B3F', 'Hijau'], ['#8A5A00', 'Ochre']].map(function (c) { return '<button type="button" class="btn btn-garis btn-kecil" data-warna="' + c[0] + '"><span style="width:16px;height:16px;border-radius:50%;background:' + c[0] + ';display:inline-block"></span>' + c[1] + '</button>'; }).join('') + '</div></div>' +
        '<div class="penuh"><span class="label">Uji kontras (WCAG AA ≥ 4,5 : 1 untuk teks normal)</span><div class="kontras" style="margin-top:8px"><span class="contoh" id="kt-c">Lihat Portofolio</span><span id="kt-n" class="lencana"></span></div><p class="bantu" id="kt-k" style="font-size:12.5px;color:var(--abu);margin-top:6px"></p></div></div>';
      if (tab === 'infobar') isi = '<div class="grid-form">' + b({ k: 'info_bar_tampil', label: 'Tampilkan info bar di atas navigasi', tipe: 'saklar', nilai: v.info_bar_tampil, penuh: true }) +
        b({ k: 'info_bar_email', label: 'Email publik', nilai: v.info_bar_email, tipe: 'email', bantu: 'Tampil di info bar & footer. Kosongkan bila tidak ingin email terlihat publik.' }) + b({ k: 'info_bar_telepon', label: 'Nomor telepon (opsional)', nilai: v.info_bar_telepon, maks: 20 }) +
        b({ k: 'info_bar_jam', label: 'Keterangan jam respons', nilai: v.info_bar_jam, maks: 60, penuh: true, placeholder: 'Respons dalam 1×24 jam' }) + '</div>';
      if (tab === 'notifikasi') isi = '<div class="grid-form">' + b({ k: 'email_notifikasi', label: 'Email penerima notifikasi pesan baru', nilai: v.email_notifikasi, tipe: 'email', wajib: true, bantu: 'Pesan dari formulir kontak dikirim ke email ini (MailApp, kuota Gmail ±100/hari).' }) +
        b({ k: 'wa_admin', label: 'Nomor WhatsApp Anda (opsional)', nilai: v.wa_admin, placeholder: '0812xxxxxxx', bantu: 'Untuk notifikasi WA ke Anda bila modul WhatsApp aktif.' }) +
        '<div class="penuh info-kotak"><span class="ms">tune</span><span>Saklar WhatsApp/Email, token Fonnte, dan isi template pesan diatur di menu <a href="#/notifikasi/konfigurasi">WA &amp; Notifikasi → Konfigurasi</a>.</span></div>' +
        b({ k: 'arsip_statistik_hari', label: 'Rangkum log statistik lebih tua dari (hari)', nilai: v.arsip_statistik_hari, tipe: 'number', atribut: ' min="30" max="365"', bantu: 'Log lama dirangkum per hari agar Sheets tetap ringan.' }) + '</div>';
      if (tab === 'tagihan') isi = '<div class="grid-form">' + b({ k: 'NAMA_USAHA', label: 'Nama penerbit tagihan & kwitansi', nilai: v.NAMA_USAHA, wajib: true, maks: 100 }) + b({ k: 'NAMA_PENANDATANGAN', label: 'Nama penanda tangan kwitansi', nilai: v.NAMA_PENANDATANGAN, maks: 100 }) +
        b({ k: 'ALAMAT_USAHA', label: 'Alamat (kota pertama dipakai di tanda tangan)', nilai: v.ALAMAT_USAHA, maks: 200, penuh: true }) + b({ k: 'REKENING_BANK', label: 'Rekening tujuan transfer', nilai: v.REKENING_BANK, maks: 200, penuh: true, placeholder: 'BRI 0123-01-000111-50-1 a.n. …' }) +
        b({ k: 'JATUH_TEMPO_TANGGAL', label: 'Tanggal jatuh tempo tagihan bulanan', nilai: v.JATUH_TEMPO_TANGGAL, tipe: 'number', atribut: ' min="1" max="28"' }) + b({ k: 'KWITANSI_PREFIX', label: 'Awalan nomor kwitansi', nilai: v.KWITANSI_PREFIX, maks: 6, bantu: 'Contoh hasil: KW-2026-000001' }) +
        b({ k: 'REMINDER_OTOMATIS', label: 'Pengingat jatuh tempo otomatis', tipe: 'saklar', nilai: v.REMINDER_OTOMATIS, penuh: true, bantu: 'Dikirim sekali sehari oleh trigger setelah jam di bawah.' }) +
        b({ k: 'REMINDER_JAM', label: 'Jam pengingat (WITA)', nilai: v.REMINDER_JAM, tipe: 'time' }) + '<div></div>' +
        b({ k: 'REMINDER_H3', label: 'Kirim pengingat H-3', tipe: 'saklar', nilai: v.REMINDER_H3 }) + b({ k: 'REMINDER_H0', label: 'Kirim pengingat hari H', tipe: 'saklar', nilai: v.REMINDER_H0 }) + '</div>';
      el.innerHTML = '<div class="kepala-hal"><div><h1>Pengaturan Sistem &amp; Portofolio</h1><p>Identitas situs, tampilan, kanal notifikasi, tagihan, dan keamanan akses.</p></div><div class="aksi"><span class="lencana ' + (nonaktif ? 'merah' : 'hijau') + '">' + (nonaktif ? 'Mode Pemeliharaan' : 'Produksi Aktif') + '</span></div></div>' +
        '<section class="panel" style="margin-bottom:20px;' + (nonaktif ? 'border:2px solid var(--merah)' : '') + '"><div class="baris-saklar" style="padding:0"><span><b>Status situs publik: ' + (nonaktif ? 'NONAKTIF (halaman pemeliharaan tampil)' : 'AKTIF') + '</b><small>Matikan untuk menampilkan halaman "Situs Sedang Diperbarui" kepada pengunjung. Formulir kontak juga ditutup.</small></span><label class="saklar"><input type="checkbox" id="st-situs"' + (nonaktif ? '' : ' checked') + ' aria-label="Situs aktif"><span></span></label></div></section>' +
        '<div class="tab" role="tablist">' + TAB.map(function (t) { return '<button type="button" role="tab" data-t="' + t[0] + '" aria-selected="' + (tab === t[0]) + '"><span class="ms" style="font-size:18px">' + t[2] + '</span>' + t[1] + '</button>'; }).join('') + '</div>' +
        '<section class="panel" id="p-set">' + (tab === 'keamanan' ? '<div id="keamanan">' + '<div class="skeleton" style="height:200px"></div></div>' : '<form id="f-set" novalidate>' + isi + '<div style="display:flex;justify-content:flex-end;margin-top:20px"><button class="btn btn-utama" type="submit"><span class="ms">save</span>Simpan Perubahan</button></div></form>') + '</section>';
      $$('[data-t]', el).forEach(function (x) { x.onclick = function () { tab = x.dataset.t; history.replaceState(null, '', '#/pengaturan/' + tab); gambar(A.S.cache.pengaturan); }; });
      $('#st-situs').onchange = function () {
        var on = this.checked, cb = this;
        A.konfirmasi(on ? 'Aktifkan situs?' : 'Aktifkan mode pemeliharaan?', on ? 'Landing page kembali tampil normal untuk semua pengunjung.' : 'Pengunjung akan melihat halaman "Situs Sedang Diperbarui" dan formulir kontak ditutup.', on ? 'Aktifkan' : 'Nonaktifkan situs', !on).then(function (ya) {
          if (!ya) { cb.checked = !on; return; }
          api('pengaturan.simpan', { nilai: { status_situs: on ? 'Aktif' : 'Nonaktif' } }).then(function (r) { toast(r.ok ? (on ? 'Situs aktif kembali.' : 'Mode pemeliharaan aktif.') : r.message, r.ok ? '' : 'galat'); muat(); });
        });
      };
      if (tab === 'keamanan') return keamanan();
      var f = $('#f-set');
      if (tab === 'situs') {
        var sp = function () { $('#sp-j').textContent = f.elements.judul_situs.value || '(tanpa judul)'; $('#sp-d').textContent = f.elements.meta_deskripsi.value; $('#hit-md').textContent = f.elements.meta_deskripsi.value.length; };
        f.addEventListener('input', sp); sp();
      }
      if (tab === 'tampilan') {
        var cek = function () {
          var h = f.elements.warna_utama.value.trim();
          if (!/^#[0-9a-f]{6}$/i.test(h)) { $('#kt-n').className = 'lencana merah'; $('#kt-n').textContent = 'HEX tidak valid'; return; }
          $('#wu-pick').value = h; var c = $('#kt-c'); c.style.background = h; c.style.color = '#fff';
          var k = kontras(h, '#FFFFFF'), lulus = k >= 4.5;
          $('#kt-n').className = 'lencana ' + (lulus ? 'hijau' : 'merah'); $('#kt-n').textContent = 'Kontras ' + k.toFixed(1).replace('.', ',') + ' : 1 — ' + (lulus ? 'Lolos WCAG AA' : 'Gagal WCAG AA');
          $('#kt-k').textContent = lulus ? 'Teks putih di atas warna ini mudah dibaca.' : 'Teks putih sulit dibaca di atas warna ini. Pilih warna yang lebih gelap.';
        };
        f.elements.warna_utama.addEventListener('input', cek); $('#wu-pick').addEventListener('input', function () { f.elements.warna_utama.value = this.value.toUpperCase(); cek(); });
        $$('[data-warna]', f).forEach(function (x) { x.onclick = function () { f.elements.warna_utama.value = x.dataset.warna; cek(); }; });
        cek();
      }
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var d = A.ambil(f), btn = $('button[type=submit]', f);
        Object.keys(d).forEach(function (k) { if (typeof d[k] === 'boolean') d[k] = d[k] ? 'YA' : 'TIDAK'; });
        if (tab === 'tampilan' && /^#[0-9a-f]{6}$/i.test(d.warna_utama) && kontras(d.warna_utama, '#FFFFFF') < 4.5) { toast('Warna ini gagal uji kontras WCAG AA. Pilih warna yang lebih gelap.', 'galat'); return; }
        A.sibuk(btn, true, 'Menyimpan…');
        api('pengaturan.simpan', { nilai: d }).then(function (r) {
          A.sibuk(btn, false);
          if (!r.ok) { A.tandaiGalat(f, r.data && r.data.galat); return toast(r.message, 'galat'); }
          Object.assign(A.S.cache.pengaturan.nilai, r.data || {}); toast(r.message);
        });
      });
    };
    var keamanan = function () {
      api('keamanan.info').then(function (r) {
        var w = $('#keamanan'); if (!w) return;
        if (!r.ok) { w.innerHTML = A.kosong('error', r.message); return; }
        var d = r.data, dasar = location.origin + location.pathname, url = dasar + '#k=' + d.kunciGerbang;
        w.innerHTML = '<div class="grid-form">' +
          '<div class="bidang"><label>Email Super Admin</label><input value="' + e(d.adminEmail) + '" readonly><span class="bantu">Diambil dari Script Properties <code>ADMIN_EMAIL</code>. Ubah lewat editor Apps Script bila perlu.</span></div>' +
          '<div class="bidang"><label>Sesi login</label><input value="' + d.sesiJam + ' jam (otomatis berakhir)" readonly></div>' +
          '<div class="bidang penuh"><label for="cid">Google OAuth Client ID</label><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="cid" value="' + e(d.googleClientId) + '" placeholder="xxxxxxxx.apps.googleusercontent.com" style="flex:1;min-width:240px" class="mono"><button class="btn btn-utama" type="button" id="simpan-cid"><span class="ms">save</span>Simpan</button></div>' +
          '<span class="bantu">Daftarkan origin <b class="mono">' + e(location.origin) + '</b> sebagai <i>Authorized JavaScript origins</i> di Google Cloud Console.</span><span class="galat"></span></div>' +
          '<div class="bidang penuh"><label>Alamat rahasia dashboard</label><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="url-rahasia" value="' + e(url) + '" readonly class="mono" style="flex:1;min-width:240px"><button class="btn btn-garis" type="button" id="salin-url"><span class="ms">content_copy</span>Salin</button><button class="btn btn-bahaya" type="button" id="ganti-kunci"><span class="ms">autorenew</span>Ganti Alamat</button></div>' +
          '<span class="bantu">Simpan di pengelola sandi. Alamat lama langsung tidak berlaku setelah diganti. Keamanan sebenarnya tetap pada login Google + pengecekan email di server.</span></div>' +
          '<div class="bidang penuh"><label>Token Fonnte (WhatsApp)</label><input value="' + e(d.fonnte.ada ? d.fonnte.samar : 'Belum diisi') + '" readonly class="mono"><span class="bantu">Ubah di <a href="#/notifikasi/konfigurasi">WA &amp; Notifikasi → Konfigurasi</a>. Token tersimpan di Script Properties, tidak pernah di Sheets.</span></div>' +
          '</div><div class="bagian-form" style="margin-top:20px"><h3><span class="ms">key</span>Sandi Akses Darurat</h3><p style="font-size:13px;color:var(--abu-2);margin-bottom:12px">Dipakai hanya bila login Google bermasalah. Nama pengguna: <b class="mono">' + e(d.daruratUser || 'darurat') + '</b>. Minimal 12 karakter berisi huruf &amp; angka.</p>' +
          '<form id="f-sandi" class="grid-form" novalidate>' + A.bidang({ k: 'sandiBaru', label: 'Sandi baru', tipe: 'password', atribut: ' autocomplete="new-password" minlength="12"' }) + A.bidang({ k: 'ulang', label: 'Ulangi sandi', tipe: 'password', atribut: ' autocomplete="new-password"' }) +
          '<div class="penuh" style="display:flex;justify-content:flex-end"><button class="btn btn-navy" type="submit"><span class="ms">lock_reset</span>Ganti Sandi Darurat</button></div></form></div>';
        $('#simpan-cid').onclick = function () {
          var b = this, v = $('#cid').value.trim(); A.sibuk(b, true);
          api('rahasia.simpan', { kunci: 'GOOGLE_CLIENT_ID', nilai: v || '__HAPUS__' }).then(function (x) { A.sibuk(b, false); toast(x.ok ? 'Client ID tersimpan. Login Google aktif pada kunjungan berikutnya.' : x.message, x.ok ? '' : 'galat'); });
        };
        $('#salin-url').onclick = function () { if (navigator.clipboard) navigator.clipboard.writeText($('#url-rahasia').value).then(function () { toast('Alamat rahasia disalin.'); }); };
        $('#ganti-kunci').onclick = function () {
          A.konfirmasi('Ganti alamat rahasia?', 'Alamat lama langsung tidak berlaku. Pastikan Anda menyimpan alamat baru sebelum menutup halaman ini.', 'Ganti alamat', true).then(function (ya) {
            if (!ya) return;
            api('keamanan.gantiKunci').then(function (x) {
              if (!x.ok) return toast(x.message, 'galat');
              try { sessionStorage.setItem('adm_k', x.data.kunciGerbang); } catch (z) {}
              $('#url-rahasia').value = dasar + '#k=' + x.data.kunciGerbang; $('#url-rahasia').select(); toast(x.message);
            });
          });
        };
        $('#f-sandi').onsubmit = function (ev) {
          ev.preventDefault(); var v = A.ambil(this), b = $('button', this), f = this;
          if (v.sandiBaru !== v.ulang) return A.tandaiGalat(f, { ulang: 'Sandi tidak sama' });
          A.sibuk(b, true);
          api('keamanan.sandiDarurat', { sandiBaru: v.sandiBaru }).then(function (x) { A.sibuk(b, false); if (!x.ok) return A.tandaiGalat(f, { sandiBaru: x.message }); f.reset(); toast(x.message); });
        };
      });
    };
    if (A.S.cache.pengaturan) gambar(A.S.cache.pengaturan);
    muat();
  } };

  /* =====================================================================
   * MIGRASI DATA DARI SITUS LAMA (gas-migrasi-database)
   * ===================================================================== */
  var BAGIAN = [['profil', 'Profil (nama, tagline, ringkasan, foto, CV)'], ['tentang', 'Pengalaman & Pendidikan → Tentang'], ['portofolio', 'Karya → Portofolio'], ['testimoni', 'Survei berkomentar → Testimoni (disembunyikan)'],
    ['kontak', 'Tautan sosial, email, WhatsApp → Kontak'], ['pengaturan', 'Nama situs, email notifikasi, WA → Pengaturan'], ['pesan', 'Pesan masuk'], ['statistik', 'Pengunjung harian → Statistik'], ['crm', 'CRM Kontak & Interaksi'],
    ['sertifikat', 'Sertifikat (PDF tetap privat; gambar dibuat sesudahnya di menu Sertifikat)'], ['agenda', 'Agenda kegiatan (termasuk pengulangan mingguan)'], ['kinerja', 'Kinerja harian (dengan foto)'], ['wawasan', 'Wawasan & Insight (artikel + jadwal terbit)']];
  A.MODUL.migrasi = { judul: 'Migrasi Data', ikon: 'move_up', render: function (el) {
    el.innerHTML = '<div class="kepala-hal"><div><h1>Migrasi dari Situs Lama (Fajarfk)</h1><p>Impor data dari spreadsheet situs lama. Aman diulang: data yang sama tidak digandakan. Spreadsheet lama <b>hanya dibaca</b>, tidak pernah diubah.</p></div></div>' +
      '<div class="grid-2 lebar-kiri"><section class="panel"><form id="f-mig" novalidate><div class="grid-form">' +
      A.bidang({ k: 'sumber', label: 'URL atau ID spreadsheet lama', penuh: true, wajib: true, placeholder: 'https://docs.google.com/spreadsheets/d/…/edit', bantu: 'Harus milik akun Google yang sama dengan app ini agar foto & berkas Drive lama tetap terbaca.' }) +
      '<div class="penuh"><span class="label">Data yang diimpor</span><div style="display:grid;gap:8px;margin-top:8px">' + BAGIAN.map(function (b) { return '<label style="display:flex;gap:10px;align-items:center;font-size:14px"><input type="checkbox" class="cek" data-bagian="' + b[0] + '" checked>' + e(b[1]) + '</label>'; }).join('') + '</div></div>' +
      A.bidang({ k: 'timpa', label: 'Timpa data yang sudah ada', tipe: 'saklar', penuh: true, bantu: 'Mati (disarankan): perubahan yang sudah Anda buat di app baru tidak ditimpa data lama.' }) +
      '</div><div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap"><button class="btn btn-garis" type="button" id="b-pindai"><span class="ms">search</span>Pindai (Dry-run)</button><button class="btn btn-utama" type="button" id="b-jalan"><span class="ms">play_arrow</span>Jalankan Impor</button></div></form></section>' +
      '<aside class="panel"><div class="panel-kepala"><div><h2><span class="ms">checklist</span>Langkah Pindah (Cutover)</h2></div></div><ol style="padding-left:18px;font-size:14px;color:var(--abu-2);display:flex;flex-direction:column;gap:8px">' +
      '<li><b>Pindai</b> dulu untuk melihat jumlah data tanpa menulis apa pun.</li><li><b>Jalankan Impor</b>, lalu periksa Profil, Portofolio, dan Kontak.</li><li>Setujui testimoni hasil impor (default disembunyikan).</li><li>Tepat sebelum mengumumkan alamat baru, <b>jalankan impor sekali lagi</b> untuk menangkap pesan/data terbaru.</li><li>Bila Sertifikat ikut diimpor: buka menu <b>Sertifikat → Buat gambar dari PDF</b> agar tampil di situs.</li><li>Jangan hapus situs lama: data di luar cakupan (produk &amp; pesanan) tetap ada di sana.</li></ol></aside></div>' +
      '<section class="panel" id="hasil-mig" style="margin-top:20px" hidden></section>';
    var f = $('#f-mig');
    var jalan = function (dry, b) {
      var v = A.ambil(f), bagian = $$('[data-bagian]', f).filter(function (c) { return c.checked; }).map(function (c) { return c.dataset.bagian; });
      if (!v.sumber.trim()) return A.tandaiGalat(f, { sumber: 'Tempel URL spreadsheet lama' });
      if (!bagian.length) return toast('Pilih minimal satu jenis data.', 'galat');
      A.sibuk(b, true, dry ? 'Memindai…' : 'Mengimpor…');
      api(dry ? 'migrasi.pindai' : 'migrasi.jalankan', { sumber: v.sumber.trim(), bagian: bagian, timpa: v.timpa }, { timeout: 330000 }).then(function (r) {
        A.sibuk(b, false);
        if (!r.ok) return toast(r.message, 'galat');
        var d = r.data, h = $('#hasil-mig'); h.hidden = false;
        var nama = {}; BAGIAN.forEach(function (x) { nama[x[0]] = x[1]; }); nama.crmInteraksi = 'CRM Interaksi';
        h.innerHTML = '<div class="panel-kepala"><div><h2><span class="ms">' + (dry ? 'search' : 'task_alt') + '</span>' + (dry ? 'Hasil Pindai (belum ada yang ditulis)' : 'Impor Selesai') + '</h2><p>Sumber: ' + e(d.sumber.nama) + '</p></div>' + (dry ? '<span class="lencana kuning">Dry-run</span>' : '<span class="lencana hijau">Tersimpan</span>') + '</div>' +
          '<div class="tabel-wadah"><table class="tabel"><thead><tr><th>Data</th><th style="text-align:right">Di sumber</th><th style="text-align:right">Ditambah</th><th style="text-align:right">Diperbarui</th><th style="text-align:right">Dilewati</th></tr></thead><tbody>' +
          Object.keys(d.laporan).map(function (k) { var x = d.laporan[k]; return '<tr><td>' + e(nama[k] || k) + (x.kolom && x.kolom.length ? '<br><small style="color:var(--abu)">kolom: ' + e(x.kolom.join(', ')) + '</small>' : '') + '</td><td style="text-align:right">' + x.sumber + '</td><td style="text-align:right;color:var(--hijau);font-weight:700">' + x.ditambah + '</td><td style="text-align:right;color:var(--utama-hover);font-weight:700">' + x.diperbarui + '</td><td style="text-align:right;color:var(--abu)">' + x.dilewati + '</td></tr>'; }).join('') +
          '</tbody></table></div>' + (d.peringatan.length ? '<div class="info-kotak kuning" style="margin-top:16px;flex-direction:column"><b><span class="ms" style="vertical-align:-5px">warning</span> Peringatan (' + d.peringatan.length + ')</b><ul style="margin:6px 0 0;padding-left:18px">' + d.peringatan.map(function (p) { return '<li>' + e(p) + '</li>'; }).join('') + '</ul></div>' : '') +
          (!dry && d.berkasDibagikan ? '<p style="font-size:13px;color:var(--abu);margin-top:10px">' + d.berkasDibagikan + ' berkas Drive lama diatur "siapa pun yang memiliki link dapat melihat" agar tampil di situs.</p>' : '');
        if (!dry) { A.S.cache = {}; toast(r.message); }
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };
    $('#b-pindai').onclick = function () { jalan(true, this); };
    $('#b-jalan').onclick = function () { var b = this; A.konfirmasi('Jalankan impor?', 'Data dari spreadsheet lama akan ditulis ke database app ini. Aman diulang; data yang sama tidak digandakan.', 'Jalankan impor').then(function (ya) { if (ya) jalan(false, b); }); };
  } };

  /* =====================================================================
   * STATUS SISTEM
   * ===================================================================== */
  A.MODUL.sistem = { judul: 'Status Sistem', ikon: 'monitor_heart', render: function (el) {
    api('sistem.status').then(function (r) {
      if (!r.ok) { el.innerHTML = A.kosong('error', r.message); return; }
      var d = r.data, baris = function (ik, l, v) { return '<div class="status-baris"><span><span class="ms">' + ik + '</span>' + e(l) + '</span><span>' + v + '</span></div>'; };
      var ya = function (b) { return b ? '<span class="lencana hijau">Ada</span>' : '<span class="lencana merah">Kosong</span>'; };
      el.innerHTML = '<div class="kepala-hal"><div><h1>Status Sistem</h1><p>Kesehatan backend Apps Script, trigger, kuota, dan Script Properties (hanya ada/tidak — nilai rahasia tidak pernah ditampilkan).</p></div><div class="aksi"><a class="btn btn-garis" href="' + e(API.urlAman(d.spreadsheetUrl)) + '" target="_blank" rel="noopener"><span class="ms">table_chart</span>Buka Spreadsheet</a><button class="btn btn-utama" type="button" id="b-antre"><span class="ms">send</span>Proses Antrean Notifikasi</button></div></div>' +
        (d.sheetHilang.length ? '<div class="info-kotak merah" style="margin-bottom:16px"><span class="ms">error</span><span>Sheet hilang: ' + e(d.sheetHilang.join(', ')) + '. Jalankan <code>setupAppEnvironment()</code> di editor Apps Script.</span></div>' : '') +
        (!d.triggerAktif ? '<div class="info-kotak kuning" style="margin-bottom:16px"><span class="ms">warning</span><span>Trigger <code>tikMenit</code> belum aktif: pengingat otomatis, arsip statistik, dan pengiriman cadangan tidak berjalan. Jalankan <code>nyalakanKeepWarm()</code> di editor.</span></div>' : '') +
        '<div class="grid-2 sama"><section class="panel"><div class="panel-kepala"><div><h2><span class="ms">dns</span>Backend</h2></div></div>' +
        baris('tag', 'Versi aplikasi', '<b>' + e(d.versi) + '</b> · skema ' + e(d.skemaVersi)) + baris('schedule', 'Waktu server', e(d.waktuServer) + ' (' + e(d.zonaWaktu) + ')') +
        baris('timer', 'Trigger tikMenit (5 menit)', d.triggerAktif ? '<span class="lencana hijau">Aktif</span>' : '<span class="lencana merah">Mati</span>') +
        baris('mail', 'Sisa kuota email hari ini', d.kuotaEmail < 0 ? '–' : '<b>' + d.kuotaEmail + '</b>') +
        baris('local_fire_department', 'Pemanasan cache terakhir', d.warmTerakhir ? e(API.relatif(d.warmTerakhir.at)) : '–') +
        baris('inventory_2', 'Arsip statistik terakhir', e(d.arsipStatistikTerakhir)) +
        baris('notifications', 'Antrean notifikasi', d.antreanNotif ? '<span class="lencana kuning">Ada antrean</span>' : '<span class="lencana hijau">Kosong</span>') +
        baris('public', 'Status situs', A.lencana(d.statusSitus)) + '</section>' +
        '<section class="panel"><div class="panel-kepala"><div><h2><span class="ms">key</span>Script Properties</h2><p>Hanya keberadaan, bukan nilainya.</p></div></div>' +
        Object.keys(d.properti).map(function (k) { return baris(/SECRET|HASH|TOKEN|KEY/.test(k) ? 'lock' : 'settings', k, ya(d.properti[k])); }).join('') + '</section></div>' +
        '<section class="panel" style="margin-top:20px"><div class="panel-kepala"><div><h2><span class="ms">table_rows</span>Isi Database</h2><p>Jumlah baris data per sheet.</p></div></div><div class="tabel-wadah"><table class="tabel"><thead><tr><th>Sheet</th><th style="text-align:right">Baris</th></tr></thead><tbody>' +
        Object.keys(d.sheet).map(function (k) { return '<tr><td>' + e(k) + '</td><td style="text-align:right" class="mono">' + A.angka(d.sheet[k]) + '</td></tr>'; }).join('') + '</tbody></table></div></section>';
      $('#b-antre').onclick = function () { var b = this; A.sibuk(b, true); api('notif.prosesSekarang').then(function (x) { A.sibuk(b, false); toast(x.ok ? (x.data.info + ': ' + x.data.terkirim + ' terkirim, ' + x.data.gagal + ' gagal') : x.message, x.ok ? '' : 'galat'); }); };
    });
  } };
})();