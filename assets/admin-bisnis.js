/*
 * admin-bisnis.js — modul tambahan:
 *  • Klien & Tagihan (skill gas-tagihan-pembayaran): klien, terbit bulanan/sekali, verifikasi per bukti, pengingat, kwitansi
 *  • WA & Notifikasi (skill gas-notifikasi-wa-crm): blast per batch, antrean, konfigurasi + matriks event
 *  • CRM Kontak: satu daftar Nama · Email · WhatsApp dari formulir kontak, klien, dan impor CSV
 */
(function () {
  'use strict';
  var A = window.ADM, $ = A.$, $$ = A.$$, e = A.e, api = A.api, toast = A.toast, rp = function (n) { return API.rupiah(n); };
  function tab(el, daftar, aktif, ke) {
    return '<div class="tab" role="tablist">' + daftar.map(function (t) { return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (aktif === t[0]) + '"><span class="ms" style="font-size:18px">' + t[2] + '</span>' + e(t[1]) + (t[3] !== undefined ? '<span class="jumlah">' + t[3] + '</span>' : '') + '</button>'; }).join('') + '</div>';
  }
  function salin(t, pesan) { if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast(pesan || 'Disalin.'); }, function () { toast(t, 'info'); }); else toast(t, 'info'); }
  function waLink(hp, teks) { var n = String(hp || '').replace(/\D/g, '').replace(/^0/, '62'); return 'https://wa.me/' + n + (teks ? '?text=' + encodeURIComponent(teks) : ''); }
  function bulanLabel(p) { var m = String(p).match(/^(\d{4})-(\d{2})/); return m ? API.BULAN_PANJANG[+m[2] - 1] + ' ' + m[1] : p; }

  /* =====================================================================
   * KLIEN & TAGIHAN
   * ===================================================================== */
  A.MODUL.tagihan = { judul: 'Klien & Tagihan', ikon: 'receipt_long', render: function (el, param) {
    var aktif = (param && param[0]) || 'klien', K = null, T = null, filterT = { status: '', jenis: '', periode: '', cari: '' }, pilihT = {};
    var muat = function () {
      Promise.all([api('klien.list'), api('tagihan.list', {}), api('tagihan.menunggu')]).then(function (r) {
        if (A.S.rute !== 'tagihan') return;
        if (!r[0].ok) { el.innerHTML = A.kosong('error', r[0].message); return; }
        K = r[0].data; T = r[1].ok ? r[1].data : { rows: [], ringkasan: {} }; A.S.cache.menunggu = r[2].ok ? r[2].data : [];
        gambar();
      });
    };
    var gambar = function () {
      var g = T.ringkasan || {}, menunggu = {};
      A.S.cache.menunggu.forEach(function (b) { menunggu[b.grup] = 1; });
      el.innerHTML = '<div class="kepala-hal"><div><h1>Klien &amp; Tagihan</h1><p>Tagihan jasa untuk klien. Klien membayar & mengunduh kwitansi lewat tautan pribadi — tanpa akun.</p></div><div class="aksi"><button class="btn btn-garis" type="button" id="t-klien"><span class="ms">person_add</span>Tambah Klien</button><button class="btn btn-utama" type="button" id="t-terbit"><span class="ms">post_add</span>Terbitkan Tagihan</button></div></div>' +
        '<div class="grid-kpi"><div class="panel kpi"><div class="atas">Klien aktif<span class="ms">groups</span></div><b>' + K.rows.filter(function (k) { return k.status === 'Aktif'; }).length + '</b><small>' + K.rows.length + ' total klien</small></div>' +
        '<div class="panel kpi"><div class="atas">Tunggakan<span class="ms">pending_actions</span></div><b style="font-size:22px">' + rp(g.tunggakan) + '</b><small>' + (g.jumlahBelum || 0) + ' tagihan belum dibayar</small></div>' +
        '<div class="panel kpi"><div class="atas">Terkumpul<span class="ms">savings</span></div><b style="font-size:22px">' + rp(g.terkumpul) + '</b><small>' + (g.jumlahLunas || 0) + ' tagihan lunas</small></div>' +
        '<button class="panel kpi ' + (Object.keys(menunggu).length ? 'sorot' : '') + '" type="button" id="k-verif"><div class="atas">Menunggu verifikasi<span class="ms">fact_check</span></div><b>' + Object.keys(menunggu).length + '</b><small>bukti transfer</small></button></div>' +
        (K.adaUrlSitus ? '' : '<div class="info-kotak kuning" style="margin-bottom:16px"><span class="ms">warning</span><span>URL situs belum diketahui, sehingga tautan bayar klien belum bisa dibuat. Login sekali lewat alamat GitHub Pages Anda (bukan file lokal) agar terisi otomatis.</span></div>') +
        tab(el, [['klien', 'Klien', 'groups', K.rows.length], ['tagihan', 'Tagihan', 'receipt', T.rows.length], ['verifikasi', 'Verifikasi', 'fact_check', Object.keys(menunggu).length], ['pengingat', 'Pengingat', 'notifications_active']], aktif) +
        '<section class="panel" id="isi-tab"></section>';
      $$('[data-tab]', el).forEach(function (b) { b.onclick = function () { aktif = b.dataset.tab; history.replaceState(null, '', '#/tagihan/' + aktif); gambar(); }; });
      $('#t-klien').onclick = function () { formKlien({}); };
      $('#t-terbit').onclick = terbit;
      $('#k-verif').onclick = function () { aktif = 'verifikasi'; gambar(); };
      ({ klien: tabKlien, tagihan: tabTagihan, verifikasi: tabVerif, pengingat: tabPengingat })[aktif]($('#isi-tab'));
    };

    /* ---------- tab Klien ---------- */
    var tabKlien = function (w) {
      w.innerHTML = K.rows.length ? '<div class="tabel-wadah"><table class="tabel"><thead><tr><th>Klien</th><th>Kontak</th><th style="text-align:right">Tarif bulanan</th><th style="text-align:right">Tunggakan</th><th>Status</th><th class="aksi">Aksi</th></tr></thead><tbody>' +
        K.rows.map(function (k) {
          return '<tr data-id="' + e(k.id) + '" class="' + (k.status !== 'Aktif' ? 'redup' : '') + '"><td class="sel-utama"><b>' + e(k.nama) + '</b><small>' + e(k.instansi || '–') + '</small></td><td class="sel-utama"><small>' + e(k.email || '–') + '</small><small>' + e(k.no_wa || '–') + '</small></td>' +
            '<td style="text-align:right" class="mono">' + rp(k.tarif_bulanan) + '</td><td style="text-align:right">' + (k.tunggakan ? '<b style="color:var(--merah)">' + rp(k.tunggakan) + '</b><br><small style="color:var(--abu)">' + k.nBelum + ' tagihan</small>' : '<span class="lencana hijau">Lunas</span>') + (k.menunggu ? '<br><span class="lencana kuning">' + k.menunggu + ' menunggu</span>' : '') + '</td>' +
            '<td>' + A.lencana(k.status) + '</td><td class="aksi"><button class="btn btn-ikon mini" type="button" data-a="tautan" title="Tautan bayar" aria-label="Tautan bayar"><span class="ms">link</span></button><button class="btn btn-ikon mini" type="button" data-a="testi" title="Minta testimoni" aria-label="Minta testimoni dari ' + e(k.nama) + '"><span class="ms">rate_review</span></button><button class="btn btn-ikon mini" type="button" data-a="riwayat" title="Riwayat" aria-label="Riwayat"><span class="ms">history</span></button><button class="btn btn-ikon mini" type="button" data-a="ubah" aria-label="Ubah"><span class="ms">edit</span></button><button class="btn btn-ikon mini merah" type="button" data-a="hapus" aria-label="Hapus"><span class="ms">delete</span></button></td></tr>';
        }).join('') + '</tbody></table></div>' : A.kosong('groups', 'Belum ada klien. Tambahkan klien jasa Anda untuk mulai menerbitkan tagihan.', '<button class="btn btn-utama btn-kecil" type="button" id="k-tambah2"><span class="ms">person_add</span>Tambah Klien</button>');
      if ($('#k-tambah2', w)) $('#k-tambah2', w).onclick = function () { formKlien({}); };
      w.onclick = function (ev) {
        var b = ev.target.closest('[data-a]'); if (!b) return;
        var k = K.rows.filter(function (x) { return x.id === b.closest('tr').dataset.id; })[0];
        if (b.dataset.a === 'ubah') formKlien(k);
        if (b.dataset.a === 'tautan') tautan(k, false);
        if (b.dataset.a === 'testi') mintaTesti(k);
        if (b.dataset.a === 'riwayat') riwayat(k);
        if (b.dataset.a === 'hapus') A.konfirmasi('Hapus klien ' + k.nama + '?', 'Klien yang sudah punya tagihan hanya dinonaktifkan agar riwayat pembayaran tetap utuh.', 'Hapus', true).then(function (ya) { if (ya) api('klien.hapus', { id: k.id }).then(function (r) { toast(r.message, r.ok ? '' : 'galat'); muat(); }); });
      };
    };
    var formKlien = function (k) {
      A.modal({ judul: k.id ? 'Ubah Klien' : 'Tambah Klien', isi: '<form id="f-kl" class="grid-form" novalidate>' + A.bidang({ k: 'nama', label: 'Nama klien / PIC', nilai: k.nama, wajib: true, maks: 100 }) + A.bidang({ k: 'instansi', label: 'Instansi / perusahaan', nilai: k.instansi, maks: 120 }) +
        A.bidang({ k: 'email', label: 'Email', tipe: 'email', nilai: k.email }) + A.bidang({ k: 'no_wa', label: 'Nomor WhatsApp', nilai: k.no_wa, placeholder: '0812xxxxxxx' }) +
        A.bidang({ k: 'tarif_bulanan', label: 'Tarif bulanan (Rp)', nilai: k.tarif_bulanan, atribut: ' inputmode="numeric"', bantu: 'Dipakai saat menerbitkan tagihan bulanan. Isi 0 bila hanya tagihan sekali bayar.' }) +
        A.bidang({ k: 'status', label: 'Status', tipe: 'select', nilai: k.status || 'Aktif', opsi: ['Aktif', 'Nonaktif'] }) + A.bidang({ k: 'catatan', label: 'Catatan internal', tipe: 'textarea', nilai: k.catatan, maks: 500, penuh: true, baris: 3 }) + '</form>',
        tombol: [{ teks: 'Batal' }, { teks: '<span class="ms">save</span>Simpan', kelas: 'btn-utama', aksi: function (m) {
          var f = $('#f-kl', m.isi), d = A.ambil(f); d.tarif_bulanan = String(d.tarif_bulanan).replace(/[^\d]/g, '') || 0; if (k.id) d.id = k.id;
          return api('klien.simpan', { data: d }).then(function (r) { if (!r.ok) { A.tandaiGalat(f, r.data && r.data.galat); toast(r.message, 'galat'); return false; } toast(r.message); muat(); });
        } }] });
    };
    var tautan = function (k, putar) {
      api('klien.tautan', { id: k.id, putar: putar }).then(function (r) {
        if (!r.ok) return toast(r.message, 'galat');
        var url = r.data.url, teks = 'Halo ' + k.nama + ', berikut tautan untuk melihat tagihan, mengirim bukti pembayaran, dan mengunduh kwitansi: ' + url;
        var m = A.modal({ judul: 'Tautan Bayar — ' + k.nama, isi: '<p style="color:var(--abu-2);font-size:14px">Tautan pribadi ini bisa dibuka klien tanpa login. Jangan bagikan ke orang lain; buat tautan baru bila bocor.</p><input class="input mono" readonly value="' + e(url) + '" id="url-kl" style="font-size:12.5px">' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-utama btn-kecil" type="button" id="s-url"><span class="ms">content_copy</span>Salin</button>' + (k.no_wa ? '<a class="btn btn-hijau btn-kecil" target="_blank" rel="noopener" href="' + e(waLink(k.no_wa, teks)) + '"><span class="ms">chat</span>Kirim via WhatsApp</a>' : '') +
          (k.email ? '<a class="btn btn-garis btn-kecil" href="mailto:' + e(k.email) + '?subject=' + encodeURIComponent('Tautan tagihan') + '&body=' + encodeURIComponent(teks) + '"><span class="ms">mail</span>Kirim via Email</a>' : '') + '<a class="btn btn-garis btn-kecil" href="' + e(url) + '" target="_blank" rel="noopener"><span class="ms">open_in_new</span>Buka</a></div>' +
          '<div class="info-kotak kuning"><span class="ms">autorenew</span><span>Buat tautan baru bila tautan lama tersebar. Tautan lama langsung tidak berlaku. <button class="btn btn-teks" type="button" id="putar">Buat tautan baru</button></span></div>', tombol: [{ teks: 'Tutup' }] });
        $('#s-url', m.isi).onclick = function () { salin(url, 'Tautan disalin.'); };
        $('#putar', m.isi).onclick = function () { A.konfirmasi('Buat tautan baru?', 'Tautan lama milik ' + k.nama + ' tidak akan berlaku lagi.', 'Buat baru', true).then(function (ya) { if (ya) { m.tutup(); tautan(k, true); } }); };
      });
    };
    /** tautan pribadi formulir testimoni — berbeda dari tautan bayar (tidak membuka halaman tagihan) */
    var mintaTesti = function (k) {
      api('klien.tautanTesti', { id: k.id }).then(function (r) {
        if (!r.ok) return toast(A.pesanBelumDeploy ? A.pesanBelumDeploy(r) : r.message, 'galat');
        var url = r.data.url, sapa = 'Halo ' + k.nama + ', terima kasih atas kerja samanya. Bila berkenan, mohon kesediaannya memberi testimoni singkat tentang pengalaman bekerja sama dengan saya' + (k.instansi ? ' (sebagai pribadi atau atas nama ' + k.instansi + ')' : '') + '. Testimoni hanya ditampilkan di situs portofolio saya dengan persetujuan Anda: ' + url;
        var m = A.modal({ judul: 'Minta Testimoni — ' + k.nama, isi: '<p style="color:var(--abu-2);font-size:14px">Tautan pribadi ini membuka formulir testimoni dengan nama' + (k.instansi ? ' dan instansi' : '') + ' klien sudah terisi, dan ditandai <b>Klien</b> di antrean Anda. Testimoni tetap menunggu persetujuan Anda sebelum tampil.</p>' +
          '<input class="input mono" readonly value="' + e(url) + '" style="font-size:12.5px" aria-label="Tautan testimoni">' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-utama btn-kecil" type="button" id="s-testi"><span class="ms">content_copy</span>Salin tautan</button>' + (k.no_wa ? '<a class="btn btn-hijau btn-kecil" target="_blank" rel="noopener" href="' + e(waLink(k.no_wa, sapa)) + '"><span class="ms">chat</span>Kirim via WhatsApp</a>' : '') +
          (k.email ? '<a class="btn btn-garis btn-kecil" href="mailto:' + e(k.email) + '?subject=' + encodeURIComponent('Permohonan testimoni') + '&body=' + encodeURIComponent(sapa) + '"><span class="ms">mail</span>Kirim via Email</a>' : '') + '<a class="btn btn-garis btn-kecil" href="' + e(url) + '" target="_blank" rel="noopener"><span class="ms">open_in_new</span>Buka</a></div>' +
          (r.data.mode === 'Nonaktif' ? '<div class="info-kotak kuning"><span class="ms">lock</span><span>Formulir testimoni sedang <b>Nonaktif</b>, jadi tautan ini belum bisa dipakai. Ubah di menu <a href="#/testimoni">Testimoni</a>.</span></div>' : '') +
          '<div class="info-kotak"><span class="ms">shield</span><span>Tautan ini tidak membuka halaman tagihan klien. Bila Anda membuat tautan bayar baru untuk klien ini, tautan testimoni lama ikut tidak berlaku.</span></div>', tombol: [{ teks: 'Tutup' }] });
        $('#s-testi', m.isi).onclick = function () { salin(url, 'Tautan testimoni disalin.'); };
      });
    };
    var riwayat = function (k) {
      var l = A.laci({ judul: 'Riwayat — ' + k.nama, isi: '<div class="skeleton" style="height:200px"></div>' });
      api('tagihan.riwayat', { klienId: k.id }).then(function (r) {
        if (!r.ok) { l.badan.innerHTML = A.kosong('error', r.message); return; }
        var d = r.data, g = d.ringkasan;
        l.badan.innerHTML = '<div class="grid-kpi" style="grid-template-columns:repeat(2,1fr);margin:0"><div class="panel kpi" style="box-shadow:none;background:var(--permukaan-rendah)"><div class="atas">Lunas</div><b style="font-size:18px">' + rp(g.lunas) + '</b></div><div class="panel kpi" style="box-shadow:none;background:var(--permukaan-rendah)"><div class="atas">Tunggakan</div><b style="font-size:18px;color:var(--merah)">' + rp(g.tunggakan) + '</b></div></div>' +
          '<h4 style="font-size:15px">Tagihan</h4>' + (d.tagihan.length ? d.tagihan.map(function (t) { return '<div class="status-baris"><span style="flex-direction:column;align-items:flex-start;gap:0"><b style="color:var(--navy)">' + e(t.nama_tagihan) + '</b><small>Jatuh tempo ' + e(API.tgl(t.jatuh_tempo)) + '</small></span><span style="text-align:right">' + rp(t.jumlah) + '<br>' + A.lencana(t.status) + '</span></div>'; }).join('') : '<p style="color:var(--abu)">Belum ada tagihan.</p>') +
          '<h4 style="font-size:15px">Pembayaran</h4>' + (d.transaksi.length ? d.transaksi.map(function (x) {
            return '<div class="grup-bukti"><a class="bukti-thumb" href="' + e(x.buktiUrl) + '" target="_blank" rel="noopener" title="Lihat bukti"><img src="' + e(x.buktiThumb) + '" alt="Bukti" style="width:64px;height:64px;border-radius:10px;object-fit:cover" referrerpolicy="no-referrer" onerror="this.outerHTML=\'<span class=ms>description</span>\'"></a><div class="rinci"><b>' + rp(x.jumlah) + '</b> ' + A.lencana(x.status) + '<br><small style="color:var(--abu)">' + e(API.tgl(x.tanggal_bayar)) + ' · ' + e(x.metode) + (x.no_referensi ? ' · ref ' + e(x.no_referensi) : '') + '</small><br><small>' + e(x.item.map(function (i) { return i.nama_tagihan; }).join(', ')) + '</small>' +
              (x.no_kwitansi ? '<br><button class="btn btn-teks" type="button" data-kw="' + e(x.pembayaranId) + '"><span class="ms">download</span>Kwitansi ' + e(x.no_kwitansi) + '</button>' : '') + '</div></div>';
          }).join('') : '<p style="color:var(--abu)">Belum ada pembayaran.</p>');
        $$('[data-kw]', l.badan).forEach(function (b) { b.onclick = function () { unduhKw(b.dataset.kw, b); }; });
      });
    };
    var unduhKw = function (pid, b) {
      A.sibuk(b, true);
      api('tagihan.kwitansi', { pembayaranId: pid }).then(function (r) { if (!r.ok) throw new Error(r.message); return Kwitansi.unduh(r.data); })
        .then(function () { A.sibuk(b, false); toast('Kwitansi diunduh.'); }).catch(function (x) { A.sibuk(b, false); toast(x.message, 'galat'); });
    };

    /* ---------- tab Tagihan ---------- */
    var tabTagihan = function (w) {
      var rows = T.rows.filter(function (t) {
        return (!filterT.status || t.status === filterT.status) && (!filterT.jenis || t.jenis === filterT.jenis) && (!filterT.periode || t.periode === filterT.periode) &&
          (!filterT.cari || [t.nama, t.instansi, t.nama_tagihan, t.kode_tagihan].join(' ').toLowerCase().indexOf(filterT.cari.toLowerCase()) > -1);
      });
      w.innerHTML = '<div class="alat"><span class="cari"><span class="ms">search</span><input class="input" id="tg-cari" placeholder="Cari klien atau tagihan" value="' + e(filterT.cari) + '" aria-label="Cari"></span>' +
        '<select class="input" id="tg-st" aria-label="Status"><option value="">Semua status</option>' + ['Belum Bayar', 'Terlambat', 'Menunggu Verifikasi', 'Lunas', 'Gratis'].map(function (s) { return '<option' + (filterT.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
        '<select class="input" id="tg-jn" aria-label="Jenis"><option value="">Semua jenis</option><option' + (filterT.jenis === 'Bulanan' ? ' selected' : '') + '>Bulanan</option><option' + (filterT.jenis === 'Sekali' ? ' selected' : '') + '>Sekali</option></select>' +
        '<input class="input" type="month" id="tg-per" value="' + e(filterT.periode) + '" aria-label="Periode"><button class="btn btn-garis btn-kecil" type="button" id="tg-xlsx"><span class="ms">table_view</span>Ekspor + tautan bukti</button></div>' +
        (rows.length ? '<div class="tabel-wadah"><table class="tabel"><thead><tr><th style="width:36px"></th><th>Klien</th><th>Tagihan</th><th>Jatuh tempo</th><th style="text-align:right">Jumlah</th><th>Status</th><th class="aksi">Aksi</th></tr></thead><tbody>' +
          rows.map(function (t) {
            var bisa = t.status === 'Belum Bayar' || t.status === 'Terlambat' || t.status === 'Gratis';
            return '<tr data-id="' + e(t.id) + '"><td>' + (bisa ? '<input type="checkbox" data-pilih' + (pilihT[t.id] ? ' checked' : '') + ' aria-label="Pilih">' : '') + '</td><td class="sel-utama"><b>' + e(t.nama) + '</b><small>' + e(t.instansi) + '</small></td><td class="sel-utama"><b>' + e(t.nama_tagihan) + '</b><small>' + e(t.jenis) + ' · ' + e(t.kode_tagihan) + '</small></td><td>' + e(API.tgl(t.jatuh_tempo)) + '</td>' +
              '<td style="text-align:right"><b>' + rp(t.jumlah) + '</b>' + (Number(t.potongan) ? '<br><small style="color:var(--abu);text-decoration:line-through">' + rp(t.jumlah_asal) + '</small>' : '') + '</td><td>' + A.lencana(t.status) + (t.keterangan ? '<br><small style="color:var(--abu)">' + e(t.keterangan) + '</small>' : '') + '</td>' +
              '<td class="aksi">' + (bisa && t.status !== 'Gratis' ? '<button class="btn btn-ikon mini" type="button" data-a="nominal" title="Ubah nominal" aria-label="Ubah nominal"><span class="ms">sell</span></button>' : '') + '</td></tr>';
          }).join('') + '</tbody></table></div>' : A.kosong('receipt', T.rows.length ? 'Tidak ada tagihan yang cocok dengan filter.' : 'Belum ada tagihan. Klik "Terbitkan Tagihan".')) +
        '<div class="bilah-pilih" id="tg-bilah" hidden><b id="tg-n">0</b> dipilih<span style="flex:1"></span><button class="btn btn-bahaya btn-kecil" type="button" id="tg-batal"><span class="ms">block</span>Batalkan Terbit</button></div>';
      var segar = function () { var n = Object.keys(pilihT).length; $('#tg-bilah').hidden = !n; $('#tg-n').textContent = n; };
      segar();
      var tm;
      $('#tg-cari').oninput = function () { var v = this.value; clearTimeout(tm); tm = setTimeout(function () { filterT.cari = v; tabTagihan(w); var c = $('#tg-cari'); c.focus(); c.setSelectionRange(v.length, v.length); }, 300); };
      $('#tg-st').onchange = function () { filterT.status = this.value; tabTagihan(w); };
      $('#tg-jn').onchange = function () { filterT.jenis = this.value; tabTagihan(w); };
      $('#tg-per').onchange = function () { filterT.periode = this.value; tabTagihan(w); };
      w.onchange = function (ev) { if (!ev.target.matches('[data-pilih]')) return; var id = ev.target.closest('tr').dataset.id; if (ev.target.checked) pilihT[id] = 1; else delete pilihT[id]; segar(); };
      w.onclick = function (ev) {
        var b = ev.target.closest('[data-a="nominal"]'); if (!b) return;
        var t = T.rows.filter(function (x) { return x.id === b.closest('tr').dataset.id; })[0];
        A.modal({ judul: 'Ubah Nominal — ' + t.nama_tagihan, isi: '<p style="color:var(--abu-2);font-size:14px">' + e(t.nama) + ' · nominal awal ' + rp(t.jumlah_asal || t.jumlah) + '</p><form id="f-nom" class="grid-form" novalidate>' + A.bidang({ k: 'jumlahBaru', label: 'Nominal baru (Rp)', nilai: t.jumlah, atribut: ' inputmode="numeric"', bantu: 'Isi 0 untuk membebaskan (status Gratis).' }) + A.bidang({ k: 'alasan', label: 'Alasan', wajib: true, maks: 200, placeholder: 'mis. Diskon klien lama' }) + '</form>',
          tombol: [{ teks: 'Batal' }, { teks: 'Simpan', kelas: 'btn-utama', aksi: function (m) {
            var d = A.ambil($('#f-nom', m.isi));
            return api('tagihan.ubahNominal', { tagihanId: t.id, jumlahBaru: String(d.jumlahBaru).replace(/[^\d]/g, ''), alasan: d.alasan }).then(function (r) { if (!r.ok) { toast(r.message, 'galat'); return false; } toast(r.message); muat(); });
          } }] });
      };
      if ($('#tg-batal')) $('#tg-batal').onclick = function () {
        var ids = Object.keys(pilihT);
        A.konfirmasi('Batalkan ' + ids.length + ' tagihan?', 'Tagihan dihapus dan klien diberi tahu (bila notifikasi aktif). Tagihan yang sudah dibayar/menunggu verifikasi dilewati otomatis.', 'Batalkan tagihan', true).then(function (ya) {
          if (ya) api('tagihan.batal', { tagihanIds: ids }).then(function (r) { toast(r.message, r.ok ? '' : 'galat'); pilihT = {}; muat(); });
        });
      };
      $('#tg-xlsx').onclick = function () {
        var b = this; A.sibuk(b, true);
        api('tagihan.list', Object.assign({}, filterT, { denganBukti: true })).then(function (r) {
          if (!r.ok) throw new Error(r.message);
          return A.ekspor('Rekap-Tagihan-' + new Date().toISOString().slice(0, 10), [{ nama: 'Tagihan', rows: r.data.rows.map(function (t) {
            return { Klien: t.nama, Instansi: t.instansi, Tagihan: t.nama_tagihan, Jenis: t.jenis, Kode: t.kode_tagihan, 'Jumlah asal': Number(t.jumlah_asal), Potongan: Number(t.potongan), Jumlah: Number(t.jumlah), Status: t.status, Terbit: t.tanggal_terbit, 'Jatuh tempo': t.jatuh_tempo, Lunas: t.tanggal_lunas,
              'Tanggal bayar': t.tanggal_bayar, 'Jumlah bayar': t.jumlah_bayar, Metode: t.metode_bayar, 'No. referensi': t.no_referensi, 'Status bayar': t.status_bayar, 'No. kwitansi': t.no_kwitansi, 'Tautan bukti': t.bukti_url };
          }) }]);
        }).then(function () { A.sibuk(b, false); toast('Rekap diunduh.'); }).catch(function (x) { A.sibuk(b, false); toast(x.message, 'galat'); });
      };
    };
    var terbit = function () {
      var aktifK = K.rows.filter(function (k) { return k.status === 'Aktif'; });
      if (!aktifK.length) return toast('Tambahkan klien aktif terlebih dahulu.', 'galat');
      var bulan = [], d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 2);
      for (var i = 0; i < 15; i++) { bulan.push(d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2)); d.setMonth(d.getMonth() + 1); }
      var ini = new Date().getFullYear() + '-' + ('0' + (new Date().getMonth() + 1)).slice(-2), jenis = 'Bulanan';
      var m = A.modal({ judul: 'Terbitkan Tagihan', lebar: true, isi: '<div class="seg" role="group" aria-label="Jenis tagihan"><button type="button" data-j="Bulanan" aria-pressed="true">Bulanan</button><button type="button" data-j="Sekali" aria-pressed="false">Sekali bayar</button></div>' +
        '<div id="tb-bulanan"><span class="label">Pilih bulan (boleh lebih dari satu; tiap bulan jadi 1 tagihan)</span><div class="cek-bulan" style="margin-top:8px">' + bulan.map(function (b) { return '<label><input type="checkbox" class="cek" value="' + b + '"' + (b === ini ? ' checked' : '') + '>' + e(bulanLabel(b)) + '</label>'; }).join('') + '</div></div>' +
        '<div id="tb-sekali" hidden><form class="grid-form" id="f-sk" novalidate>' + A.bidang({ k: 'kode', label: 'Kode tagihan', wajib: true, maks: 31, placeholder: 'WEB-2026', bantu: 'Huruf besar/angka/tanda -. Klien yang sudah punya kode ini dilewati.' }) + A.bidang({ k: 'nama', label: 'Nama tagihan', wajib: true, maks: 120, placeholder: 'Pembuatan Website Profil' }) +
        A.bidang({ k: 'nominal', label: 'Nominal (Rp)', wajib: true, atribut: ' inputmode="numeric"' }) + A.bidang({ k: 'jatuhTempo', label: 'Jatuh tempo', tipe: 'date', wajib: true }) + '</form></div>' +
        '<div><span class="label">Klien</span><div style="display:flex;gap:8px;margin:8px 0;flex-wrap:wrap"><button class="btn btn-teks" type="button" id="pk-semua">Pilih semua</button><button class="btn btn-teks" type="button" id="pk-tidak">Kosongkan</button></div><div class="cek-bulan" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">' +
        aktifK.map(function (k) { return '<label><input type="checkbox" class="cek" data-klien="' + e(k.id) + '" checked><span><b style="display:block;color:var(--navy)">' + e(k.nama) + '</b><small style="color:var(--abu)">' + rp(k.tarif_bulanan) + '/bulan</small></span></label>'; }).join('') + '</div></div>' +
        '<div id="tb-calon"></div>', tombol: [{ teks: 'Batal' }, { teks: '<span class="ms">calculate</span>Hitung Pratinjau', kelas: 'btn-garis', aksi: function () { pratinjau(); return false; } }, { teks: '<span class="ms">send</span>Terbitkan', kelas: 'btn-utama', aksi: function () {
          var p = data(); if (!p) return false;
          return api('tagihan.terbit', p).then(function (r) { if (!r.ok) { toast(r.message, 'galat'); return false; } toast(r.message); muat(); });
        } }] });
      var data = function () {
        var klienIds = $$('[data-klien]', m.isi).filter(function (c) { return c.checked; }).map(function (c) { return c.dataset.klien; });
        if (!klienIds.length) { toast('Pilih minimal satu klien.', 'galat'); return null; }
        if (jenis === 'Bulanan') {
          var pl = $$('#tb-bulanan input', m.isi).filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
          if (!pl.length) { toast('Pilih minimal satu bulan.', 'galat'); return null; }
          return { periodeList: pl, klienIds: klienIds };
        }
        var s = A.ambil($('#f-sk', m.isi));
        return { jenis: 'Sekali', kode: s.kode.toUpperCase(), nama: s.nama, nominal: String(s.nominal).replace(/[^\d]/g, ''), jatuhTempo: s.jatuhTempo, klienIds: klienIds };
      };
      var pratinjau = function () {
        var p = data(); if (!p) return;
        $('#tb-calon', m.isi).innerHTML = '<div class="skeleton" style="height:80px"></div>';
        api('tagihan.calon', p).then(function (r) {
          if (!r.ok) { $('#tb-calon', m.isi).innerHTML = ''; return toast(r.message, 'galat'); }
          var sel = {}; p.klienIds.forEach(function (id) { sel[id] = 1; });
          var rows = r.data.rows.filter(function (x) { return sel[x.klienId]; }), total = rows.reduce(function (s, x) { return s + x.total; }, 0);
          $('#tb-calon', m.isi).innerHTML = '<div class="info-kotak ' + (rows.length ? 'hijau' : 'kuning') + '"><span class="ms">' + (rows.length ? 'task_alt' : 'info') + '</span><span>' + (rows.length ? rows.reduce(function (s, x) { return s + x.kodeBaru.length; }, 0) + ' tagihan baru untuk ' + rows.length + ' klien · estimasi <b>' + rp(total) + '</b>. Tagihan yang sudah ada dilewati otomatis.' : 'Tidak ada tagihan baru — semua klien terpilih sudah punya tagihan untuk pilihan ini.') + '</span></div>' +
            rows.filter(function (x) { return x.peringatan; }).map(function (x) { return '<div class="info-kotak kuning"><span class="ms">warning</span><span>' + e(x.nama) + ': ' + e(x.peringatan) + '</span></div>'; }).join('');
        });
      };
      $$('[data-j]', m.isi).forEach(function (b) { b.onclick = function () { jenis = b.dataset.j; $$('[data-j]', m.isi).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); $('#tb-bulanan', m.isi).hidden = jenis !== 'Bulanan'; $('#tb-sekali', m.isi).hidden = jenis === 'Bulanan'; $('#tb-calon', m.isi).innerHTML = ''; }; });
      $('#pk-semua', m.isi).onclick = function () { $$('[data-klien]', m.isi).forEach(function (c) { c.checked = true; }); };
      $('#pk-tidak', m.isi).onclick = function () { $$('[data-klien]', m.isi).forEach(function (c) { c.checked = false; }); };
    };

    /* ---------- tab Verifikasi (dikelompokkan per bukti) ---------- */
    var tabVerif = function (w) {
      var grup = {}, urut = [];
      A.S.cache.menunggu.forEach(function (b) { if (!grup[b.grup]) { grup[b.grup] = []; urut.push(b.grup); } grup[b.grup].push(b); });
      w.innerHTML = urut.length ? '<p style="color:var(--abu-2);font-size:14px;margin-bottom:14px">Satu bukti transfer bisa mencakup beberapa tagihan. Verifikasi berlaku untuk semua tagihan dalam bukti yang sama.</p><div class="daftar-item">' + urut.map(function (g) {
        var a = grup[g], b0 = a[0], total = a.reduce(function (s, x) { return s + Number(x.jumlah); }, 0), tagih = a.reduce(function (s, x) { return s + Number(x.nominal_tagihan); }, 0);
        return '<div class="grup-bukti" data-id="' + e(b0.id) + '"><button class="bukti-thumb" type="button" data-lihat style="width:96px;height:96px;padding:0;overflow:hidden" aria-label="Lihat bukti"><img src="' + e(b0.bukti_thumb) + '" alt="Bukti transfer" style="width:100%;height:100%;object-fit:cover" referrerpolicy="no-referrer" onerror="this.outerHTML=\'<span class=ms style=font-size:36px>picture_as_pdf</span>\'"></button>' +
          '<div class="rinci"><b style="color:var(--navy);font-size:16px">' + e(b0.nama) + '</b> <small style="color:var(--abu)">' + e(b0.instansi) + '</small><div style="margin:6px 0;display:flex;gap:6px;flex-wrap:wrap">' + a.map(function (x) { return '<span class="chip">' + e(x.nama_tagihan) + ' · ' + rp(x.nominal_tagihan) + '</span>'; }).join('') + '</div>' +
          '<small style="color:var(--abu-2)">Dibayar ' + e(API.tgl(b0.tanggal_bayar, true)) + ' · ' + e(b0.metode) + (b0.no_referensi ? ' · ref <span class="mono">' + e(b0.no_referensi) + '</span>' : '') + '</small>' + (b0.catatan ? '<br><small>Catatan klien: ' + e(b0.catatan) + '</small>' : '') + '</div>' +
          '<div style="text-align:right;display:flex;flex-direction:column;gap:8px;align-items:flex-end"><span><small style="color:var(--abu);display:block">Ditransfer</small><b style="font-size:20px;color:var(--navy)">' + rp(total) + '</b>' + (total > tagih ? '<br><span class="lencana kuning">lebih ' + rp(total - tagih) + '</span>' : '') + '</span><span style="display:flex;gap:8px"><button class="btn btn-garis btn-kecil" type="button" data-tolak style="color:var(--merah)"><span class="ms">close</span>Tolak</button><button class="btn btn-hijau btn-kecil" type="button" data-terima><span class="ms">check</span>Terima</button></span></div></div>';
      }).join('') + '</div>' : A.kosong('fact_check', 'Tidak ada bukti pembayaran yang menunggu verifikasi.');
      w.onclick = function (ev) {
        var c = ev.target.closest('.grup-bukti'); if (!c) return;
        var b0 = A.S.cache.menunggu.filter(function (x) { return x.id === c.dataset.id; })[0];
        if (ev.target.closest('[data-lihat]')) {
          // bukti dibuka di popup, tidak pernah tab baru (skill: prinsip 12)
          A.modal({ judul: 'Bukti Transfer — ' + b0.nama, lebar: true, isi: '<img src="' + e(b0.bukti_thumb.replace(/sz=w\d+/, 'sz=w1600')) + '" alt="Bukti transfer" style="width:100%;border-radius:12px;background:var(--permukaan-tinggi)" referrerpolicy="no-referrer" onerror="this.outerHTML=\'<iframe src=&quot;https://drive.google.com/file/d/' + e(b0.bukti_id) + '/preview&quot; style=&quot;width:100%;height:70vh;border:0&quot; title=&quot;Bukti&quot;></iframe>\'">', tombol: [{ teks: 'Tutup' }] });
        }
        if (ev.target.closest('[data-terima]')) {
          var bt = ev.target.closest('[data-terima]');
          A.konfirmasi('Terima pembayaran?', 'Semua tagihan dalam bukti ini menjadi Lunas dan nomor kwitansi diterbitkan.', 'Terima & terbitkan kwitansi').then(function (ya) {
            if (!ya) return; A.sibuk(bt, true);
            api('tagihan.verifikasi', { pembayaranId: b0.id, aksi: 'terima' }).then(function (r) {
              A.sibuk(bt, false); if (!r.ok) return toast(r.message, 'galat');
              toast(r.message);
              A.modal({ judul: 'Pembayaran Diverifikasi', isi: '<div class="info-kotak hijau"><span class="ms">task_alt</span><span>Kwitansi <b>' + e(r.data.noKwitansi) + '</b> terbit. Klien bisa mengunduhnya sendiri dari tautan bayar.</span></div>', tombol: [{ teks: 'Tutup' }, { teks: '<span class="ms">download</span>Unduh Kwitansi', kelas: 'btn-utama', aksi: function (mm, b) { return api('tagihan.kwitansi', { pembayaranId: r.data.pembayaranId }).then(function (x) { if (!x.ok) { toast(x.message, 'galat'); return false; } return Kwitansi.unduh(x.data); }); } }] });
              muat();
            });
          });
        }
        if (ev.target.closest('[data-tolak]')) {
          A.modal({ judul: 'Tolak bukti pembayaran', isi: '<p style="color:var(--abu-2);font-size:14px">Tagihan kembali berstatus Belum Bayar dan klien diminta mengirim ulang bukti.</p><form id="f-tolak" novalidate>' + A.bidang({ k: 'catatan', label: 'Alasan penolakan (dikirim ke klien)', tipe: 'textarea', wajib: true, maks: 300, baris: 3, placeholder: 'mis. Nominal tidak sesuai / bukti tidak terbaca' }) + '</form>',
            tombol: [{ teks: 'Batal' }, { teks: 'Tolak Bukti', kelas: 'btn-bahaya', aksi: function (m) {
              var f = $('#f-tolak', m.isi), d = A.ambil(f);
              if (!d.catatan.trim()) { A.tandaiGalat(f, { catatan: 'Alasan wajib diisi' }); return false; }
              return api('tagihan.verifikasi', { pembayaranId: b0.id, aksi: 'tolak', catatan: d.catatan }).then(function (r) { if (!r.ok) { toast(r.message, 'galat'); return false; } toast(r.message); muat(); });
            } }] });
        }
      };
    };

    /* ---------- tab Pengingat ---------- */
    var tabPengingat = function (w) {
      var tgl = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      var muatP = function () {
        w.innerHTML = '<div class="skeleton" style="height:180px"></div>';
        api('reminder.pratinjau', { tanggal: tgl }).then(function (r) {
          if (!r.ok) { w.innerHTML = A.kosong('error', r.message); return; }
          var d = r.data, kol = function (j, x) {
            return '<section class="panel" style="box-shadow:none;border:1px solid var(--garis)"><div class="panel-kepala"><div><h2><span class="ms">' + (j === 'H3' ? 'event_upcoming' : 'event') + '</span>' + (j === 'H3' ? 'Pengingat H-3' : 'Pengingat Hari H') + '</h2><p>Jatuh tempo ' + e(API.tgl(x.jatuhTempo, true)) + '</p></div><button class="btn btn-utama btn-kecil" type="button" data-jalan="' + j + '"' + (x.kirim.length ? '' : ' disabled') + '><span class="ms">send</span>Kirim (' + x.kirim.length + ')</button></div>' +
              (x.kirim.length ? x.kirim.map(function (k) { return '<div class="status-baris"><span>' + e(k.nama) + ' · ' + e(k.nama_tagihan) + '</span><b>' + rp(k.jumlah) + '</b></div>'; }).join('') : '<p style="color:var(--abu);font-size:13px">Tidak ada yang perlu diingatkan.</p>') +
              (x.lewati.length ? '<details style="margin-top:10px"><summary style="cursor:pointer;font-size:13px;color:var(--abu)">' + x.lewati.length + ' dilewati</summary>' + x.lewati.map(function (k) { return '<div class="status-baris"><span>' + e(k.nama) + ' · ' + e(k.nama_tagihan) + '</span><small>' + e(k.alasan) + '</small></div>'; }).join('') + (x.lewati.some(function (k) { return k.sudah; }) ? '<button class="btn btn-teks" type="button" data-ulang="' + j + '">Kirim ulang yang sudah diingatkan</button>' : '') + '</details>' : '') + '</section>';
          };
          w.innerHTML = '<div class="alat"><label class="label" for="tgl-r">Tanggal acuan</label><input class="input" type="date" id="tgl-r" value="' + e(tgl) + '"><span style="flex:1"></span><span class="lencana ' + (d.otomatis ? 'hijau' : 'abu') + '">Otomatis ' + (d.otomatis ? 'AKTIF tiap ' + e(d.jam) + ' WITA' : 'MATI') + '</span><a class="btn btn-teks" href="#/pengaturan/tagihan">Atur</a></div>' +
            '<div class="grid-2 sama">' + kol('H3', d.H3) + kol('H0', d.H0) + '</div><p style="font-size:12.5px;color:var(--abu);margin-top:12px">Pengingat hanya untuk tagihan Belum Bayar/Terlambat dan dikirim lewat antrean notifikasi (WA/Email sesuai Konfigurasi). Terakhir otomatis: ' + e(d.terakhir) + '.</p>';
          $('#tgl-r', w).onchange = function () { tgl = this.value; muatP(); };
          $$('[data-jalan],[data-ulang]', w).forEach(function (b) { b.onclick = function () {
            var j = b.dataset.jalan || b.dataset.ulang; A.sibuk(b, true);
            api('reminder.jalankan', { jenis: j, tanggal: tgl, ulang: !!b.dataset.ulang }).then(function (x) { A.sibuk(b, false); toast(x.ok ? x.message + (x.data.catatan ? ' ' + x.data.catatan : '') : x.message, x.ok && !x.data.catatan ? '' : 'galat'); muatP(); });
          }; });
        });
      };
      muatP();
    };
    muat();
  } };

  /* =====================================================================
   * WA & NOTIFIKASI (3 tab)
   * ===================================================================== */
  A.MODUL.notifikasi = { judul: 'WA & Notifikasi', ikon: 'notifications', render: function (el, param) {
    var aktif = (param && param[0]) || 'blast', C = null, penerima = [], timerAuto = null;
    var kepala = function () {
      el.innerHTML = '<div class="kepala-hal"><div><h1>WhatsApp &amp; Notifikasi</h1><p>Notifikasi otomatis (pesan baru, tagihan, pembayaran) dan blast WhatsApp per batch lewat Fonnte. Semua pengiriman melalui antrean.</p></div></div>' +
        tab(el, [['blast', 'Blast WhatsApp', 'campaign'], ['antrean', 'Antrean & Riwayat', 'outbox'], ['konfigurasi', 'Konfigurasi', 'tune']], aktif) + '<div id="n-isi"></div>';
      $$('[data-tab]', el).forEach(function (b) { b.onclick = function () { aktif = b.dataset.tab; history.replaceState(null, '', '#/notifikasi/' + aktif); clearInterval(timerAuto); kepala(); }; });
      ({ blast: tBlast, antrean: tAntrean, konfigurasi: tKonfig })[aktif]($('#n-isi'));
    };

    /* ---------- Konfigurasi ---------- */
    var tKonfig = function (w) {
      w.innerHTML = '<div class="skeleton" style="height:300px"></div>';
      api('notif.config').then(function (r) {
        if (!r.ok) { w.innerHTML = A.kosong('error', r.message); return; }
        C = r.data;
        w.innerHTML = '<div class="grid-2 sama" style="margin-bottom:20px"><section class="panel"><div class="panel-kepala"><div><h2><span class="ms">chat</span>WhatsApp (Fonnte)</h2><p>Token disimpan di Script Properties.</p></div><span class="lencana ' + (C.waAktif ? 'hijau' : 'abu') + '">' + (C.waAktif ? 'AKTIF' : 'NONAKTIF') + '</span></div>' +
          A.bidang({ k: 'waAktif', label: 'Notifikasi WhatsApp', tipe: 'saklar', nilai: C.waAktif, bantu: C.adaToken ? '' : 'Isi token dulu sebelum menyalakan.' }) +
          '<div class="bidang" style="margin-top:12px"><label for="tok">Token Fonnte</label><input id="tok" name="token" type="password" autocomplete="off" placeholder="' + e(C.adaToken ? C.tokenSamar + ' (kosongkan bila tidak diubah)' : 'Tempel token dari fonnte.com → Device') + '"><span class="galat"></span></div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0"><button class="btn btn-garis btn-kecil" type="button" id="cek-dev"><span class="ms">sensors</span>Cek Perangkat</button><input class="input" id="tes-no" placeholder="0812… untuk tes" style="width:170px;min-height:36px;padding:6px 12px" aria-label="Nomor tes"><button class="btn btn-garis btn-kecil" type="button" id="tes-wa"><span class="ms">send</span>Kirim Tes WA</button></div><div id="info-dev"></div>' +
          '<div class="bidang" style="margin-top:12px"><span class="label">Ukuran batch blast bawaan</span><div class="seg" id="seg-b">' + [10, 20, 50].map(function (n) { return '<button type="button" data-b="' + n + '" aria-pressed="' + (C.batchDefault === n) + '">' + n + '</button>'; }).join('') + '</div></div>' +
          '<div class="grid-form" style="margin-top:12px">' + A.bidang({ k: 'jeda', label: 'Jeda antarpesan (detik)', nilai: C.jeda, bantu: 'Angka atau rentang acak, mis. 3-8 (lebih aman dari blokir).' }) + A.bidang({ k: 'waAdmin', label: 'Nomor WA Anda (notifikasi admin)', nilai: C.waAdmin, placeholder: '0812…' }) + '</div>' +
          A.bidang({ k: 'deteksiOtomatis', label: 'Deteksi otomatis nomor WA kontak baru', tipe: 'saklar', nilai: C.deteksiOtomatis, bantu: 'Maks. 50 nomor tiap 10 menit (butuh paket Fonnte dengan fitur validate).' }) + '</section>' +
          '<section class="panel"><div class="panel-kepala"><div><h2><span class="ms">mail</span>Email (Gmail)</h2><p>Dikirim dari akun Google pemilik Apps Script.</p></div><span class="lencana ' + (C.emailAktif ? 'hijau' : 'abu') + '">' + (C.emailAktif ? 'AKTIF' : 'NONAKTIF') + '</span></div>' +
          A.bidang({ k: 'emailAktif', label: 'Notifikasi email', tipe: 'saklar', nilai: C.emailAktif }) +
          '<div class="status-baris"><span><span class="ms">data_usage</span>Sisa kuota email hari ini</span><b>' + (C.kuotaEmail < 0 ? '–' : C.kuotaEmail) + '</b></div><div class="status-baris"><span><span class="ms">timer</span>Trigger tikMenit</span>' + (C.triggerAktif ? '<span class="lencana hijau">Aktif</span>' : '<span class="lencana merah">Mati</span>') + '</div>' +
          '<div class="grid-form" style="margin-top:12px">' + A.bidang({ k: 'namaPengirim', label: 'Nama pengirim', nilai: C.namaPengirim, maks: 60 }) + A.bidang({ k: 'emailNotifikasi', label: 'Email penerima notifikasi admin', nilai: C.emailNotifikasi, tipe: 'email' }) + '</div>' +
          '<button class="btn btn-garis btn-kecil" type="button" id="tes-email" style="margin-top:12px"><span class="ms">forward_to_inbox</span>Kirim Tes Email</button></section></div>' +
          '<section class="panel"><div class="panel-kepala"><div><h2><span class="ms">grid_on</span>Matriks Notifikasi Otomatis</h2><p>Pilih kanal per kejadian. Ubah isi pesan bila perlu — variabel ditulis dalam kurung kurawal.</p></div></div><div class="tabel-wadah"><table class="tabel"><thead><tr><th>Kejadian</th><th>Penerima</th><th style="text-align:center">WA</th><th style="text-align:center">Email</th><th class="aksi"></th></tr></thead><tbody id="mtx"></tbody></table></div>' +
          '<div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn btn-utama" type="button" id="simpan-cfg"><span class="ms">save</span>Simpan Konfigurasi</button></div></section>';
        var mtx = {};
        C.matriks.forEach(function (m) { mtx[m.kode] = { wa: m.wa, email: m.email, subjek: m.subjek, pesan: m.pesan }; });
        var gambarMtx = function () {
          $('#mtx').innerHTML = C.matriks.map(function (m) {
            var x = mtx[m.kode];
            return '<tr data-k="' + m.kode + '"><td class="sel-utama"><b>' + e(m.label) + '</b><small class="mono">' + e(m.kode) + '</small></td><td>' + (m.ke === 'admin' ? '<span class="lencana biru">Anda</span>' : '<span class="lencana abu">Klien</span>') + '</td>' +
              '<td style="text-align:center"><label class="saklar"><input type="checkbox" data-kanal="wa"' + (x.wa ? ' checked' : '') + ' aria-label="WA ' + e(m.label) + '"><span></span></label></td><td style="text-align:center"><label class="saklar"><input type="checkbox" data-kanal="email"' + (x.email ? ' checked' : '') + ' aria-label="Email ' + e(m.label) + '"><span></span></label></td>' +
              '<td class="aksi"><button class="btn btn-teks" type="button" data-ubah><span class="ms">edit</span>Ubah</button></td></tr>';
          }).join('');
        };
        gambarMtx();
        $('#mtx').onchange = function (ev) { var c = ev.target.closest('[data-kanal]'); if (c) mtx[c.closest('tr').dataset.k][c.dataset.kanal] = c.checked; };
        $('#mtx').onclick = function (ev) {
          if (!ev.target.closest('[data-ubah]')) return;
          var kode = ev.target.closest('tr').dataset.k, m = C.matriks.filter(function (z) { return z.kode === kode; })[0], x = mtx[kode];
          var contoh = {}; m.vars.forEach(function (v) { contoh[v] = '{' + v + '}'; });
          Object.assign(contoh, { nama: 'Budi Santoso', usaha: 'Fajar Ferdian Kuswicaksono', periode: 'November 2026', jumlah: 'Rp 1.500.000', jatuhTempo: '2026-11-10', pengirim: 'Siti', emailPengirim: 'siti@contoh.id', isi: 'Halo, saya tertarik bekerja sama.', status: 'LUNAS ✅', hari: '3 hari lagi', klien: 'Dinas Contoh', tagihan: 'Biaya Layanan November 2026' });
          var isiT = function (t) { return String(t).replace(/\{(\w+)\}/g, function (a, k) { return contoh[k] !== undefined ? contoh[k] : a; }); };
          var md = A.modal({ judul: 'Template — ' + m.label, lebar: true, isi: '<div class="grid-2 sama"><div><form id="f-tpl" class="grid-form" style="grid-template-columns:1fr">' + A.bidang({ k: 'subjek', label: 'Subjek email', nilai: x.subjek, maks: 200 }) + A.bidang({ k: 'pesan', label: 'Isi pesan (WA & email)', tipe: 'textarea', nilai: x.pesan, maks: 2000, baris: 9, bantu: '*teks* = tebal di WhatsApp.' }) + '</form>' +
            '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">' + m.vars.map(function (v) { return '<button class="btn btn-garis btn-kecil" type="button" data-var="' + v + '">{' + v + '}</button>'; }).join('') + '</div></div><div><span class="label">Pratinjau</span><div class="latar-wa" style="margin-top:8px"><div class="wa-gelembung" id="pv-wa"></div></div></div></div>',
            tombol: [{ teks: '↺ Kembalikan bawaan', kelas: 'btn-teks', aksi: function (mm) { $('[name=subjek]', mm.isi).value = m.subjekDefault; $('[name=pesan]', mm.isi).value = m.pesanDefault; pv(); return false; } }, { teks: 'Batal' }, { teks: 'Terapkan', kelas: 'btn-utama', aksi: function (mm) { var d = A.ambil($('#f-tpl', mm.isi)); x.subjek = d.subjek; x.pesan = d.pesan; toast('Template diterapkan — klik Simpan Konfigurasi.', 'info'); } }] });
          var ta = $('[name=pesan]', md.isi), pv = function () { $('#pv-wa', md.isi).textContent = isiT(ta.value); };
          ta.addEventListener('input', pv); pv();
          $$('[data-var]', md.isi).forEach(function (b) { b.onclick = function () { var s = ta.selectionStart || ta.value.length; ta.value = ta.value.slice(0, s) + '{' + b.dataset.var + '}' + ta.value.slice(ta.selectionEnd || s); ta.focus(); pv(); }; });
        };
        var batch = C.batchDefault;
        $$('#seg-b [data-b]').forEach(function (b) { b.onclick = function () { batch = +b.dataset.b; $$('#seg-b [data-b]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); }; });
        $('#cek-dev').onclick = function () { var b = this; A.sibuk(b, true); api('wa.perangkat').then(function (x) { A.sibuk(b, false); $('#info-dev').innerHTML = x.ok ? '<div class="info-kotak ' + (x.data.status === 'connect' ? 'hijau' : 'kuning') + '"><span class="ms">smartphone</span><span>Nomor <b>' + e(x.data.nomor) + '</b> · status <b>' + e(x.data.status) + '</b> · paket ' + e(x.data.paket) + ' · kuota ' + e(x.data.kuota) + ' · berlaku s.d. ' + e(x.data.kedaluwarsa) + '</span></div>' : '<div class="info-kotak merah"><span class="ms">error</span><span>' + e(x.message) + '</span></div>'; }); };
        $('#tes-wa').onclick = function () { var b = this; A.sibuk(b, true); api('wa.tes', { nomor: $('#tes-no').value }).then(function (x) { A.sibuk(b, false); toast(x.message, x.ok ? '' : 'galat'); }); };
        $('#tes-email').onclick = function () { var b = this; A.sibuk(b, true); api('email.tes', { email: w.querySelector('[name=emailNotifikasi]').value }).then(function (x) { A.sibuk(b, false); toast(x.message, x.ok ? '' : 'galat'); }); };
        $('#simpan-cfg').onclick = function () {
          var b = this, d = A.ambil(w), kirim = { waAktif: d.waAktif, emailAktif: d.emailAktif, batchDefault: batch, jeda: d.jeda, deteksiOtomatis: d.deteksiOtomatis, namaPengirim: d.namaPengirim, emailNotifikasi: d.emailNotifikasi, waAdmin: d.waAdmin, matriks: mtx };
          if (d.token) kirim.token = d.token;
          A.sibuk(b, true, 'Menyimpan…');
          api('notif.simpanConfig', kirim).then(function (x) { A.sibuk(b, false); if (!x.ok) return toast(x.message, 'galat'); toast('Konfigurasi tersimpan.'); tKonfig(w); });
        };
      });
    };

    /* ---------- Antrean & Riwayat ---------- */
    var tAntrean = function (w) {
      var f = { status: '', kanal: '' };
      var muatA = function () {
        api('notif.antrean', f).then(function (r) {
          if (!r.ok) { w.innerHTML = A.kosong('error', r.message); return; }
          var g = r.data.ringkasan;
          w.innerHTML = '<div class="grid-kpi">' + [['Antri', 'Menunggu', 'schedule'], ['Terkirim', 'Terkirim', 'done_all'], ['Gagal', 'Gagal', 'error'], ['Batal', 'Dibatalkan', 'block']].map(function (k) { return '<button class="panel kpi" type="button" data-st="' + k[0] + '"><div class="atas">' + k[1] + '<span class="ms">' + k[2] + '</span></div><b>' + (g[k[0]] + (k[0] === 'Antri' ? g.Proses : 0)) + '</b><small>3.000 baris terakhir</small></button>'; }).join('') + '</div>' +
            '<section class="panel"><div class="alat"><select class="input" id="a-st" aria-label="Status"><option value="">Semua status</option>' + ['Antri', 'Proses', 'Terkirim', 'Gagal', 'Batal'].map(function (s) { return '<option' + (f.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select><select class="input" id="a-kn" aria-label="Kanal"><option value="">Semua kanal</option><option' + (f.kanal === 'WA' ? ' selected' : '') + '>WA</option><option' + (f.kanal === 'EMAIL' ? ' selected' : '') + '>EMAIL</option></select><span style="flex:1"></span>' +
            '<button class="btn btn-garis btn-kecil" type="button" id="a-ulang"' + (g.Gagal ? '' : ' disabled') + '><span class="ms">replay</span>Ulangi yang Gagal</button><button class="btn btn-utama btn-kecil" type="button" id="a-proses"><span class="ms">send</span>Proses Sekarang</button></div>' +
            (r.data.rows.length ? '<div class="tabel-wadah"><table class="tabel"><thead><tr><th>Waktu</th><th>Kanal</th><th>Tujuan</th><th>Kejadian</th><th>Pesan</th><th>Status</th></tr></thead><tbody>' + r.data.rows.map(function (x) {
              return '<tr><td class="mono" style="white-space:nowrap">' + e(x.dikirim || x.dibuat) + '</td><td><span class="lencana ' + (x.kanal === 'WA' ? 'hijau' : 'biru') + '">' + e(x.kanal) + '</span></td><td class="sel-utama"><b>' + e(x.nama || '–') + '</b><small class="mono">' + e(x.tujuan) + '</small></td><td><small class="mono">' + e(x.event) + '</small></td><td style="max-width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--abu-2)">' + e(x.cuplikan) + '</td><td>' + A.lencana(x.status) + (x.respon && x.status !== 'Terkirim' ? '<br><small style="color:var(--abu)">' + e(x.respon) + '</small>' : '') + '</td></tr>';
            }).join('') + '</tbody></table></div>' : A.kosong('outbox', 'Belum ada notifikasi.')) + '</section>';
          $$('[data-st]', w).forEach(function (b) { b.onclick = function () { f.status = b.dataset.st; muatA(); }; });
          $('#a-st').onchange = function () { f.status = this.value; muatA(); };
          $('#a-kn').onchange = function () { f.kanal = this.value; muatA(); };
          $('#a-proses').onclick = function () { var b = this; A.sibuk(b, true); api('notif.prosesSekarang').then(function (x) { A.sibuk(b, false); toast(x.ok ? x.data.info + ': ' + x.data.terkirim + ' terkirim' : x.message, x.ok ? '' : 'galat'); muatA(); }); };
          $('#a-ulang').onclick = function () { api('notif.ulangi', {}).then(function (x) { toast(x.message, x.ok ? '' : 'galat'); muatA(); }); };
        });
      };
      muatA();
    };

    /* ---------- Blast ---------- */
    var tBlast = function (w) {
      var awal = A.S.blastPrefill; A.S.blastPrefill = null;
      w.innerHTML = '<div id="blast-aktif"></div><div class="grid-2 sama"><section class="panel"><div class="panel-kepala"><div><h2><span class="ms">group</span>1. Pilih Sasaran</h2><p>Sumber bawaan = CRM (sudah menyatukan semua kontak).</p></div></div>' +
        '<div class="grid-form"><div class="bidang"><label for="b-sumber">Sumber</label><select id="b-sumber"><option value="crm">CRM Kontak</option><option value="manual">Tempel manual</option></select></div><div class="bidang" id="w-segmen"><label for="b-seg">Segmen</label><select id="b-seg"><option value="">Semua segmen</option><option>Pengirim Pesan</option><option>Klien</option><option>Kontak Manual</option></select></div>' +
        '<div class="bidang" id="w-stwa"><label for="b-stwa">Status WA</label><select id="b-stwa"><option value="">Semua</option><option>Terdaftar</option><option value="belum">Belum dicek</option></select></div><div class="bidang" id="w-tag"><label for="b-tag">Tag</label><input id="b-tag" placeholder="mis. mitra"></div>' +
        '<div class="bidang penuh" id="w-manual" hidden><label for="b-manual">Nomor | Nama (satu per baris)</label><textarea id="b-manual" placeholder="081234567890|Budi&#10;081298765432|Siti"></textarea></div></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0"><button class="btn btn-navy btn-kecil" type="button" id="b-muat"><span class="ms">group_add</span>Muat Penerima</button><button class="btn btn-garis btn-kecil" type="button" id="b-deteksi" disabled><span class="ms">verified</span>Deteksi Nomor WA</button></div>' +
        '<div id="b-ring"></div><label style="display:flex;gap:8px;align-items:center;font-size:14px;margin:10px 0"><input type="checkbox" class="cek" id="b-hanya">Kirim hanya ke nomor terdeteksi WhatsApp</label><div id="b-daftar"></div></section>' +
        '<section class="panel"><div class="panel-kepala"><div><h2><span class="ms">edit_note</span>2. Tulis Pesan</h2></div></div><div class="grid-form" style="grid-template-columns:1fr">' + A.bidang({ k: 'judul', label: 'Judul internal (tidak dikirim)', maks: 100, placeholder: 'mis. Info layanan Desember' }) +
        '<div class="bidang"><label for="b-pesan">Isi pesan</label><textarea id="b-pesan" maxlength="2000" style="min-height:150px" placeholder="Halo {nama}, …"></textarea><div style="display:flex;gap:6px;flex-wrap:wrap">' + ['nama', 'instansi', 'usaha', 'situs'].map(function (v) { return '<button class="btn btn-garis btn-kecil" type="button" data-var="' + v + '">{' + v + '}</button>'; }).join('') + '<button class="btn btn-teks btn-kecil" type="button" id="b-stop">+ "Balas STOP untuk berhenti"</button></div></div>' +
        '<div><span class="label">Pratinjau (penerima pertama)</span><div class="latar-wa" style="margin-top:8px"><div class="wa-gelembung" id="b-pv">Tulis pesan untuk melihat pratinjau.</div></div></div></div>' +
        '<div class="bagian-form" style="margin-top:16px"><h3><span class="ms">speed</span>3. Ukuran Batch &amp; Jeda</h3><div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center"><div class="seg" id="b-seg-b">' + [10, 20, 50].map(function (n) { return '<button type="button" data-b="' + n + '" aria-pressed="' + (n === 20) + '">' + n + '</button>'; }).join('') + '</div><input class="input" id="b-jeda" value="3-8" style="width:110px" aria-label="Jeda detik"><span style="font-size:13px;color:var(--abu)">detik jeda</span></div>' +
        '<p id="b-est" style="font-size:13px;color:var(--abu-2);margin-top:10px"></p><button class="btn btn-utama" type="button" id="b-mulai" style="margin-top:8px" disabled><span class="ms">rocket_launch</span>Mulai Blast</button></div></section></div>' +
        '<section class="panel" style="margin-top:20px"><div class="panel-kepala"><div><h2><span class="ms">history</span>Riwayat Blast</h2></div></div><div id="b-riwayat"></div></section>';
      var batch = 20, ringkas = null;
      var pilihan = function () { return penerima.filter(function (p) { return p._pilih; }); };
      var estimasi = function () {
        var n = pilihan().length, jd = $('#b-jeda').value.split('-').map(Number), rata = jd.length > 1 ? (jd[0] + jd[1]) / 2 : jd[0] || 5;
        $('#b-est').textContent = n ? n + ' penerima → ' + Math.ceil(n / batch) + ' batch · ±' + Math.max(1, Math.round(n * rata / 60)) + ' menit (server mengirim 1 batch tiap ±5 menit walau halaman ditutup; tombol "Kirim batch berikutnya" mempercepat).' : 'Muat penerima terlebih dahulu.';
        var b = $('#b-mulai'); b.disabled = !n; b.innerHTML = '<span class="ms">rocket_launch</span>Mulai Blast (' + n + ' nomor)';
      };
      var pratinjau = function () { var p = pilihan()[0] || { nama: 'Budi', vars: {} }, t = $('#b-pesan').value; $('#b-pv').textContent = t ? t.replace(/\{(\w+)\}/g, function (a, k) { return k === 'nama' ? p.nama || 'Bapak/Ibu' : (p.vars && p.vars[k]) || (k === 'usaha' ? 'Fajar Ferdian Kuswicaksono' : k === 'situs' ? location.origin : a); }) : 'Tulis pesan untuk melihat pratinjau.'; };
      var gambarDaftar = function () {
        var hanya = $('#b-hanya').checked;
        penerima.forEach(function (p) { if (!p.valid || p.ganda || p.optOut || (hanya && p.statusWA !== 'Terdaftar')) p._pilih = false; else if (p._pilih === undefined) p._pilih = true; });
        var g = ringkas || {};
        $('#b-ring').innerHTML = ringkas ? '<div style="display:flex;gap:6px;flex-wrap:wrap"><span class="chip">Total ' + g.total + '</span><span class="lencana hijau">Valid ' + g.valid + '</span><span class="lencana merah">Tidak valid ' + g.tidakValid + '</span><span class="lencana abu">Ganda ' + g.ganda + '</span><span class="lencana kuning">Opt-out ' + g.optOut + '</span><span class="lencana biru">Terdaftar WA ' + g.terdaftarWA + '</span></div>' : '';
        $('#b-daftar').innerHTML = penerima.length ? '<div class="tabel-wadah" style="max-height:360px;overflow:auto"><table class="tabel"><thead><tr><th style="width:36px"><input type="checkbox" id="b-semua" aria-label="Pilih semua" checked></th><th>Nama</th><th>Nomor</th><th>WA</th></tr></thead><tbody>' + penerima.slice(0, 1000).map(function (p, i) {
          var bisa = p.valid && !p.ganda && !p.optOut;
          return '<tr class="' + (bisa ? '' : 'redup') + '"><td><input type="checkbox" data-i="' + i + '"' + (p._pilih ? ' checked' : '') + (bisa ? '' : ' disabled') + ' aria-label="Pilih ' + e(p.nama) + '"></td><td>' + e(p.nama || '–') + (p.optOut ? ' <span class="lencana kuning">opt-out</span>' : '') + (p.ganda ? ' <span class="lencana abu">ganda</span>' : '') + '</td><td class="mono">' + e(p.hp || '–') + '</td><td>' + (p.statusWA === 'Terdaftar' ? '<span class="lencana hijau">✓ WA</span>' : p.statusWA === 'Tidak Terdaftar' ? '<span class="lencana merah">✕ bukan WA</span>' : '<span class="lencana abu">? belum</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>' + (penerima.length > 1000 ? '<p style="font-size:12px;color:var(--abu)">Menampilkan 1.000 dari ' + penerima.length + '.</p>' : '') : '';
        if ($('#b-semua')) $('#b-semua').onchange = function () { var on = this.checked; penerima.forEach(function (p) { if (p.valid && !p.ganda && !p.optOut && (!hanya || p.statusWA === 'Terdaftar')) p._pilih = on; }); gambarDaftar(); };
        $('#b-deteksi').disabled = !penerima.some(function (p) { return p.valid && !p.statusWA; });
        estimasi(); pratinjau();
      };
      $('#b-daftar').onchange = function (ev) { var c = ev.target.closest('[data-i]'); if (c) { penerima[+c.dataset.i]._pilih = c.checked; estimasi(); pratinjau(); } };
      $('#b-sumber').onchange = function () { var man = this.value === 'manual'; $('#w-manual').hidden = !man; ['#w-segmen', '#w-stwa', '#w-tag'].forEach(function (s) { $(s).hidden = man; }); };
      $('#b-hanya').onchange = function () { penerima.forEach(function (p) { delete p._pilih; }); gambarDaftar(); };
      var muatP = function (ids) {
        var b = $('#b-muat'); A.sibuk(b, true);
        api('wa.sasaran', { sumber: $('#b-sumber').value, segmen: $('#b-seg').value, statusWA: $('#b-stwa').value, tag: $('#b-tag').value.trim(), teks: $('#b-manual').value, ids: ids || [] }).then(function (r) {
          A.sibuk(b, false); if (!r.ok) return toast(r.message, 'galat');
          penerima = r.data.rows; ringkas = r.data.ringkas; gambarDaftar();
        });
      };
      $('#b-muat').onclick = function () { muatP(); };
      $('#b-deteksi').onclick = function () {
        var b = this, belum = penerima.filter(function (p) { return p.valid && !p.statusWA; }).map(function (p) { return p.hp; }), total = belum.length, selesai = 0;
        var langkah = function () {
          if (!belum.length) { A.sibuk(b, false); toast('Deteksi selesai untuk ' + total + ' nomor.'); return gambarDaftar(); }
          var ambilN = belum.splice(0, 50);
          b.innerHTML = '<span class="ms putar">progress_activity</span>Mengecek ' + selesai + '/' + total;
          api('wa.validasi', { nomor: ambilN }).then(function (r) {
            if (!r.ok) { A.sibuk(b, false); b.disabled = false; return toast(r.message, 'galat'); }
            penerima.forEach(function (p) { if (r.data.peta[p.hp]) p.statusWA = r.data.peta[p.hp]; });
            selesai += ambilN.length; langkah();
          });
        };
        b.dataset.asli = b.innerHTML; b.disabled = true; langkah();
      };
      $$('#b-seg-b [data-b]').forEach(function (b) { b.onclick = function () { batch = +b.dataset.b; $$('#b-seg-b [data-b]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); estimasi(); }; });
      $('#b-jeda').oninput = estimasi;
      $('#b-pesan').oninput = pratinjau;
      $$('[data-var]', w).forEach(function (b) { b.onclick = function () { var t = $('#b-pesan'), s = t.selectionStart || t.value.length; t.value = t.value.slice(0, s) + '{' + b.dataset.var + '}' + t.value.slice(t.selectionEnd || s); t.focus(); pratinjau(); }; });
      $('#b-stop').onclick = function () { var t = $('#b-pesan'); if (t.value.indexOf('STOP') < 0) t.value = t.value.replace(/\s*$/, '') + '\n\nBalas STOP untuk berhenti menerima pesan ini.'; pratinjau(); };
      $('#b-mulai').onclick = function () {
        var p = pilihan(), b = this, judul = w.querySelector('[name=judul]').value.trim(), pesan = $('#b-pesan').value.trim();
        if (!judul || !pesan) return toast('Isi judul internal dan isi pesan.', 'galat');
        A.konfirmasi('Mulai blast ke ' + p.length + ' nomor?', 'Pesan dikirim per ' + batch + ' nomor dengan jeda ' + $('#b-jeda').value + ' detik. Anda bisa menghentikannya kapan saja.', 'Mulai blast').then(function (ya) {
          if (!ya) return; A.sibuk(b, true);
          api('wa.blastBuat', { judul: judul, pesan: pesan, ukuranBatch: batch, jeda: $('#b-jeda').value, penerima: p.map(function (x) { return { hp: x.hp, nama: x.nama, vars: x.vars }; }), hanyaTerdaftar: $('#b-hanya').checked, sasaran: $('#b-sumber').value === 'manual' ? 'Manual' : 'CRM ' + ($('#b-seg').value || 'semua') }).then(function (r) {
            A.sibuk(b, false); if (!r.ok) return toast(r.message, 'galat');
            toast(r.message); penerima = []; ringkas = null; gambarDaftar(); riwayatB();
          });
        });
      };
      var riwayatB = function () {
        api('wa.blastDaftar').then(function (r) {
          if (!r.ok || A.S.rute !== 'notifikasi') return;
          var jalan = r.data.filter(function (b) { return b.status === 'Berjalan'; });
          $('#blast-aktif').innerHTML = jalan.map(function (b) {
            return '<section class="panel" style="margin-bottom:20px;border:2px solid var(--utama)" data-blast="' + e(b.id) + '"><div class="panel-kepala"><div><h2><span class="ms">campaign</span>Blast berjalan: ' + e(b.judul) + '</h2><p>' + e(b.sasaran) + ' · batch ' + e(b.ukuran_batch) + ' · jeda ' + e(b.jeda_detik) + ' dtk</p></div><span class="lencana biru">' + b.persen + '%</span></div>' +
              '<div class="progres"><i style="width:' + b.persen + '%"></i></div><p style="font-size:13px;margin:10px 0;color:var(--abu-2)">Terkirim <b>' + b.terkirim + '</b> · gagal <b>' + b.gagal + '</b> · sisa <b>' + b.sisa + '</b> dari ' + b.total + '. Server tetap mengirim 1 batch tiap ±5 menit walau halaman ditutup.</p>' +
              '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn btn-utama btn-kecil" type="button" data-kirim><span class="ms">play_arrow</span>Kirim Batch Berikutnya Sekarang</button><label style="display:flex;gap:8px;align-items:center;font-size:13px"><span class="saklar"><input type="checkbox" data-auto><span></span></span>Otomatis <span data-hitung></span></label><button class="btn btn-garis btn-kecil" type="button" data-henti style="color:var(--merah)"><span class="ms">stop</span>Hentikan</button></div></section>';
          }).join('');
          $('#b-riwayat').innerHTML = r.data.length ? '<div class="tabel-wadah"><table class="tabel"><thead><tr><th>Judul</th><th>Sasaran</th><th>Batch · jeda</th><th style="min-width:160px">Progres</th><th>Status</th><th>Dibuat</th></tr></thead><tbody>' + r.data.map(function (b) {
            return '<tr><td><b>' + e(b.judul) + '</b></td><td>' + e(b.sasaran) + '</td><td>' + e(b.ukuran_batch) + ' · ' + e(b.jeda_detik) + ' dtk</td><td><div class="progres"><i style="width:' + b.persen + '%"></i></div><small style="color:var(--abu)">' + b.terkirim + ' terkirim · ' + b.gagal + ' gagal · ' + b.sisa + ' sisa</small></td><td>' + A.lencana(b.status) + '</td><td class="mono" style="white-space:nowrap">' + e(b.dibuat) + '</td></tr>';
          }).join('') + '</tbody></table></div>' : A.kosong('campaign', 'Belum ada blast.');
          $$('[data-blast]').forEach(function (s) {
            var id = s.dataset.blast;
            var kirim = function () { var b = $('[data-kirim]', s); A.sibuk(b, true); return api('wa.blastProses', { blastId: id }).then(function (x) { A.sibuk(b, false); toast(x.message, x.ok ? '' : 'galat'); riwayatB(); return x; }); };
            $('[data-kirim]', s).onclick = kirim;
            $('[data-henti]', s).onclick = function () { A.konfirmasi('Hentikan blast?', 'Pesan yang belum terkirim dibatalkan.', 'Hentikan', true).then(function (ya) { if (ya) api('wa.blastHenti', { blastId: id }).then(function (x) { toast(x.message, x.ok ? '' : 'galat'); clearInterval(timerAuto); riwayatB(); }); }); };
            $('[data-auto]', s).onchange = function () {
              clearInterval(timerAuto);
              if (!this.checked) { $('[data-hitung]', s).textContent = ''; return; }
              var bl = r.data.filter(function (x) { return x.id === id; })[0] || {}, jd = String(bl.jeda_detik || '5').split('-').map(Number);
              var jeda = Math.max(30, Math.round((Number(bl.ukuran_batch) || 20) * (jd.length > 1 ? (jd[0] + jd[1]) / 2 : jd[0] || 5))), sisa = jeda;
              timerAuto = setInterval(function () {
                if (A.S.rute !== 'notifikasi' || !document.body.contains(s)) return clearInterval(timerAuto);
                sisa--; $('[data-hitung]', s).textContent = '(' + sisa + ' dtk)';
                if (sisa <= 0) { sisa = jeda; kirim(); }
              }, 1000);
            };
          });
        });
      };
      riwayatB(); estimasi();
      if (awal && awal.length) { $('#b-sumber').value = 'crm'; muatP(awal); }
    };
    kepala();
  } };

  /* =====================================================================
   * CRM KONTAK
   * ===================================================================== */
  function parseCSV(t) {
    var baris = [], sel = '', row = [], kutip = false, pemisah = (t.split('\n')[0].match(/;/g) || []).length > (t.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    for (var i = 0; i < t.length; i++) {
      var c = t[i];
      if (kutip) { if (c === '"' && t[i + 1] === '"') { sel += '"'; i++; } else if (c === '"') kutip = false; else sel += c; }
      else if (c === '"') kutip = true;
      else if (c === pemisah) { row.push(sel); sel = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(sel); baris.push(row); row = []; sel = ''; }
      else sel += c;
    }
    if (sel || row.length) { row.push(sel); baris.push(row); }
    var h = (baris.shift() || []).map(function (x) { return x.trim().toLowerCase(); });
    return baris.filter(function (r) { return r.join('').trim(); }).map(function (r) { var o = {}; h.forEach(function (k, j) { o[k] = (r[j] || '').trim(); }); return o; });
  }
  A.MODUL.crm = { judul: 'CRM Kontak', ikon: 'contacts', render: function (el) {
    var f = { cari: '', segmen: '', sumber: '', tag: '', statusWA: '', emailValid: '', optOut: '', duplikat: false, bermasalah: false, halaman: 1, per: 50 }, pilih = {}, ST = null, L = null;
    var muat = function () {
      Promise.all([api('crm.stats'), api('crm.list', f)]).then(function (r) {
        if (A.S.rute !== 'crm') return;
        if (!r[0].ok) { el.innerHTML = A.kosong('error', r[0].message); return; }
        ST = r[0].data; L = r[1].ok ? r[1].data : { rows: [], total: 0, facet: { segmen: {}, tag: {} } }; gambar();
      });
    };
    var gambar = function () {
      var s = ST;
      el.innerHTML = '<div class="kepala-hal"><div><h1>CRM Kontak</h1><p>Satu layar untuk semua kontak (Nama · Email · WhatsApp) dari formulir kontak, klien, dan impor. Sinkron terakhir: ' + e(s.syncTerakhir ? API.relatif(s.syncTerakhir) : 'belum pernah') + '.</p></div><div class="aksi"><button class="btn btn-garis" type="button" id="c-sync"><span class="ms">sync</span>Sinkron Sekarang</button><button class="btn btn-garis" type="button" id="c-imp"><span class="ms">upload</span>Import CSV</button><button class="btn btn-garis" type="button" id="c-eks"><span class="ms">download</span>Ekspor</button></div></div>' +
        '<div class="grid-kpi enam">' + [['', 'Total Kontak', s.total, 'contacts'], ['statusWA:Terdaftar', 'WA Terverifikasi', s.terdaftarWA, 'verified'], ['emailValid:YA', 'Email Valid', s.emailValid, 'alternate_email'], ['statusWA:belum', 'Belum Dicek WA', s.belumDicek, 'help'], ['optOut:YA', 'Opt-out', s.optOut, 'block'], ['duplikat', 'Duplikat', s.duplikat, 'content_copy']]
          .map(function (k) { return '<button class="panel kpi" type="button" data-kpi="' + k[0] + '"><div class="atas">' + k[1] + '<span class="ms">' + k[3] + '</span></div><b>' + A.angka(k[2]) + '</b></button>'; }).join('') + '</div>' +
        '<section class="panel"><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px"><button class="chip" type="button" data-seg="" style="border:0;cursor:pointer;' + (!f.segmen ? 'background:var(--navy);color:#fff' : '') + '">Semua · ' + s.total + '</button>' + Object.keys(s.perSegmen).map(function (g) { return '<button class="chip" type="button" data-seg="' + e(g) + '" style="border:0;cursor:pointer;' + (f.segmen === g ? 'background:var(--navy);color:#fff' : '') + '">' + e(g) + ' · ' + s.perSegmen[g] + '</button>'; }).join('') + '</div>' +
        '<div class="alat"><span class="cari"><span class="ms">search</span><input class="input" id="c-cari" placeholder="Cari nama, email, nomor, tag" value="' + e(f.cari) + '" aria-label="Cari kontak"></span><select class="input" id="c-sumber" aria-label="Sumber"><option value="">Semua sumber</option><option value="pesan"' + (f.sumber === 'pesan' ? ' selected' : '') + '>Formulir kontak</option><option value="klien"' + (f.sumber === 'klien' ? ' selected' : '') + '>Klien</option><option value="manual"' + (f.sumber === 'manual' ? ' selected' : '') + '>Impor manual</option></select>' +
        '<select class="input" id="c-tag" aria-label="Tag"><option value="">Semua tag</option>' + Object.keys(L.facet.tag || {}).map(function (t) { return '<option' + (f.tag === t ? ' selected' : '') + '>' + e(t) + '</option>'; }).join('') + '</select>' +
        (f.statusWA || f.emailValid || f.optOut || f.duplikat || f.bermasalah ? '<button class="btn btn-teks" type="button" id="c-reset"><span class="ms">filter_alt_off</span>Hapus filter</button>' : '') + '</div>' +
        (L.rows.length ? '<div class="tabel-wadah"><table class="tabel"><thead><tr><th style="width:36px"><input type="checkbox" id="c-semua" aria-label="Pilih semua"></th><th>Nama</th><th>Email</th><th>WhatsApp</th><th>Tag</th><th>Dihubungi</th><th class="aksi"></th></tr></thead><tbody>' +
          L.rows.map(function (k) {
            var masalah = (!k.no_wa && k.email_valid !== 'YA') || k.duplikat;
            return '<tr data-id="' + e(k.id) + '" style="' + (masalah ? 'background:#FFFBEA' : '') + '"><td><input type="checkbox" data-pilih' + (pilih[k.id] ? ' checked' : '') + ' aria-label="Pilih ' + e(k.nama) + '"></td><td class="sel-utama"><b>' + e(k.nama || '–') + '</b><small>' + e(k.segmen) + (k.duplikat ? ' · <span style="color:var(--oranye)">duplikat</span>' : '') + (String(k.opt_out).toUpperCase() === 'YA' ? ' · <span style="color:var(--merah)">opt-out</span>' : '') + '</small></td>' +
              '<td>' + (k.email ? e(k.email) + ' ' + (k.email_valid === 'YA' ? '<span class="ms" style="font-size:16px;color:var(--hijau);vertical-align:-3px">check_circle</span>' : '<span class="ms" style="font-size:16px;color:var(--oranye);vertical-align:-3px">warning</span>') : '<span style="color:var(--abu)">–</span>') + '</td>' +
              '<td>' + (k.no_wa ? '<a class="mono" href="' + e(waLink(k.no_wa)) + '" target="_blank" rel="noopener">' + e(k.no_wa) + '</a> ' + (k.status_wa === 'Terdaftar' ? '<span class="lencana hijau">✓ WA</span>' : k.status_wa === 'Tidak Terdaftar' ? '<span class="lencana merah">✕</span>' : '<span class="lencana abu">?</span>') : '<span style="color:var(--abu)">–</span>') + '</td>' +
              '<td>' + String(k.tag || '').split(',').filter(Boolean).map(function (t) { return '<span class="chip" style="padding:2px 10px;font-size:11.5px">' + e(t) + '</span>'; }).join(' ') + '</td><td style="font-size:13px;color:var(--abu)">' + (k.terakhir_dihubungi ? e(API.relatif(k.terakhir_dihubungi)) : '–') + '<br>' + (Number(k.jumlah_pesan) || 0) + ' pesan</td><td class="aksi"><button class="btn btn-ikon mini" type="button" data-detail aria-label="Detail"><span class="ms">chevron_right</span></button></td></tr>';
          }).join('') + '</tbody></table></div><div class="paginasi"><span>' + L.total + ' kontak</span><span class="tombol"><button class="btn btn-ikon kecil" type="button" data-hal="-1"' + (f.halaman > 1 ? '' : ' disabled') + ' aria-label="Sebelumnya"><span class="ms">chevron_left</span></button><span style="align-self:center;padding:0 8px">' + f.halaman + ' / ' + Math.max(1, Math.ceil(L.total / f.per)) + '</span><button class="btn btn-ikon kecil" type="button" data-hal="1"' + (f.halaman * f.per < L.total ? '' : ' disabled') + ' aria-label="Berikutnya"><span class="ms">chevron_right</span></button></span></div>'
          : A.kosong('contacts', ST.total ? 'Tidak ada kontak yang cocok dengan filter.' : 'Belum ada kontak. Klik "Sinkron Sekarang" atau impor CSV.')) +
        '<div class="bilah-pilih" id="c-bilah" hidden><b id="c-n">0</b> dipilih<span style="flex:1"></span><button class="btn btn-garis btn-kecil" type="button" data-bulk="deteksi"><span class="ms">verified</span>Deteksi WA</button><button class="btn btn-garis btn-kecil" type="button" data-bulk="tag"><span class="ms">sell</span>Beri Tag</button><button class="btn btn-garis btn-kecil" type="button" data-bulk="blast"><span class="ms">campaign</span>Blast</button><button class="btn btn-garis btn-kecil" type="button" data-bulk="optout"><span class="ms">block</span>Opt-out</button><button class="btn btn-garis btn-kecil" type="button" data-bulk="optin"><span class="ms">check</span>Opt-in</button></div></section>';
      var segar = function () { var n = Object.keys(pilih).length; $('#c-bilah').hidden = !n; $('#c-n').textContent = n; };
      segar();
      var ulang = function () { f.halaman = 1; muat(); };
      $$('[data-kpi]', el).forEach(function (b) { b.onclick = function () { var k = b.dataset.kpi; f.statusWA = ''; f.emailValid = ''; f.optOut = ''; f.duplikat = false; if (k === 'duplikat') f.duplikat = true; else if (k) { var p = k.split(':'); f[p[0]] = p[1]; } ulang(); }; });
      $$('[data-seg]', el).forEach(function (b) { b.onclick = function () { f.segmen = b.dataset.seg; ulang(); }; });
      var tm; $('#c-cari').oninput = function () { var v = this.value; clearTimeout(tm); tm = setTimeout(function () { f.cari = v; ulang(); }, 350); };
      $('#c-sumber').onchange = function () { f.sumber = this.value; ulang(); };
      $('#c-tag').onchange = function () { f.tag = this.value; ulang(); };
      if ($('#c-reset')) $('#c-reset').onclick = function () { f.statusWA = f.emailValid = f.optOut = ''; f.duplikat = f.bermasalah = false; ulang(); };
      $$('[data-hal]', el).forEach(function (b) { b.onclick = function () { f.halaman += Number(b.dataset.hal); muat(); }; });
      if ($('#c-semua')) $('#c-semua').onchange = function () { var on = this.checked; L.rows.forEach(function (k) { if (on) pilih[k.id] = 1; else delete pilih[k.id]; }); $$('[data-pilih]', el).forEach(function (c) { c.checked = on; }); segar(); };
      $('section.panel', el).onchange = function (ev) { if (!ev.target.matches('[data-pilih]')) return; var id = ev.target.closest('tr').dataset.id; if (ev.target.checked) pilih[id] = 1; else delete pilih[id]; segar(); };
      $$('tbody tr', el).forEach(function (tr) { tr.onclick = function (ev) { if (ev.target.closest('input,a')) return; detail(tr.dataset.id); }; });
      $('#c-sync').onclick = function () { var b = this; A.sibuk(b, true); api('crm.sync').then(function (r) { A.sibuk(b, false); toast(r.message, r.ok ? '' : 'galat'); muat(); }); };
      $('#c-eks').onclick = function () {
        var b = this; A.sibuk(b, true);
        api('crm.ekspor', f).then(function (r) { if (!r.ok) throw new Error(r.message); return A.ekspor('CRM-Kontak-' + new Date().toISOString().slice(0, 10), [{ nama: 'Kontak', rows: r.data }]); })
          .then(function () { A.sibuk(b, false); toast('Ekspor selesai (tercatat di audit log).'); }).catch(function (x) { A.sibuk(b, false); toast(x.message, 'galat'); });
      };
      $('#c-imp').onclick = imporCSV;
      $$('[data-bulk]', el).forEach(function (b) { b.onclick = function () {
        var ids = Object.keys(pilih), a = b.dataset.bulk;
        if (a === 'blast') { A.S.blastPrefill = ids; location.hash = '#/notifikasi/blast'; return; }
        if (a === 'deteksi') { var no = L.rows.filter(function (k) { return pilih[k.id] && k.no_wa; }).map(function (k) { return k.no_wa; }); A.sibuk(b, true); return api('wa.validasi', { nomor: no.slice(0, 50) }).then(function (r) { A.sibuk(b, false); toast(r.ok ? 'Deteksi selesai: ' + Object.keys(r.data.peta).length + ' nomor.' : r.message, r.ok ? '' : 'galat'); muat(); }); }
        if (a === 'tag') return A.modal({ judul: 'Beri tag ke ' + ids.length + ' kontak', isi: A.bidang({ k: 'tag', label: 'Tag', maks: 30, placeholder: 'mis. mitra' }), tombol: [{ teks: 'Batal' }, { teks: 'Terapkan', kelas: 'btn-utama', aksi: function (m) { var t = $('[name=tag]', m.isi).value.trim(); if (!t) return false; return api('crm.bulk', { ids: ids, aksi: 'tag', nilai: t }).then(function (r) { toast(r.message, r.ok ? '' : 'galat'); pilih = {}; muat(); }); } }] });
        api('crm.bulk', { ids: ids, aksi: a }).then(function (r) { toast(r.message, r.ok ? '' : 'galat'); pilih = {}; muat(); });
      }; });
    };
    var detail = function (id) {
      var l = A.laci({ judul: 'Detail Kontak', isi: '<div class="skeleton" style="height:240px"></div>' });
      api('crm.detail', { id: id }).then(function (r) {
        if (!r.ok) { l.badan.innerHTML = A.kosong('error', r.message); return; }
        var k = r.data.kontak;
        l.badan.innerHTML = '<div style="display:flex;gap:14px;align-items:center"><span style="width:52px;height:52px;border-radius:50%;background:var(--navy);color:var(--kuning);display:grid;place-items:center;font-weight:800">' + e(A.inisial(k.nama)) + '</span><div><b style="color:var(--navy);font-size:17px">' + e(k.nama) + '</b><br><span class="lencana abu">' + e(k.segmen) + '</span> <span class="lencana abu">sumber: ' + e(k.sumber) + '</span></div></div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' + (k.no_wa ? '<a class="btn btn-hijau btn-kecil" href="' + e(waLink(k.no_wa)) + '" target="_blank" rel="noopener"><span class="ms">chat</span>WhatsApp</a>' : '') + (k.email ? '<a class="btn btn-utama btn-kecil" href="mailto:' + e(k.email) + '"><span class="ms">mail</span>Email</a>' : '') + '</div>' +
          '<form id="f-crm" class="grid-form" style="grid-template-columns:1fr" novalidate>' + A.bidang({ k: 'nama', label: 'Nama', nilai: k.nama, maks: 100 }) + A.bidang({ k: 'email', label: 'Email', nilai: k.email, tipe: 'email' }) + A.bidang({ k: 'no_wa', label: 'WhatsApp', nilai: k.no_wa }) +
          A.bidang({ k: 'tag', label: 'Tag (pisahkan koma)', nilai: k.tag }) + A.bidang({ k: 'catatan', label: 'Catatan', tipe: 'textarea', nilai: k.catatan, maks: 1000, baris: 3 }) + A.bidang({ k: 'opt_out', label: 'Opt-out blast', tipe: 'saklar', nilai: String(k.opt_out).toUpperCase() === 'YA', bantu: 'Notifikasi transaksional (tagihan) tetap dikirim.' }) +
          (k.sumber === 'klien' ? '<div class="info-kotak"><span class="ms">sync_alt</span><span>Perubahan nama/email/WA ditulis balik ke data Klien.</span></div>' : '') + '<button class="btn btn-utama" type="submit"><span class="ms">save</span>Simpan Kontak</button></form>' +
          '<div class="bagian-form"><h3><span class="ms">add_comment</span>Catat Interaksi</h3><form id="f-int" class="grid-form" style="grid-template-columns:1fr" novalidate>' + A.bidang({ k: 'kanal', label: 'Kanal', tipe: 'select', opsi: ['Telepon', 'WA Manual', 'Email', 'Kunjungan', 'Catatan'] }) + A.bidang({ k: 'ringkasan', label: 'Ringkasan', tipe: 'textarea', maks: 1000, baris: 3 }) + '<button class="btn btn-garis" type="submit">Catat</button></form></div>' +
          '<div class="bagian-form"><h3><span class="ms">timeline</span>Linimasa</h3>' + (r.data.timeline.length ? r.data.timeline.map(function (t) { return '<div class="status-baris" style="align-items:flex-start"><span style="flex-direction:column;align-items:flex-start;gap:2px"><b style="color:var(--navy);font-size:13px">' + e(t.kanal) + ' · ' + e(t.arah) + (t.status ? ' · ' + e(t.status) : '') + '</b><small style="white-space:pre-wrap">' + e(t.ringkasan) + '</small></span><small style="white-space:nowrap">' + e(API.relatif(t.waktu)) + '</small></div>'; }).join('') : '<p style="color:var(--abu);font-size:13px">Belum ada interaksi.</p>') + '</div>';
        $('#f-crm', l.badan).onsubmit = function (ev) { ev.preventDefault(); var d = A.ambil(this), b = $('button[type=submit]', this); d.id = id; A.sibuk(b, true); api('crm.simpan', d).then(function (x) { A.sibuk(b, false); toast(x.message, x.ok ? '' : 'galat'); if (x.ok) muat(); }); };
        $('#f-int', l.badan).onsubmit = function (ev) { ev.preventDefault(); var d = A.ambil(this); d.id = id; api('crm.interaksi', d).then(function (x) { toast(x.message, x.ok ? '' : 'galat'); if (x.ok) { l.tutup(); detail(id); } }); };
      });
    };
    var imporCSV = function () {
      var rows = [];
      var m = A.modal({ judul: 'Import Kontak dari CSV', lebar: true, isi: '<p style="color:var(--abu-2);font-size:14px">Kolom: <code>nama, email, wa, segmen, tag</code>. Kontak dengan nomor/email yang sama diperbarui, tidak digandakan.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-garis btn-kecil" type="button" id="unduh-tpl"><span class="ms">download</span>Unduh template</button></div>' +
        '<label class="zona-seret"><span class="ms" style="font-size:32px;color:var(--utama)">upload_file</span><b>Pilih berkas .csv</b><small id="nm-csv" style="color:var(--abu)">Belum ada berkas</small><input type="file" accept=".csv,text/csv" class="sr-only" id="in-csv"></label><div id="pv-csv"></div>',
        tombol: [{ teks: 'Batal' }, { teks: '<span class="ms">upload</span>Impor', kelas: 'btn-utama', aksi: function () { if (!rows.length) { toast('Pilih berkas CSV terlebih dahulu.', 'galat'); return false; } return api('crm.import', { rows: rows }).then(function (r) { toast(r.message, r.ok ? '' : 'galat'); if (r.ok) muat(); else return false; }); } }] });
      $('#unduh-tpl', m.isi).onclick = function () { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['nama,email,wa,segmen,tag\nBudi Santoso,budi@contoh.id,081234567890,Calon Klien,seminar\n'], { type: 'text/csv' })); a.download = 'template-kontak.csv'; a.click(); };
      $('#in-csv', m.isi).onchange = function () {
        var fl = this.files[0]; if (!fl) return;
        var fr = new FileReader();
        fr.onload = function () {
          rows = parseCSV(String(fr.result)).slice(0, 5000);
          $('#nm-csv', m.isi).textContent = fl.name + ' · ' + rows.length + ' baris';
          $('#pv-csv', m.isi).innerHTML = rows.length ? '<div class="tabel-wadah" style="max-height:220px;overflow:auto"><table class="tabel"><thead><tr><th>Nama</th><th>Email</th><th>WA</th><th>Segmen</th><th>Tag</th></tr></thead><tbody>' + rows.slice(0, 20).map(function (r) { return '<tr><td>' + e(r.nama) + '</td><td>' + e(r.email) + '</td><td class="mono">' + e(r.wa || r.no_wa || r.whatsapp) + '</td><td>' + e(r.segmen) + '</td><td>' + e(r.tag) + '</td></tr>'; }).join('') + '</tbody></table></div><small style="color:var(--abu)">Pratinjau 20 baris pertama.</small>' : A.kosong('error', 'Berkas kosong atau format tidak dikenali.');
          rows.forEach(function (r) { if (!r.wa) r.wa = r.no_wa || r.whatsapp || r.hp || ''; });
        };
        fr.readAsText(fl);
      };
    };
    muat();
  } };
})();