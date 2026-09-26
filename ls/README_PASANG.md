# DRCC — Paket Lengkap Semua Perbaikan (Revisi #1-#6)

Versi ini **menggantikan** paket combined sebelumnya. 17 file, kumulatif dari 6 batch revisi.

## Daftar Lengkap Perbaikan

| # | Revisi | Isi |
|---|---|---|
| 1 | Reasoning panel + Buat Insiden | Urutan panel dibenarkan; tombol "Buat Insiden" membawa data asli ke form Insiden |
| 2 | Bug CSV koma | Export CSV tidak lagi rusak kolomnya akibat format tanggal Indonesia |
| 3 | Rekomendasi Sumber Daya (dasar) | Agen LOGI menghasilkan daftar kebutuhan logistik terstruktur |
| 4 | 8 bug UI/formula | Field Kota, chart tren, status Gemini nyata, CSS card AI, bersih-bersih Signal Monitor, stat box Prediksi, formula area realistis, demo scenario hitung area |
| 5 | Skala sesuai hari | Kuantitas Air Minum/Pangan kini dikalikan field "Periode Logistik (Hari)" — sebelumnya field ini terabaikan |
| 6 | **Auto-add Sumber Daya** | Rekomendasi LOGI **otomatis tercatat** ke tabel Sumber Daya begitu analisis selesai — tidak perlu klik apa pun lagi |

## Cara Pasang

### Langkah 1 — Migration Database (paling pertama)
```bash
scp -r backend/database admin@IP_VPS:/tmp/db-fix
ssh admin@IP_VPS
sudo mysql -u root drcc_db < /tmp/db-fix/migration_002_resource_needs.sql
sudo mysql -u root drcc_db -e "DESCRIBE ai_reasoning_logs;" | grep resource_needs
```

### Langkah 2 — Backend (6 file, wajib restart PM2)
```bash
scp -r backend/src admin@IP_VPS:/tmp/backend-src-fix
```
Di VPS:
```bash
sudo cp /tmp/backend-src-fix/services/geminiService.js      /home/drcc/app/backend/src/services/
sudo cp /tmp/backend-src-fix/services/impactEstimator.js    /home/drcc/app/backend/src/services/
sudo cp /tmp/backend-src-fix/controllers/aiController.js        /home/drcc/app/backend/src/controllers/
sudo cp /tmp/backend-src-fix/controllers/evidenceController.js  /home/drcc/app/backend/src/controllers/
sudo cp /tmp/backend-src-fix/controllers/dashboardController.js /home/drcc/app/backend/src/controllers/
sudo cp /tmp/backend-src-fix/routes/aiRoutes.js                  /home/drcc/app/backend/src/routes/
sudo chown -R drcc:drcc /home/drcc/app/backend/src

sudo -u drcc -i
cd app/backend
pm2 restart drcc-backend
pm2 logs drcc-backend --lines 15 --nostream
exit
```

### Langkah 3 — Frontend (10 file, cukup hard refresh)
```bash
scp -r frontend admin@IP_VPS:/tmp/frontend-fix
```
Di VPS:
```bash
sudo cp /tmp/frontend-fix/pages/ai-command.html   /var/www/drcc.juyyaa.cloud/pages/
sudo cp /tmp/frontend-fix/pages/predictions.html  /var/www/drcc.juyyaa.cloud/pages/
sudo cp /tmp/frontend-fix/pages/signals.html      /var/www/drcc.juyyaa.cloud/pages/
sudo cp /tmp/frontend-fix/assets/js/pages/*.js    /var/www/drcc.juyyaa.cloud/assets/js/pages/
sudo cp /tmp/frontend-fix/assets/css/dashboard.css /var/www/drcc.juyyaa.cloud/assets/css/
sudo chown -R www-data:www-data /var/www/drcc.juyyaa.cloud
```

### Langkah 4 — Verifikasi
```bash
curl https://drcc.juyyaa.cloud/api/health
```
Browser: `Ctrl+Shift+R` → login → **AI Command** → isi Periode Logistik (misal 5 hari) → Analisis AI → scroll ke bawah → panel Sumber Daya harus otomatis berubah jadi "✅ Tercatat otomatis" tanpa Anda klik apa pun → cek halaman **Sumber Daya**, item baru harus sudah ada di sana.
