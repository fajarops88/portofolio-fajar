/*
 * admin-rekam.js — modul rekam jejak di bagian "Tentang Saya":
 *   Sertifikat (PDF privat → gambar publik via pdf.js), Agenda Kegiatan (kuliah/seminar/rapat, berulang mingguan),
 *   Kinerja Harian, dan Wawasan & Insight (artikel terjadwal).
 * Data disimpan lewat konten.* (CRUD generik); PDF sertifikat lewat sertifikat.pdf / sertifikat.gambar / sertifikat.privat.
 * Semua isi dari server ditampilkan lewat esc() — tidak ada innerHTML dari data mentah.
 */
(function () {
  'use strict';
  var A = window.ADM, $ = A.$, $$ = A.$$, e = A.e, api = A.api, toast = A.toast;
  var KAT_AGENDA = [['Kuliah', 'school', 'biru'], ['Seminar', 'campaign', 'kuning'], ['Rapat', 'groups', 'hijau'], ['Lainnya', 'event', 'abu']];
  var JENIS_SERT = ['Sertifikat', 'Piagam', 'Penghargaan', 'Lisensi', 'Surat Keputusan', 'Ijazah'];
  var PER_HAL = 30;

  /* =====================================================================
   * BANTUAN BERSAMA
   * ===================================================================== */
  function daftar(tabel, paksa) {
    var c = A.S.cache.konten;
    if (!paksa && c && c[tabel] && !(c._belumSetup && c._belumSetup.indexOf(tabel) > -1)) return Promise.resolve(c[tabel]);
    return api('konten.list', { tabel: tabel }).then(function (r) {
      if (!r.ok) { var g = new Error(r.message); g.kode = r.code; throw g; }
      A.S.cache.konten = A.S.cache.konten || {};
      A.S.cache.konten[tabel] = r.data;
      if (A.S.cache.konten._belumSetup) A.S.cache.konten._belumSetup = A.S.cache.konten._belumSetup.filter(function (t) { return t !== tabel; });
      return r.data;
    });
  }
  function simpanLokal(tabel, row) {
    var l = A.S.cache.konten[tabel], i = l.findIndex(function (z) { return z.id === row.id; });
    if (i > -1) l[i] = row; else l.unshift(row);
  }
  function galatModul(el, x) {
    el.innerHTML = x.kode === 'SETUP'
      ? '<div class="kepala-hal"><div><h1>Perlu satu langkah lagi</h1><p>Database belum punya sheet untuk menu ini.</p></div></div><div class="info-kotak kuning"><span class="ms">build</span><span>Buka <b>editor Apps Script</b> → pilih fungsi <b>setupAppEnvironment</b> → klik <b>Jalankan</b>. Setup aman diulang: data yang sudah ada tidak diubah. Setelah selesai, muat ulang halaman ini.</span></div>'
      : A.kosong('error', x.message);
  }
  function kepala(judul, ket, tombol, jangkar) {
    return '<div class="kepala-hal"><div><h1>' + e(judul) + '</h1><p>' + ket + '</p></div><div class="aksi"><a class="btn btn-garis" href="./#' + (jangkar || 'about') + '" target="_blank" rel="noopener"><span class="ms">visibility</span>Pratinjau</a>' + tombol + '</div></div>';
  }
  function kpi(label, ikon, nilai, ket, sorot) {
    return '<div class="panel kpi' + (sorot ? ' sorot' : '') + '"><div class="atas">' + e(label) + '<span class="ms">' + ikon + '</span></div><b>' + nilai + '</b><small>' + ket + '</small></div>';
  }
  function saklarItem(r) { return '<label class="saklar" title="Tampil di landing page"><input type="checkbox" data-tampil' + (r.tampil === 'Ya' ? ' checked' : '') + ' aria-label="Tampilkan di situs"><span></span></label>'; }
  function tombolMini(attr, ikon, label, merah) { return '<button class="btn btn-ikon mini' + (merah ? ' merah' : '') + '" type="button" ' + attr + ' aria-label="' + e(label) + '" title="' + e(label) + '"><span class="ms">' + ikon + '</span></button>'; }
  function cocokCari(r, q) { return !q || JSON.stringify(r).toLowerCase().indexOf(q.toLowerCase()) > -1; }
  function bulanTahun(s) { var m = String(s || '').match(/^(\d{4})-(\d{2})/); return m ? API.BULAN_PANJANG[+m[2] - 1] + ' ' + m[1] : ''; }
  /** tombol tampil, ubah, hapus untuk daftar .item (data-id) */
  function pasangAksiDaftar(el, tabel, opsi) {
    var d = $('#daftar', el); if (!d) return;
    var cari = function (it) { return A.S.cache.konten[tabel].filter(function (z) { return z.id === it.dataset.id; })[0]; };
    d.addEventListener('click', function (ev) {
      var it = ev.target.closest('.item'); if (!it) return;
      var r = cari(it); if (!r) return;
      if (ev.target.closest('[data-ubah]')) opsi.ubah(r);
      if (ev.target.closest('[data-salin]') && opsi.salin) opsi.salin(r);
      if (ev.target.closest('[data-gambar]') && opsi.gambar) opsi.gambar(r, ev.target.closest('[data-gambar]'));
      if (ev.target.closest('[data-hapus]')) A.konfirmasi('Hapus ' + opsi.tunggal + '?', '"' + (r.nama || r.judul || r.kegiatan || '') + '" akan dihapus permanen.' + (opsi.catatanHapus || ''), 'Hapus', true).then(function (ya) {
        if (!ya) return;
        api('konten.hapus', { tabel: tabel, ids: [r.id] }).then(function (x) {
          if (!x.ok) return toast(x.message, 'galat');
          A.S.cache.konten[tabel] = A.S.cache.konten[tabel].filter(function (z) { return z.id !== r.id; });
          toast(x.message); opsi.gambarUlang();
        });
      });
    });
    d.addEventListener('change', function (ev) {
      if (!ev.target.matches('[data-tampil]')) return;
      var it = ev.target.closest('.item'), on = ev.target.checked, r = cari(it);
      r.tampil = on ? 'Ya' : 'Tidak'; it.classList.toggle('tersembunyi', !on);
      api('konten.tampil', { tabel: tabel, id: r.id, tampil: on }).then(function (x) {
        if (!x.ok) { r.tampil = on ? 'Tidak' : 'Ya'; ev.target.checked = !on; it.classList.toggle('tersembunyi', on); return toast(x.message, 'galat'); }
        toast(x.message); if (opsi.setelahTampil) opsi.setelahTampil();
      });
    });
  }
  /** daftar bertahap: tampilkan n pertama + tombol "muat lebih banyak" */
  function potong(rows, n) {
    return { rows: rows.slice(0, n), lebih: rows.length > n ? '<div style="display:flex;justify-content:center;margin-top:14px"><button class="btn btn-garis btn-kecil" type="button" id="b-lebih"><span class="ms">expand_more</span>Tampilkan ' + Math.min(PER_HAL, rows.length - n) + ' lagi (' + (rows.length - n) + ' tersisa)</button></div>' : '' };
  }
  /** blok unggah gambar (pratinjau + pilih + hapus); onPilih(berkas|null) */
  function blokGambar(id, url, label, bantu, rasio) {
    return '<div class="bidang penuh"><span class="label">' + e(label) + '</span><div class="unggah-foto lebar"><span class="pratinjau" id="pv-' + id + '"' + (rasio ? ' style="aspect-ratio:' + rasio + ';height:auto"' : '') + '>' + (url ? '<img src="' + e(url) + '" alt="" referrerpolicy="no-referrer">' : '<span class="ms">image</span>') + '</span>' +
      '<div style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;gap:8px;flex-wrap:wrap"><label class="btn btn-garis btn-kecil"><span class="ms">upload_file</span>Pilih Gambar<input type="file" accept="image/jpeg,image/png,image/webp" id="in-' + id + '" class="sr-only"></label>' +
      '<button class="btn btn-teks btn-kecil" type="button" id="hapus-' + id + '"' + (url ? '' : ' hidden') + '><span class="ms">delete</span>Hapus</button></div><small style="color:var(--abu)" id="ket-' + id + '">' + e(bantu) + '</small></div></div><span class="galat"></span></div>';
  }
  function pasangBlokGambar(akar, id, maks, onPilih) {
    var inp = $('#in-' + id, akar), hapus = $('#hapus-' + id, akar);
    inp.onchange = function () {
      var fl = inp.files[0]; if (!fl) return;
      API.kompresGambar(fl, maks || 1600, .84).then(function (b) {
        if (b.ukuran > 2 * 1024 * 1024) throw new Error('Gambar ' + (b.ukuran / 1048576).toFixed(1) + ' MB melebihi batas 2 MB setelah dikompres.');
        $('#pv-' + id, akar).innerHTML = '<img src="data:' + b.mime + ';base64,' + b.b64 + '" alt="">';
        $('#ket-' + id, akar).textContent = fl.name + ' · ' + Math.round(b.ukuran / 1024) + ' KB (diunggah saat disimpan)';
        hapus.hidden = false;
        onPilih({ nama: b.nama, mime: b.mime, b64: b.b64 });
      }).catch(function (z) { toast(z.message, 'galat'); });
      inp.value = '';
    };
    hapus.onclick = function () { $('#pv-' + id, akar).innerHTML = '<span class="ms">image</span>'; $('#ket-' + id, akar).textContent = 'Gambar akan dihapus saat disimpan.'; hapus.hidden = true; onPilih(null); };
  }
  /** kirim form: respon VALIDASI → tandai bidang; sukses → simpan ke cache */
  function kirimForm(f, tabel, kirim, selesai) {
    return api('konten.simpan', kirim, { timeout: 180000 }).then(function (r) {
      if (!r.ok) { A.tandaiGalat(f, r.data && r.data.galat); toast(r.message, 'galat'); return false; }
      simpanLokal(tabel, r.data); toast(r.message); selesai(r.data);
    });
  }

  /* ---------- PDF → gambar (halaman 1) ---------- */
  var pdfSiap = null;
  function muatPdfJs() {
    if (!pdfSiap) pdfSiap = API.muatSkrip(API.LIB.pdfjs).then(function () {
      if (!window.pdfjsLib) throw new Error('pdf.js tidak tersedia.');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = API.LIB.pdfjsWorker;
      return window.pdfjsLib;
    }).catch(function (x) { pdfSiap = null; throw new Error('Pustaka PDF gagal dimuat (periksa koneksi): ' + x.message); });
    return pdfSiap;
  }
  function b64keBytes(b64) { var s = atob(b64), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  /** b64 PDF → { nama, mime:'image/jpeg', b64, ukuran } (halaman pertama, sisi terpanjang ≤ 1600 px) */
  function gambarDariPdf(b64, nama) {
    return muatPdfJs().then(function (lib) { return lib.getDocument({ data: b64keBytes(b64), isEvalSupported: false }).promise; }).then(function (doc) {
      return doc.getPage(1).then(function (hal) {
        var v1 = hal.getViewport({ scale: 1 }), skala = Math.min(4, 1600 / Math.max(v1.width, v1.height)), vp = hal.getViewport({ scale: skala });
        var cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
        var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
        return hal.render({ canvasContext: cx, viewport: vp }).promise.then(function () {
          var url = cv.toDataURL('image/jpeg', .85), out = url.split(',')[1];
          try { doc.destroy(); } catch (z) {}
          return { nama: String(nama || 'sertifikat').replace(/\.pdf$/i, '') + '.jpg', mime: 'image/jpeg', b64: out, ukuran: Math.round(out.length * .75) };
        });
      });
    });
  }
  /** sumber sertifikat berupa gambar (bukan PDF) → kompres ulang */
  function gambarDariB64(b64, mime, nama) {
    var blob = new Blob([b64keBytes(b64)], { type: mime }), fl;
    try { fl = new File([blob], nama || 'sertifikat.jpg', { type: mime }); } catch (z) { fl = blob; fl.name = nama || 'sertifikat.jpg'; }
    return API.kompresGambar(fl, 1600, .85);
  }
  function bacaB64(fl) {
    return new Promise(function (ok, gagal) {
      var fr = new FileReader();
      fr.onload = function () { ok(String(fr.result).split(',')[1] || ''); };
      fr.onerror = function () { gagal(new Error('Gagal membaca berkas.')); };
      fr.readAsDataURL(fl);
    });
  }

  /* =====================================================================
   * MODUL: SERTIFIKAT
   * ===================================================================== */
  A.MODUL.sertifikat = { judul: 'Sertifikat', ikon: 'workspace_premium', render: function (el, param) {
    var f = { cari: '', jenis: '', status: '' }, n = PER_HAL;
    var gambar = function () {
      var semua = A.S.cache.konten.Sertifikat || [];
      var tampilSitus = semua.filter(function (r) { return r.tampil === 'Ya' && r.url_gambar; }).length;
      var belum = semua.filter(function (r) { return !r.url_gambar && r.pdf_id; });
      var publik = semua.filter(function (r) { return r.pdf_id && r.pdf_privat !== 'Ya'; });
      var jenis = {}; semua.forEach(function (r) { jenis[r.jenis || 'Sertifikat'] = (jenis[r.jenis || 'Sertifikat'] || 0) + 1; });
      var rows = semua.filter(function (r) {
        if (!cocokCari(r, f.cari)) return false;
        if (f.jenis && (r.jenis || 'Sertifikat') !== f.jenis) return false;
        if (f.status === 'tampil') return r.tampil === 'Ya' && !!r.url_gambar;
        if (f.status === 'sembunyi') return r.tampil !== 'Ya';
        if (f.status === 'belum') return !r.url_gambar;
        if (f.status === 'publik') return r.pdf_id && r.pdf_privat !== 'Ya';
        return true;
      });
      var p = potong(rows, n);
      el.innerHTML = kepala('Sertifikat', 'PDF disimpan <b>privat</b> di Google Drive. Pengunjung situs hanya melihat <b>gambar</b> sertifikat (halaman pertama PDF).', '<button class="btn btn-utama" type="button" id="b-tambah"><span class="ms">add</span>Tambah sertifikat</button>') +
        '<div class="grid-kpi">' + kpi('Total sertifikat', 'workspace_premium', A.angka(semua.length), Object.keys(jenis).length + ' jenis') +
        kpi('Tampil di situs', 'public', A.angka(tampilSitus), 'punya gambar & diaktifkan') +
        kpi('Belum bergambar', 'image_not_supported', A.angka(belum.length), belum.length ? '<button class="btn btn-teks btn-kecil" type="button" id="b-massal" style="padding:0;min-height:0">Buat gambar dari PDF →</button>' : 'semua sudah punya gambar', belum.length) +
        kpi('PDF bisa dibuka lewat link', 'link', A.angka(publik.length), publik.length ? '<button class="btn btn-teks btn-kecil" type="button" id="b-privat" style="padding:0;min-height:0">Jadikan privat →</button>' : 'semua PDF privat') + '</div>' +
        (belum.length ? '<div class="info-kotak kuning" style="margin-bottom:20px"><span class="ms">info</span><span><b>' + belum.length + ' sertifikat belum punya gambar</b> sehingga belum tampil di situs. Gambar dibuat otomatis dari halaman pertama PDF di browser ini (±3–6 detik per sertifikat).</span></div>' : '') +
        '<section class="panel"><div class="alat"><span class="cari"><span class="ms">search</span><input class="input" id="cari" placeholder="Cari nama, penerbit, tahun…" value="' + e(f.cari) + '" aria-label="Cari sertifikat"></span>' +
        '<select class="input" id="f-jenis" aria-label="Filter jenis"><option value="">Semua jenis</option>' + Object.keys(jenis).sort().map(function (j) { return '<option' + (f.jenis === j ? ' selected' : '') + '>' + e(j) + '</option>'; }).join('') + '</select>' +
        '<select class="input" id="f-status" aria-label="Filter status">' + [['', 'Semua status'], ['tampil', 'Tampil di situs'], ['sembunyi', 'Disembunyikan'], ['belum', 'Belum bergambar'], ['publik', 'PDF masih bisa dibuka lewat link']].map(function (o) { return '<option value="' + o[0] + '"' + (f.status === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="panel-kepala" style="margin-top:6px"><div><p>Diurutkan dari tahun terbaru. ' + rows.length + ' dari ' + semua.length + ' sertifikat.</p></div></div>' +
        (rows.length ? '<div class="daftar-item" id="daftar">' + p.rows.map(item).join('') + '</div>' + p.lebih : A.kosong('workspace_premium', semua.length ? 'Tidak ada sertifikat yang cocok dengan filter.' : 'Belum ada sertifikat. Tambahkan, atau impor dari situs lama lewat menu Migrasi.')) + '</section>';
      $('#b-tambah').onclick = function () { form({}); };
      if ($('#b-massal')) $('#b-massal').onclick = function () { massal(belum); };
      if ($('#b-privat')) $('#b-privat').onclick = function () { jadikanPrivat(publik); };
      if ($('#b-lebih')) $('#b-lebih').onclick = function () { n += PER_HAL; gambar(); };
      var tm; $('#cari').oninput = function () { var v = this.value; clearTimeout(tm); tm = setTimeout(function () { f.cari = v; n = PER_HAL; gambar(); var c = $('#cari'); c.focus(); c.setSelectionRange(v.length, v.length); }, 300); };
      $('#f-jenis').onchange = function () { f.jenis = this.value; n = PER_HAL; gambar(); };
      $('#f-status').onchange = function () { f.status = this.value; n = PER_HAL; gambar(); };
      pasangAksiDaftar(el, 'Sertifikat', { tunggal: 'sertifikat', ubah: form, gambarUlang: gambar, setelahTampil: gambar, catatanHapus: ' Gambar publiknya ikut dihapus; berkas PDF tetap tersimpan di Google Drive.',
        gambar: function (r, b) { A.sibuk(b, true); buatGambar(r).then(function () { toast('Gambar sertifikat diperbarui.'); gambar(); }).catch(function (x) { A.sibuk(b, false); toast(x.message, 'galat'); }); } });
    };
    var item = function (r) {
      var sembunyi = r.tampil !== 'Ya' || !r.url_gambar;
      return '<div class="item' + (sembunyi ? ' tersembunyi' : '') + '" data-id="' + e(r.id) + '"><span class="gambar" style="width:64px;height:46px">' + (r.url_gambar ? '<img src="' + e(r.url_gambar) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="ms">workspace_premium</span>') + '</span>' +
        '<span class="badan"><b>' + e(r.nama) + '</b><small>' + e([r.penerbit, r.tahun, r.jenis].filter(Boolean).join(' · ')) + '</small></span><span class="ujung">' +
        (!r.url_gambar ? '<span class="lencana oranye">Belum bergambar</span>' : '') + (r.pdf_id && r.pdf_privat !== 'Ya' ? '<span class="lencana kuning" title="PDF masih bisa dibuka siapa pun yang punya link-nya (diatur situs lama)">PDF publik</span>' : '') +
        saklarItem(r) + (r.pdf_id ? '<a class="btn btn-ikon mini" href="https://drive.google.com/file/d/' + e(r.pdf_id) + '/view" target="_blank" rel="noopener" aria-label="Buka PDF" title="Buka PDF (hanya Anda)"><span class="ms">picture_as_pdf</span></a>' + tombolMini('data-gambar', 'autorenew', 'Buat ulang gambar dari PDF') : '') +
        tombolMini('data-ubah', 'edit', 'Ubah') + tombolMini('data-hapus', 'delete', 'Hapus', true) + '</span></div>';
    };
    /** satu sertifikat: ambil PDF → render halaman 1 → simpan gambar */
    var buatGambar = function (r) {
      return api('sertifikat.pdf', { id: r.id }, { timeout: 120000 }).then(function (x) {
        if (!x.ok) throw new Error(x.message);
        return x.data.mime === 'application/pdf' ? gambarDariPdf(x.data.b64, x.data.nama) : gambarDariB64(x.data.b64, x.data.mime, x.data.nama);
      }).then(function (g) {
        if (g.ukuran > 2 * 1024 * 1024) throw new Error('Gambar hasil render ' + (g.ukuran / 1048576).toFixed(1) + ' MB terlalu besar.');
        return api('sertifikat.gambar', { id: r.id, berkas: { nama: g.nama, mime: g.mime, b64: g.b64 }, massal: true }, { timeout: 120000 });
      }).then(function (x) {
        if (!x.ok) throw new Error(x.message);
        r.url_gambar = x.data.url_gambar; r.gambar_id = x.data.gambar_id;
        return r;
      });
    };
    var massal = function (antre) {
      var jalan = false, henti = false, selesai = 0, gagal = [];
      var m = A.modal({ judul: 'Buat gambar dari PDF', isi: '<p style="color:var(--abu-2)">Halaman pertama setiap PDF dijadikan gambar JPG lalu disimpan di folder <b>Sertifikat</b> (gambar dibagikan agar tampil di situs; PDF tetap tidak dibagikan oleh app ini).</p>' +
        '<div class="info-kotak"><span class="ms">schedule</span><span>' + antre.length + ' sertifikat · perkiraan ' + Math.max(1, Math.round(antre.length * 4 / 2 / 60)) + ' menit. Biarkan tab ini terbuka sampai selesai.</span></div>' +
        '<div class="bilah" style="height:10px;border-radius:99px;background:var(--permukaan-tinggi);overflow:hidden"><i id="mg-bilah" style="display:block;height:100%;width:0;background:var(--utama);transition:width .3s"></i></div><p id="mg-status" style="font-size:14px;color:var(--abu-2)">Siap.</p><div id="mg-galat"></div>',
        tombol: [{ teks: 'Tutup', aksi: function () { henti = true; gambar(); } }, { teks: '<span class="ms">play_arrow</span>Mulai', kelas: 'btn-utama', aksi: function (mm, b) {
          if (jalan) { henti = true; b.disabled = true; return false; }
          jalan = true; b.innerHTML = '<span class="ms">stop</span>Hentikan';
          var antrean = antre.slice(), status = $('#mg-status', mm.isi), bilah = $('#mg-bilah', mm.isi);
          var perbarui = function (teks) { bilah.style.width = Math.round((selesai + gagal.length) / antre.length * 100) + '%'; status.textContent = teks || ((selesai + gagal.length) + ' / ' + antre.length + ' diproses · ' + selesai + ' berhasil' + (gagal.length ? ' · ' + gagal.length + ' gagal' : '')); };
          var pekerja = function () {
            if (henti || !antrean.length) return Promise.resolve();
            var r = antrean.shift();
            return buatGambar(r).then(function () { selesai++; }, function (x) { gagal.push(r.nama + ': ' + x.message); }).then(function () { perbarui(); return pekerja(); });
          };
          muatPdfJs().then(function () { perbarui(); return Promise.all([pekerja(), pekerja()]); }).catch(function (x) { gagal.push(x.message); }).then(function () {
            jalan = false; b.innerHTML = '<span class="ms">done</span>Selesai'; b.disabled = true;
            perbarui((henti ? 'Dihentikan. ' : 'Selesai. ') + selesai + ' gambar dibuat' + (gagal.length ? ', ' + gagal.length + ' gagal.' : '.'));
            if (gagal.length) $('#mg-galat', mm.isi).innerHTML = '<div class="info-kotak merah" style="flex-direction:column;align-items:flex-start"><b>Gagal (' + gagal.length + ')</b><ul style="margin:4px 0 0;padding-left:18px;font-size:13px">' + gagal.slice(0, 8).map(function (g) { return '<li>' + e(g) + '</li>'; }).join('') + '</ul><small>Coba lagi nanti, atau unggah gambarnya manual lewat tombol Ubah.</small></div>';
            if (selesai) toast(selesai + ' gambar sertifikat dibuat.');
          });
          return false;
        } }] });
    };
    var jadikanPrivat = function (rows) {
      A.konfirmasi('Jadikan semua PDF privat?', rows.length + ' PDF sertifikat masih bisa dibuka siapa pun yang punya link-nya (diatur situs Fajarfk lama). Setelah dijadikan privat, hanya akun Anda yang bisa membukanya — termasuk tautan PDF di situs lama tidak bisa dibuka pengunjung lagi. Gambar di situs baru tidak terpengaruh.', 'Jadikan privat', true).then(function (ya) {
        if (!ya) return;
        var ids = rows.map(function (r) { return r.id; }), total = { privat: 0, gagal: 0, galat: [] };
        toast('Memproses ' + ids.length + ' PDF…', 'info');
        var langkah = function () {
          if (!ids.length) return Promise.resolve();
          return api('sertifikat.privat', { ids: ids.splice(0, 25) }, { timeout: 120000 }).then(function (x) {
            if (!x.ok) throw new Error(x.message);
            total.privat += x.data.privat; total.gagal += x.data.gagal; total.galat = total.galat.concat(x.data.galat);
            return langkah();
          });
        };
        langkah().then(function () {
          toast(total.privat + ' PDF dijadikan privat' + (total.gagal ? ', ' + total.gagal + ' gagal: ' + total.galat.slice(0, 2).join('; ') : '.'), total.gagal ? 'galat' : '');
        }).catch(function (x) { toast(x.message, 'galat'); }).then(function () { daftar('Sertifikat', true).then(gambar); });
      });
    };
    var form = function (x) {
      var baru = !x.id, pdf = null, gbr = null, hapusGbr = false, jenis = {};
      JENIS_SERT.concat((A.S.cache.konten.Sertifikat || []).map(function (r) { return r.jenis; })).forEach(function (j) { if (j) jenis[j] = 1; });
      A.modal({ judul: (baru ? 'Tambah' : 'Ubah') + ' sertifikat', lebar: true, isi: '<form id="f-sert" novalidate><div class="grid-form">' +
        '<div class="bidang penuh"><span class="label">Berkas PDF sertifikat (privat)</span><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><label class="btn btn-utama btn-kecil"><span class="ms">picture_as_pdf</span>' + (x.pdf_id ? 'Ganti PDF' : 'Pilih PDF') + '<input type="file" accept="application/pdf" id="in-pdf" class="sr-only"></label>' +
        (x.pdf_id ? '<a class="btn btn-teks btn-kecil" href="https://drive.google.com/file/d/' + e(x.pdf_id) + '/view" target="_blank" rel="noopener"><span class="ms">open_in_new</span>Buka PDF saat ini</a>' : '') +
        '<small style="color:var(--abu)" id="ket-pdf">Maks. 8 MB. Tidak dibagikan — hanya Anda yang bisa membukanya.</small></div><span class="galat"></span></div>' +
        blokGambar('gbr', x.url_gambar, 'Gambar untuk situs publik', 'Dibuat otomatis dari halaman 1 PDF. Bisa juga pilih gambar sendiri (JPG/PNG).', '1.414/1') +
        A.bidang({ k: 'nama', label: 'Nama sertifikat / pelatihan', nilai: x.nama, wajib: true, maks: 200, penuh: true }) +
        A.bidang({ k: 'penerbit', label: 'Penerbit / penyelenggara', nilai: x.penerbit, maks: 150 }) +
        A.bidang({ k: 'tahun', label: 'Tahun', nilai: x.tahun, maks: 4, placeholder: '2019', atribut: ' inputmode="numeric"' }) +
        A.bidang({ k: 'jenis', label: 'Jenis', nilai: x.jenis || 'Sertifikat', maks: 40, atribut: ' list="dl-jenis"' }) + '<datalist id="dl-jenis">' + Object.keys(jenis).map(function (j) { return '<option value="' + e(j) + '">'; }).join('') + '</datalist>' +
        A.bidang({ k: 'tampil', label: 'Tampilkan di situs', tipe: 'saklar', nilai: x.tampil === undefined ? true : x.tampil, bantu: 'Hanya sertifikat yang punya gambar yang muncul di situs.' }) + '</div></form>',
        tombol: [{ teks: 'Batal' }, { teks: '<span class="ms">save</span>' + (baru ? 'Tambahkan' : 'Simpan'), kelas: 'btn-utama', aksi: function (mm) {
          var fm = $('#f-sert', mm.isi), data = A.ambil(fm);
          if (x.id) data.id = x.id;
          var kirim = { tabel: 'Sertifikat', data: data };
          if (pdf) kirim.pdf = pdf;
          if (gbr) kirim.berkas = gbr; else if (hapusGbr) kirim.hapusGambar = true;
          return kirimForm(fm, 'Sertifikat', kirim, gambar);
        } }],
        saatBuka: function (m) {
          pasangBlokGambar(m.isi, 'gbr', 1600, function (b) { gbr = b; hapusGbr = !b; });
          $('#in-pdf', m.isi).onchange = function () {
            var fl = this.files[0], ket = $('#ket-pdf', m.isi); if (!fl) return;
            if (fl.size > 8 * 1024 * 1024) { toast('PDF ' + (fl.size / 1048576).toFixed(1) + ' MB melebihi batas 8 MB.', 'galat'); this.value = ''; return; }
            ket.textContent = 'Membaca ' + fl.name + '…';
            bacaB64(fl).then(function (b64) {
              pdf = { nama: fl.name, mime: 'application/pdf', b64: b64 };
              ket.textContent = fl.name + ' · ' + Math.round(fl.size / 1024) + ' KB · membuat gambar…';
              var nm = $('[name=nama]', m.isi); if (!nm.value) nm.value = fl.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
              return gambarDariPdf(b64, fl.name).then(function (g) {
                if (gbr && !gbr._dariPdf) { ket.textContent = fl.name + ' siap diunggah (gambar pilihan Anda dipertahankan).'; return; }
                gbr = { nama: g.nama, mime: g.mime, b64: g.b64, _dariPdf: true }; hapusGbr = false;
                $('#pv-gbr', m.isi).innerHTML = '<img src="data:image/jpeg;base64,' + g.b64 + '" alt="">'; $('#hapus-gbr', m.isi).hidden = false;
                $('#ket-gbr', m.isi).textContent = 'Dibuat dari halaman 1 PDF · ' + Math.round(g.ukuran / 1024) + ' KB';
                ket.textContent = fl.name + ' · ' + Math.round(fl.size / 1024) + ' KB (diunggah saat disimpan)';
              }, function (z) { ket.textContent = fl.name + ' siap diunggah, tetapi gambar gagal dibuat: ' + z.message + ' Pilih gambar manual.'; });
            }).catch(function (z) { pdf = null; toast(z.message, 'galat'); });
            this.value = '';
          };
        } });
    };
    daftar('Sertifikat').then(function () { gambar(); if (param && param[0] === 'baru') form({}); }).catch(function (x) { galatModul(el, x); });
  } };

  /* =====================================================================
   * MODUL: AGENDA KEGIATAN
   * ===================================================================== */
  function katAgenda(k) { return KAT_AGENDA.filter(function (x) { return x[0] === k; })[0] || KAT_AGENDA[3]; }
  function jamAgenda(a) { return a.jam_mulai ? a.jam_mulai + (a.jam_selesai ? '–' + a.jam_selesai : '') : 'Sepanjang hari'; }
  A.MODUL.agenda = { judul: 'Agenda Kegiatan', ikon: 'event', render: function (el, param) {
    var f = { cari: '', kat: '', waktu: 'aktif' }, n = PER_HAL;
    var gambar = function () {
      var semua = A.S.cache.konten.Agenda || [], hari = API.hariIniYmd();
      var pekan = API.jabarkanAgenda(semua, hari, API.geserTgl(hari, 6));      // termasuk yang disembunyikan (ditampilkan pudar)
      var akhir = function (a) { return a.ulang_hari ? (a.ulang_sampai || a.tanggal) : a.tanggal; };
      var rows = semua.filter(function (a) {
        if (!cocokCari(a, f.cari) || (f.kat && a.kategori !== f.kat)) return false;
        if (f.waktu === 'aktif') return akhir(a) >= hari;
        if (f.waktu === 'lewat') return akhir(a) < hari;
        return true;
      });
      if (f.waktu === 'aktif') rows = rows.slice().sort(function (a, b) {   // mendatang: yang paling dekat di atas
        var x = String(a.tanggal) + String(a.jam_mulai || '99'), y = String(b.tanggal) + String(b.jam_mulai || '99'); return x < y ? -1 : x > y ? 1 : 0; });
      var p = potong(rows, n), hitung = {};
      semua.forEach(function (a) { hitung[a.kategori] = (hitung[a.kategori] || 0) + 1; });
      var grup = {}; pekan.forEach(function (k) { (grup[k.tgl] = grup[k.tgl] || []).push(k); });
      el.innerHTML = kepala('Agenda Kegiatan', 'Jadwal kuliah, seminar, dan rapat. Agenda mingguan (mis. kuliah tiap Senin) cukup dibuat sekali. Tempat hanya tampil di situs bila Anda mengizinkannya.', '<button class="btn btn-utama" type="button" id="b-tambah"><span class="ms">add</span>Tambah agenda</button>') +
        '<div class="grid-2 lebar-kiri" style="margin-bottom:20px"><section class="panel"><div class="panel-kepala"><div><h2><span class="ms">date_range</span>7 Hari ke Depan</h2><p>' + e(API.tglHari(hari, true)) + ' – ' + e(API.tglHari(API.geserTgl(hari, 6))) + '</p></div><span class="lencana biru">' + pekan.length + ' kegiatan</span></div>' +
        (pekan.length ? Object.keys(grup).map(function (t) {
          return '<div style="margin-bottom:12px"><b style="font-size:13px;color:var(--navy)">' + (t === hari ? 'Hari ini · ' : t === API.geserTgl(hari, 1) ? 'Besok · ' : '') + e(API.tglHari(t, true)) + '</b>' + grup[t].map(function (k) {
            var c = katAgenda(k.kategori);
            return '<div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--garis);font-size:14px' + (k.tampil !== 'Ya' ? ';opacity:.55' : '') + '"><span class="lencana ' + c[2] + '" style="min-width:66px;justify-content:center">' + e(k.kategori) + '</span><span style="width:96px;color:var(--abu);font-size:13px">' + e(jamAgenda(k)) + '</span><span style="flex:1;min-width:0">' + e(k.judul) + (k.tempat ? ' <small style="color:var(--abu)">· ' + e(k.tempat) + '</small>' : '') + '</span></div>';
          }).join('') + '</div>';
        }).join('') : A.kosong('event_available', 'Tidak ada kegiatan dalam 7 hari ke depan.')) + '</section>' +
        '<aside style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-content:start">' + KAT_AGENDA.map(function (c) { return kpi(c[0], c[1], A.angka(hitung[c[0]] || 0), 'agenda terdaftar'); }).join('') + '</aside></div>' +
        '<section class="panel"><div class="tab" role="tablist">' + [['aktif', 'Mendatang & berjalan', 'upcoming'], ['lewat', 'Sudah lewat', 'history'], ['semua', 'Semua', 'list']].map(function (t) { return '<button type="button" role="tab" data-waktu="' + t[0] + '" aria-selected="' + (f.waktu === t[0]) + '"><span class="ms" style="font-size:18px">' + t[2] + '</span>' + t[1] + '</button>'; }).join('') + '</div>' +
        '<div class="alat"><span class="cari"><span class="ms">search</span><input class="input" id="cari" placeholder="Cari kegiatan atau tempat…" value="' + e(f.cari) + '" aria-label="Cari agenda"></span><select class="input" id="f-kat" aria-label="Filter kategori"><option value="">Semua kategori</option>' + KAT_AGENDA.map(function (c) { return '<option' + (f.kat === c[0] ? ' selected' : '') + '>' + c[0] + '</option>'; }).join('') + '</select></div>' +
        (rows.length ? '<div class="daftar-item" id="daftar">' + p.rows.map(function (a) { return item(a, hari); }).join('') + '</div>' + p.lebih : A.kosong('event', semua.length ? 'Tidak ada agenda pada tampilan ini.' : 'Belum ada agenda.')) + '</section>';
      $('#b-tambah').onclick = function () { form({}); };
      if ($('#b-lebih')) $('#b-lebih').onclick = function () { n += PER_HAL; gambar(); };
      $$('[data-waktu]', el).forEach(function (b) { b.onclick = function () { f.waktu = b.getAttribute('data-waktu'); n = PER_HAL; gambar(); }; });
      var tm; $('#cari').oninput = function () { var v = this.value; clearTimeout(tm); tm = setTimeout(function () { f.cari = v; gambar(); var c = $('#cari'); c.focus(); c.setSelectionRange(v.length, v.length); }, 300); };
      $('#f-kat').onchange = function () { f.kat = this.value; gambar(); };
      pasangAksiDaftar(el, 'Agenda', { tunggal: 'agenda', ubah: form, gambarUlang: gambar, setelahTampil: gambar,
        salin: function (a) { var c = {}; Object.keys(a).forEach(function (k) { if (k !== 'id') c[k] = a[k]; }); c.tanggal = ''; form(c, true); } });
    };
    var item = function (a, hari) {
      var c = katAgenda(a.kategori), akhir = a.ulang_hari ? (a.ulang_sampai || a.tanggal) : a.tanggal, lewat = akhir < hari;
      var ulang = a.ulang_hari ? '<span class="lencana biru" title="' + API.hitungPertemuan(a) + ' pertemuan">Tiap ' + e(a.ulang_hari) + ' s.d. ' + e(API.tgl(a.ulang_sampai)) + '</span>' : '';
      return '<div class="item' + (a.tampil !== 'Ya' ? ' tersembunyi' : '') + '" data-id="' + e(a.id) + '"' + (lewat ? ' style="opacity:.7"' : '') + '><span class="gambar" style="width:44px;height:44px"><span class="ms">' + c[1] + '</span></span>' +
        '<span class="badan"><b>' + e(a.judul) + '</b><small>' + e(API.tglHari(a.tanggal) + ' · ' + jamAgenda(a) + (a.tempat ? ' · ' + a.tempat : '')) + (a.tempat && a.tampil_tempat !== 'Ya' ? ' <span class="ms" style="font-size:14px;vertical-align:-2px" title="Tempat tidak tampil di situs">visibility_off</span>' : '') + '</small></span>' +
        '<span class="ujung"><span class="lencana ' + c[2] + '">' + e(a.kategori) + '</span>' + ulang + (lewat ? '<span class="lencana abu">Selesai</span>' : '') + saklarItem(a) +
        tombolMini('data-salin', 'content_copy', 'Duplikat') + tombolMini('data-ubah', 'edit', 'Ubah') + tombolMini('data-hapus', 'delete', 'Hapus', true) + '</span></div>';
    };
    var form = function (x, salinan) {
      var baru = !x.id, ulang = !!x.ulang_hari, opsiKat = KAT_AGENDA.map(function (c) { return c[0]; });
      if (x.kategori && opsiKat.indexOf(x.kategori) < 0) opsiKat.push(x.kategori);
      A.modal({ judul: salinan ? 'Duplikat agenda' : (baru ? 'Tambah' : 'Ubah') + ' agenda', lebar: true, isi: '<form id="f-agd" novalidate><div class="grid-form">' +
        A.bidang({ k: 'kategori', label: 'Kategori', tipe: 'select', nilai: x.kategori || 'Rapat', opsi: opsiKat, wajib: true }) +
        A.bidang({ k: 'tanggal', label: ulang ? 'Tanggal pertemuan pertama' : 'Tanggal', tipe: 'date', nilai: x.tanggal || '', wajib: true }) +
        A.bidang({ k: 'judul', label: 'Nama kegiatan', nilai: x.judul, wajib: true, maks: 200, penuh: true, placeholder: 'mis. Manajemen Keuangan (MK84A) / Rapat Koordinasi Angkutan Lebaran' }) +
        A.bidang({ k: 'jam_mulai', label: 'Jam mulai', tipe: 'time', nilai: x.jam_mulai }) + A.bidang({ k: 'jam_selesai', label: 'Jam selesai', tipe: 'time', nilai: x.jam_selesai, bantu: 'Kosongkan keduanya untuk kegiatan sepanjang hari.' }) +
        A.bidang({ k: 'tempat', label: 'Tempat', nilai: x.tempat, maks: 150, penuh: true, placeholder: 'mis. Ruang Rapat Bappeda / Zoom' }) +
        A.bidang({ k: 'tampil_tempat', label: 'Tampilkan tempat di situs publik', tipe: 'saklar', nilai: x.tampil_tempat === 'Ya', penuh: true, bantu: 'Mati (disarankan untuk rapat): pengunjung hanya melihat nama kegiatan dan jamnya.' }) +
        A.bidang({ k: 'keterangan', label: 'Keterangan (tampil di situs)', tipe: 'textarea', nilai: x.keterangan, maks: 500, penuh: true, baris: 3 }) +
        A.bidang({ k: 'ulang', label: 'Ulangi setiap minggu', tipe: 'saklar', nilai: ulang, penuh: true, bantu: 'Untuk kuliah atau rapat rutin: cukup dibuat sekali.' }) +
        '<div class="penuh grid-form" id="blok-ulang" style="padding:0"' + (ulang ? '' : ' hidden') + '>' +
        A.bidang({ k: 'ulang_sampai', label: 'Berulang sampai tanggal', tipe: 'date', nilai: x.ulang_sampai }) +
        A.bidang({ k: 'kecuali', label: 'Kecuali tanggal (libur)', nilai: x.kecuali, placeholder: '2026-12-28, 2027-01-04', bantu: 'Pisahkan dengan koma, format yyyy-mm-dd.' }) +
        '<p class="penuh" id="ket-ulang" style="font-size:13px;color:var(--utama-hover);font-weight:600"></p></div>' +
        A.bidang({ k: 'tampil', label: 'Tampilkan di situs', tipe: 'saklar', nilai: x.tampil === undefined ? true : x.tampil, penuh: true }) + '</div></form>',
        tombol: [{ teks: 'Batal' }, { teks: '<span class="ms">save</span>' + (baru ? 'Tambahkan' : 'Simpan'), kelas: 'btn-utama', aksi: function (mm) {
          var fm = $('#f-agd', mm.isi), data = A.ambil(fm);
          if (x.id) data.id = x.id;
          return kirimForm(fm, 'Agenda', { tabel: 'Agenda', data: data }, gambar);
        } }],
        saatBuka: function (m) {
          var fm = $('#f-agd', m.isi), ket = function () {
            var v = A.ambil(fm), p = $('#ket-ulang', m.isi);
            $('#blok-ulang', m.isi).hidden = !v.ulang;
            if (!v.ulang || !v.tanggal) { p.textContent = ''; return; }
            var h = API.HARI[new Date(v.tanggal + 'T12:00:00').getDay()];
            if (!v.ulang_sampai) { p.textContent = 'Setiap ' + h + '. Isi tanggal akhir pengulangan.'; return; }
            var n2 = API.jabarkanAgenda([{ tanggal: v.tanggal, ulang_hari: h, ulang_sampai: v.ulang_sampai, kecuali: v.kecuali }], v.tanggal, v.ulang_sampai).length;
            p.textContent = 'Setiap ' + h + ', ' + n2 + ' pertemuan (' + API.tgl(v.tanggal) + ' – ' + API.tgl(v.ulang_sampai) + ').';
          };
          fm.addEventListener('input', ket); fm.addEventListener('change', ket); ket();
        } });
    };
    daftar('Agenda').then(function () { gambar(); if (param && param[0] === 'baru') form({}); }).catch(function (x) { galatModul(el, x); });
  } };

  /* =====================================================================
   * MODUL: KINERJA HARIAN
   * ===================================================================== */
  A.MODUL.kinerja = { judul: 'Kinerja Harian', ikon: 'task_alt', render: function (el, param) {
    var f = { cari: '', bulan: '', status: '' }, n = PER_HAL;
    var gambar = function () {
      var semua = A.S.cache.konten.Kinerja || [], bln = API.hariIniYmd().slice(0, 7);
      var rows = semua.filter(function (r) { return cocokCari(r, f.cari) && (!f.bulan || String(r.tanggal).slice(0, 7) === f.bulan) && (!f.status || r.tampil === f.status); });
      var p = potong(rows, n), bulanIni = semua.filter(function (r) { return String(r.tanggal).slice(0, 7) === bln; }).length;
      var bulanAda = {}; semua.forEach(function (r) { var b = String(r.tanggal).slice(0, 7); if (/^\d{4}-\d{2}$/.test(b)) bulanAda[b] = (bulanAda[b] || 0) + 1; });
      el.innerHTML = kepala('Kinerja Harian', 'Catatan kegiatan dan hasil kerja harian. Yang diaktifkan tampil di situs (' + 60 + ' terbaru); semuanya bisa diekspor ke Excel untuk laporan.', '<button class="btn btn-garis" type="button" id="b-ekspor"><span class="ms">download</span>Ekspor Excel</button><button class="btn btn-utama" type="button" id="b-tambah"><span class="ms">add</span>Catat kinerja</button>', 'about') +
        '<div class="grid-kpi">' + kpi('Total catatan', 'task_alt', A.angka(semua.length), Object.keys(bulanAda).length + ' bulan') + kpi('Bulan ini', 'calendar_month', A.angka(bulanIni), e(bulanTahun(bln))) +
        kpi('Tampil di situs', 'public', A.angka(semua.filter(function (r) { return r.tampil === 'Ya'; }).length), 'diaktifkan') + kpi('Dengan foto', 'photo_camera', A.angka(semua.filter(function (r) { return r.url_foto; }).length), 'dokumentasi') + '</div>' +
        '<section class="panel"><div class="alat"><span class="cari"><span class="ms">search</span><input class="input" id="cari" placeholder="Cari kegiatan atau uraian…" value="' + e(f.cari) + '" aria-label="Cari kinerja"></span>' +
        '<select class="input" id="f-bulan" aria-label="Filter bulan"><option value="">Semua bulan</option>' + Object.keys(bulanAda).sort().reverse().map(function (b) { return '<option value="' + b + '"' + (f.bulan === b ? ' selected' : '') + '>' + e(bulanTahun(b)) + ' (' + bulanAda[b] + ')</option>'; }).join('') + '</select>' +
        '<select class="input" id="f-st" aria-label="Filter status"><option value="">Semua status</option><option value="Ya"' + (f.status === 'Ya' ? ' selected' : '') + '>Tampil</option><option value="Tidak"' + (f.status === 'Tidak' ? ' selected' : '') + '>Disembunyikan</option></select></div>' +
        (rows.length ? '<div class="daftar-item" id="daftar">' + p.rows.map(item).join('') + '</div>' + p.lebih : A.kosong('task_alt', semua.length ? 'Tidak ada catatan yang cocok.' : 'Belum ada catatan kinerja.')) + '</section>';
      $('#b-tambah').onclick = function () { form({}); };
      if ($('#b-lebih')) $('#b-lebih').onclick = function () { n += PER_HAL; gambar(); };
      var tm; $('#cari').oninput = function () { var v = this.value; clearTimeout(tm); tm = setTimeout(function () { f.cari = v; n = PER_HAL; gambar(); var c = $('#cari'); c.focus(); c.setSelectionRange(v.length, v.length); }, 300); };
      $('#f-bulan').onchange = function () { f.bulan = this.value; n = PER_HAL; gambar(); };
      $('#f-st').onchange = function () { f.status = this.value; n = PER_HAL; gambar(); };
      $('#b-ekspor').onclick = function () {
        var b = this; A.sibuk(b, true);
        A.ekspor('Kinerja-Harian' + (f.bulan ? '-' + f.bulan : '') + '-' + API.hariIniYmd(), [{ nama: 'Kinerja', rows: rows.slice().reverse().map(function (r) { return { Tanggal: r.tanggal, Hari: API.HARI[new Date(r.tanggal + 'T12:00:00').getDay()] || '', Kegiatan: r.kegiatan, 'Uraian / Output': r.output, Foto: r.url_foto ? 'Ada' : '', 'Tampil di situs': r.tampil }; }) }])
          .then(function () { A.sibuk(b, false); toast('Berkas Excel diunduh.'); }).catch(function (x) { A.sibuk(b, false); toast(x.message, 'galat'); });
      };
      pasangAksiDaftar(el, 'Kinerja', { tunggal: 'catatan kinerja', ubah: form, gambarUlang: gambar, setelahTampil: gambar,
        salin: function (r) { form({ kegiatan: r.kegiatan, output: r.output, tampil: r.tampil }, true); } });
    };
    var item = function (r) {
      return '<div class="item' + (r.tampil !== 'Ya' ? ' tersembunyi' : '') + '" data-id="' + e(r.id) + '"><span class="gambar" style="width:56px;height:56px">' + (r.url_foto ? '<img src="' + e(r.url_foto) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="ms">task_alt</span>') + '</span>' +
        '<span class="badan"><b>' + e(r.kegiatan) + '</b><small style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;white-space:normal">' + e(API.tglHari(r.tanggal) + (r.output ? ' · ' + r.output : '')) + '</small></span><span class="ujung">' + saklarItem(r) +
        tombolMini('data-salin', 'content_copy', 'Catat lagi (salin)') + tombolMini('data-ubah', 'edit', 'Ubah') + tombolMini('data-hapus', 'delete', 'Hapus', true) + '</span></div>';
    };
    var form = function (x, salinan) {
      var baru = !x.id, foto = null, hapus = false, keg = {};
      (A.S.cache.konten.Kinerja || []).forEach(function (r) { if (r.kegiatan) keg[r.kegiatan] = 1; });
      ['Rapat Koordinasi', 'Rapat Undangan', 'Monitoring Kegiatan', 'Pengawasan Lapangan', 'Penyusunan Dokumen', 'Pelayanan', 'Pengembangan Aplikasi'].forEach(function (k) { keg[k] = 1; });
      A.modal({ judul: salinan ? 'Catat kinerja (salinan)' : (baru ? 'Catat' : 'Ubah') + ' kinerja', lebar: true, isi: '<form id="f-kin" novalidate><div class="grid-form">' +
        A.bidang({ k: 'tanggal', label: 'Tanggal', tipe: 'date', nilai: x.tanggal || API.hariIniYmd(), wajib: true }) +
        A.bidang({ k: 'kegiatan', label: 'Jenis kegiatan', nilai: x.kegiatan, wajib: true, maks: 100, atribut: ' list="dl-keg"' }) + '<datalist id="dl-keg">' + Object.keys(keg).map(function (k) { return '<option value="' + e(k) + '">'; }).join('') + '</datalist>' +
        A.bidang({ k: 'output', label: 'Uraian / output', tipe: 'textarea', nilai: x.output, maks: 1500, penuh: true, baris: 5, bantu: '<span id="hit-out">' + String(x.output || '').length + '</span>/1.500 · mis. hasil rapat, jumlah kapal diawasi, dokumen yang diselesaikan.' }) +
        blokGambar('ft', x.url_foto, 'Foto dokumentasi (opsional)', 'Dikompres otomatis, maks. 2 MB.') + '<input type="hidden" name="url_foto" value="' + e(x.url_foto) + '">' +
        A.bidang({ k: 'tampil', label: 'Tampilkan di situs', tipe: 'saklar', nilai: x.tampil === undefined ? true : x.tampil, penuh: true, bantu: 'Matikan untuk kegiatan internal yang tidak perlu dipublikasikan.' }) + '</div></form>',
        tombol: [{ teks: 'Batal' }, { teks: '<span class="ms">save</span>' + (baru ? 'Simpan catatan' : 'Simpan'), kelas: 'btn-utama', aksi: function (mm) {
          var fm = $('#f-kin', mm.isi), data = A.ambil(fm);
          if (x.id) data.id = x.id;
          if (hapus) data.url_foto = '';
          var kirim = { tabel: 'Kinerja', data: data }; if (foto) kirim.berkas = foto;
          return kirimForm(fm, 'Kinerja', kirim, gambar);
        } }],
        saatBuka: function (m) {
          pasangBlokGambar(m.isi, 'ft', 1600, function (b) { foto = b; hapus = !b; });
          var o = $('[name=output]', m.isi); o.addEventListener('input', function () { $('#hit-out', m.isi).textContent = o.value.length; });
        } });
    };
    daftar('Kinerja').then(function () { gambar(); if (param && param[0] === 'baru') form({}); }).catch(function (x) { galatModul(el, x); });
  } };

  /* =====================================================================
   * MODUL: WAWASAN & INSIGHT
   * ===================================================================== */
  function statusArtikel(r, hari) {
    var t = String(r.jadwal_terbit || '') || String(r.tanggal || '');
    if (r.tampil !== 'Ya') return ['Disembunyikan', 'abu'];
    if (t && t > hari) return ['Terjadwal ' + API.tgl(t), 'kuning'];
    return ['Terbit', 'hijau'];
  }
  A.MODUL.wawasan = { judul: 'Wawasan & Insight', ikon: 'auto_stories', render: function (el, param) {
    var f = { cari: '', status: '' }, n = PER_HAL;
    var gambar = function () {
      var semua = A.S.cache.konten.Wawasan || [], hari = API.hariIniYmd();
      var st = function (r) { return statusArtikel(r, hari)[0].split(' ')[0]; };
      var rows = semua.filter(function (r) { return cocokCari(r, f.cari) && (!f.status || st(r) === f.status); }).slice().sort(function (a, b) {
        var x = String(a.jadwal_terbit || a.tanggal || ''), y = String(b.jadwal_terbit || b.tanggal || ''); return x < y ? 1 : x > y ? -1 : 0; });
      var p = potong(rows, n), hit = { Terbit: 0, Terjadwal: 0, Disembunyikan: 0 };
      semua.forEach(function (r) { hit[st(r)]++; });
      el.innerHTML = kepala('Wawasan & Insight', 'Artikel dan tulisan singkat Anda. Isi lengkap hanya dimuat saat pengunjung membuka artikel, sehingga situs tetap ringan.', '<button class="btn btn-utama" type="button" id="b-tambah"><span class="ms">edit_note</span>Tulis artikel</button>') +
        '<div class="grid-kpi">' + kpi('Total artikel', 'auto_stories', A.angka(semua.length), 'semua status') + kpi('Terbit', 'public', A.angka(hit.Terbit), 'tampil di situs') +
        kpi('Terjadwal', 'schedule_send', A.angka(hit.Terjadwal), 'terbit otomatis pada tanggalnya') + kpi('Disembunyikan', 'visibility_off', A.angka(hit.Disembunyikan), 'draf / arsip') + '</div>' +
        '<section class="panel"><div class="alat"><span class="cari"><span class="ms">search</span><input class="input" id="cari" placeholder="Cari judul atau ringkasan…" value="' + e(f.cari) + '" aria-label="Cari artikel"></span>' +
        '<select class="input" id="f-st" aria-label="Filter status">' + [['', 'Semua status'], ['Terbit', 'Terbit'], ['Terjadwal', 'Terjadwal'], ['Disembunyikan', 'Disembunyikan']].map(function (o) { return '<option value="' + o[0] + '"' + (f.status === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
        (rows.length ? '<div class="daftar-item" id="daftar">' + p.rows.map(function (r) { return item(r, hari); }).join('') + '</div>' + p.lebih : A.kosong('auto_stories', semua.length ? 'Tidak ada artikel yang cocok.' : 'Belum ada artikel.')) + '</section>';
      $('#b-tambah').onclick = function () { form({}); };
      if ($('#b-lebih')) $('#b-lebih').onclick = function () { n += PER_HAL; gambar(); };
      var tm; $('#cari').oninput = function () { var v = this.value; clearTimeout(tm); tm = setTimeout(function () { f.cari = v; n = PER_HAL; gambar(); var c = $('#cari'); c.focus(); c.setSelectionRange(v.length, v.length); }, 300); };
      $('#f-st').onchange = function () { f.status = this.value; n = PER_HAL; gambar(); };
      pasangAksiDaftar(el, 'Wawasan', { tunggal: 'artikel', gambarUlang: gambar, setelahTampil: gambar, ubah: function (r) {
        toast('Membuka artikel…', 'info');
        api('konten.detail', { tabel: 'Wawasan', id: r.id }).then(function (x) { if (!x.ok) return toast(x.message, 'galat'); form(x.data); });
      } });
    };
    var item = function (r, hari) {
      var s = statusArtikel(r, hari), terbit = s[1] === 'hijau';
      return '<div class="item' + (r.tampil !== 'Ya' ? ' tersembunyi' : '') + '" data-id="' + e(r.id) + '"><span class="gambar">' + (r.url_gambar ? '<img src="' + e(r.url_gambar) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="ms">auto_stories</span>') + '</span>' +
        '<span class="badan"><b>' + e(r.judul) + '</b><small>' + e(API.tgl(r.jadwal_terbit || r.tanggal) + ' · ±' + Math.max(1, Math.round((r.konten_kata || 0) / 200)) + ' menit baca' + (r.ringkasan ? ' · ' + r.ringkasan : '')) + '</small></span>' +
        '<span class="ujung"><span class="lencana ' + s[1] + '">' + e(s[0]) + '</span>' + saklarItem(r) +
        (terbit ? '<a class="btn btn-ikon mini" href="./#wawasan=' + encodeURIComponent(r.id) + '" target="_blank" rel="noopener" aria-label="Lihat di situs" title="Lihat di situs"><span class="ms">open_in_new</span></a>' : '') +
        tombolMini('data-ubah', 'edit', 'Ubah') + tombolMini('data-hapus', 'delete', 'Hapus', true) + '</span></div>';
    };
    var form = function (x) {
      var baru = !x.id, sampul = null, hapus = false;
      A.modal({ judul: baru ? 'Tulis artikel' : 'Ubah artikel', lebar: true, isi: '<form id="f-waw" novalidate><div class="grid-form">' +
        A.bidang({ k: 'judul', label: 'Judul', nilai: x.judul, wajib: true, maks: 200, penuh: true }) +
        A.bidang({ k: 'ringkasan', label: 'Ringkasan (tampil di kartu artikel)', tipe: 'textarea', nilai: x.ringkasan, maks: 600, penuh: true, baris: 3, bantu: '<span id="hit-rk">' + String(x.ringkasan || '').length + '</span>/600' }) +
        A.bidang({ k: 'konten', label: 'Isi artikel', tipe: 'textarea', nilai: x.konten, wajib: true, maks: 40000, penuh: true, baris: 16,
          bantu: '<span id="hit-isi">' + String(x.konten || '').length.toLocaleString('id-ID') + '</span>/40.000 karakter · Baris kosong = paragraf baru · <code>## Judul</code> = subjudul · <code>- teks</code> = butir daftar' }) +
        A.bidang({ k: 'tanggal', label: 'Tanggal tulisan', tipe: 'date', nilai: x.tanggal || API.hariIniYmd() }) +
        A.bidang({ k: 'jadwal_terbit', label: 'Jadwal terbit (opsional)', tipe: 'date', nilai: x.jadwal_terbit, bantu: 'Kosongkan agar langsung terbit. Diisi tanggal mendatang = terbit otomatis pada tanggal itu.' }) +
        blokGambar('smp', x.url_gambar, 'Gambar sampul (opsional)', 'Rasio 16:9 disarankan. Dikompres otomatis.') + '<input type="hidden" name="url_gambar" value="' + e(x.url_gambar) + '">' +
        A.bidang({ k: 'tampil', label: 'Tampilkan di situs', tipe: 'saklar', nilai: x.tampil === undefined ? true : x.tampil, penuh: true, bantu: 'Matikan untuk menyimpan sebagai draf.' }) + '</div></form>',
        tombol: [{ teks: 'Batal' }, { teks: '<span class="ms">save</span>' + (baru ? 'Simpan artikel' : 'Simpan'), kelas: 'btn-utama', aksi: function (mm) {
          var fm = $('#f-waw', mm.isi), data = A.ambil(fm);
          if (x.id) data.id = x.id;
          if (hapus) data.url_gambar = '';
          var kirim = { tabel: 'Wawasan', data: data }; if (sampul) kirim.berkas = sampul;
          return kirimForm(fm, 'Wawasan', kirim, gambar);
        } }],
        saatBuka: function (m) {
          pasangBlokGambar(m.isi, 'smp', 1600, function (b) { sampul = b; hapus = !b; });
          var rk = $('[name=ringkasan]', m.isi), isi = $('[name=konten]', m.isi);
          rk.addEventListener('input', function () { $('#hit-rk', m.isi).textContent = rk.value.length; });
          isi.addEventListener('input', function () { $('#hit-isi', m.isi).textContent = isi.value.length.toLocaleString('id-ID'); });
        } });
    };
    daftar('Wawasan').then(function () { gambar(); if (param && param[0] === 'baru') form({}); }).catch(function (x) { galatModul(el, x); });
  } };
})();