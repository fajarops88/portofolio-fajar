/*
 * kwitansi.js — membuat PDF kwitansi DI BROWSER (jsPDF + qrcode-generator, tanpa kuota Drive).
 * Data berasal dari server (klien.kwitansi / tagihan.kwitansi). QR berisi URL verifikasi publik ber-HMAC.
 */
(function () {
  'use strict';
  function muatLib() {
    return Promise.all([API.muatSkrip(API.LIB.jspdf), API.muatSkrip(API.LIB.qr)]);
  }
  function rp(n) { return API.rupiah(n); }

  /** gambar QR sebagai kotak-kotak vektor (tajam saat dicetak) */
  function gambarQR(doc, teks, x, y, ukuran) {
    var qr = window.qrcode(0, 'M');
    qr.addData(teks); qr.make();
    var n = qr.getModuleCount(), s = ukuran / n;
    doc.setFillColor(255, 255, 255); doc.rect(x - 1.5, y - 1.5, ukuran + 3, ukuran + 3, 'F');
    doc.setFillColor(11, 31, 58);
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) doc.rect(x + c * s, y + r * s, s + 0.02, s + 0.02, 'F');
  }

  function unduh(k) {
    return muatLib().then(function () {
      var J = window.jspdf.jsPDF, doc = new J({ orientation: 'landscape', unit: 'mm', format: 'a5' });
      var W = 210, H = 148, M = 12;
      // kepala navy + garis kuning
      doc.setFillColor(11, 31, 58); doc.rect(0, 0, W, 28, 'F');
      doc.setFillColor(255, 195, 0); doc.rect(0, 28, W, 1.6, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
      doc.text(String(k.usaha || ''), M, 12);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(195, 198, 215);
      doc.text(String(k.alamat || ''), M, 18);
      doc.setTextColor(255, 195, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
      doc.text('KWITANSI', W - M, 13, { align: 'right' });
      doc.setFontSize(9); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'normal');
      doc.text('No. ' + k.noKwitansi, W - M, 20, { align: 'right' });

      var y = 40, label = function (t, v, tebal) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(91, 100, 114); doc.text(t, M, y);
        doc.setTextColor(19, 28, 40); doc.setFont('helvetica', tebal ? 'bold' : 'normal'); doc.setFontSize(10);
        var baris = doc.splitTextToSize(String(v || '-'), W - M * 2 - 44);
        doc.text(baris, M + 44, y); y += 6.2 * baris.length;
      };
      label('Telah terima dari', k.nama + (k.instansi ? ' — ' + k.instansi : ''), true);
      label('Uang sejumlah', k.terbilang);
      label('Untuk pembayaran', (k.item || []).map(function (x) { return x.nama_tagihan + ' (' + rp(x.jumlah) + ')'; }).join('; '));
      label('Metode / referensi', (k.metode || 'Transfer') + (k.noReferensi ? ' · ' + k.noReferensi : '') + ' · dibayar ' + API.tgl(k.tanggalBayar, true));

      // kotak total
      var yb = Math.max(y + 4, 92);
      doc.setFillColor(234, 243, 255); doc.roundedRect(M, yb, 78, 16, 3, 3, 'F');
      doc.setTextColor(91, 100, 114); doc.setFontSize(8); doc.text('TOTAL DITERIMA', M + 5, yb + 6);
      doc.setTextColor(11, 31, 58); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(rp(k.total), M + 5, yb + 13);

      // QR verifikasi
      if (k.urlVerifikasi) {
        gambarQR(doc, k.urlVerifikasi, M, H - 33, 22);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(91, 100, 114);
        doc.text(['Pindai untuk memeriksa', 'keaslian kwitansi ini.', 'Kode: ' + k.kodeVerifikasi], M + 26, H - 26);
      }
      // tanda tangan
      var xt = W - M - 60;
      doc.setTextColor(19, 28, 40); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(String((k.alamat || '').split(',')[0] || '') + ', ' + API.tgl(k.tanggal, true), xt + 30, yb + 4, { align: 'center' });
      doc.text('Penerima,', xt + 30, yb + 10, { align: 'center' });
      doc.setFont('helvetica', 'bold'); doc.text(String(k.penandatangan || ''), xt + 30, H - 14, { align: 'center' });
      doc.setDrawColor(195, 198, 215); doc.line(xt + 4, H - 12.5, xt + 56, H - 12.5);
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(91, 100, 114);
      doc.text('Kwitansi elektronik — sah tanpa tanda tangan basah.', xt + 30, H - 8.5, { align: 'center' });
      doc.save('Kwitansi-' + k.noKwitansi + '.pdf');
    });
  }
  window.Kwitansi = { unduh: unduh };
})();
