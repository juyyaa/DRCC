# DRCC — AI Disaster Response Command Center

Sistem komando bencana nasional berbasis AI — **full-stack production**, dibangun untuk Mahasiswa Teknik Elektro (Tim 3 Orang).

## Stack
- **Backend:** Node.js + Express + Socket.io
- **Database:** MariaDB (17 tabel)
- **AI:** Google Gemini API (analisis multi-agent real)
- **Auth:** JWT (access + refresh token) + bcrypt
- **Real-time:** WebSocket — perubahan data (insiden, marker peta, notifikasi) langsung tersinkron ke semua user online

## Quick Start (Development Lokal)

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env          # edit DB_PASSWORD, JWT secrets, GEMINI_API_KEY
npm run migrate
npm run seed
npm run dev                   # jalan di http://localhost:4000

# 2. Frontend — buka frontend/index.html dengan Live Server (VSCode) atau http-server
```

## Demo Credentials (setelah `npm run seed`)
| Role | Username | Password |
|---|---|---|
| Admin BNPB | admin | admin123 |
| Operator | operator | op123 |
| Relawan | relawan | rel123 |
| Pemda | pemda | pem123 |

⚠️ **Ganti semua password ini sebelum deploy production.**

## Struktur 5 Layer Architecture
| Layer | Implementasi |
|---|---|
| 1. Input Signal | `signals` + `signal_events` table, endpoint `/api/signals` |
| 2. Signal Processing | Filter → Extract → Anomaly Detection di `signalController.js` |
| 3. AI Agent | 4 agen (ARIA/LOGI/RECON/PULSE) via Gemini di `geminiService.js` |
| 4. Prediction/Decision | Decision tree + auto-escalation di `aiController.js` |
| 5. User Action | Dashboard, Insiden, Notifikasi real-time |

## Role-Based Access Control
Lihat `backend/src/middleware/permissions.js` untuk matrix lengkap akses per role per halaman.

---
*DRCC v2.0 — Mahasiswa Teknik Elektro
