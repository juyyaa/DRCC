# DRCC — AI Disaster Response Command Center

Prototype sistem komando respons bencana berbasis AI untuk Indonesia.  
Dibuat oleh tim mahasiswa Teknik Elektro · v1.0

---

## Tentang Proyek

DRCC adalah dashboard web frontend-only yang mensimulasikan sistem manajemen bencana skala nasional. Sistem ini mengintegrasikan pemantauan sinyal multi-sumber, peta situasi real-time, rekomendasi AI, dan manajemen sumber daya lapangan.

**Stack:** HTML5 · CSS3 · Vanilla JavaScript · LocalStorage  
**Library:** Font Awesome 6.5 · Google Fonts Inter · (Chart.js & Leaflet.js — Sesi 2+)

---

## Struktur Direktori

```
disaster-response-command-center/
├── index.html                    ← Login page
├── assets/
│   ├── css/
│   │   ├── main.css              ← Variables, reset, login, utilities
│   │   ├── layout.css            ← Sidebar, navbar, app shell
│   │   ├── components.css        ← Cards, badges, toast, buttons, forms
│   │   ├── animations.css        ← Keyframes & animation utilities
│   │   └── dashboard.css         ← Dashboard-specific styles
│   └── js/
│       └── core/
│           └── app.js            ← Auth, Storage, Toast, Sidebar, Navbar
└── pages/
    ├── dashboard.html            ← Dashboard utama (Sesi 2)
    ├── signals.html              ← Signal Monitor (Sesi 3)
    ├── map.html                  ← Situation Map (Sesi 4)
    ├── ai-command.html           ← AI Command Panel (Sesi 5)
    ├── incidents.html            ← Incident Form (Sesi 6)
    ├── resources.html            ← Resource Management (Sesi 6)
    ├── predictions.html          ← Predictions (Sesi 7)
    ├── history.html              ← History & Export (Sesi 7)
    └── settings.html             ← Settings (Sesi 7)
```

---

## Demo Accounts

| Username   | Password   | Role       | Akses |
|------------|------------|------------|-------|
| `admin`    | `admin123` | Admin BNPB | Penuh |
| `operator` | `op123`    | Operator   | Operasional |
| `relawan`  | `rel123`   | Relawan    | Terbatas |
| `pemda`    | `pem123`   | Pemda      | Laporan |

---

## Cara Menjalankan

1. Buka `index.html` di browser modern (Chrome/Firefox/Edge terbaru)
2. Gunakan salah satu akun demo di atas
3. Atau jalankan dengan live server:
   ```bash
   # VS Code: klik kanan index.html → Open with Live Server
   # atau dengan Python:
   python -m http.server 8080
   # lalu buka http://localhost:8080
   ```

> ⚠️ Tidak bisa dibuka langsung dengan `file://` karena path navigasi antar halaman.  
> Gunakan live server atau web server lokal.

---

## Design System

**Palet Warna:**
- Copper Primary: `#B5651D`
- Graphite: `#6C757D`
- Gold Accent: `#FFD166`
- Background: `#F8F9FA`
- Surface: `#FFFFFF`
- Dark Base: `#1C2431`

**Tipografi:** Inter (Google Fonts)  
**Ikon:** Font Awesome 6.5.0

---

## Rencana Sesi Pengembangan

| Sesi | Topik | Status |
|------|-------|--------|
| 1 | Foundation — Login, Layout, CSS System, App Core | ✅ Selesai |
| 2 | Dashboard Utama — Stat cards, Chart.js, live alerts | 🔄 Berikutnya |
| 3 | Signal Monitor — 7 panel, waveform, LocalStorage | ⏳ |
| 4 | Situation Map — Leaflet.js, marker, heatmap | ⏳ |
| 5 | AI Command Panel — 4 agen AI, scoring JS | ⏳ |
| 6 | Incident Form + Resource Management (CRUD) | ⏳ |
| 7 | History, Settings & Export (CSV, dark mode) | ⏳ |
| 8 | Final Polish & Integration | ⏳ |

---

## Teknologi yang Digunakan

- **Auth & Session:** LocalStorage (tanpa backend)
- **Navigasi:** Multi-page HTML dengan JS router sederhana
- **Komponen:** Vanilla JS — Toast, Sidebar toggle, Role-based nav
- **Responsif:** Mobile (< 576px) hingga Wide (> 1200px)

---

*Proyek ini merupakan prototype edukatif — tidak untuk produksi.*
