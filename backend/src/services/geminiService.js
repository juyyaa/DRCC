/**
 * DRCC — Gemini AI Service
 * Integrasi nyata dengan Google Gemini API untuk analisis bencana multi-agent.
 * Setiap "agent" (ARIA/LOGI/RECON/PULSE) adalah satu system-prompt persona
 * yang dikirim sebagai request terpisah ke Gemini, lalu hasilnya disimpan ke DB.
 */
'use strict';
const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

let genAI = null;
if (API_KEY) genAI = new GoogleGenerativeAI(API_KEY);

const AGENTS = {
  aria:  { name:'ARIA',  fullName:'Situation Analyst',     role:'Kamu adalah ARIA, AI Situation Analyst untuk sistem komando bencana Indonesia (DRCC). Tugasmu menganalisis situasi bencana: klasifikasi tingkat keparahan, estimasi area terdampak, dan estimasi korban.' },
  logi:  { name:'LOGI',  fullName:'Logistics Prioritizer', role:'Kamu adalah LOGI, AI Logistics Prioritizer untuk sistem komando bencana Indonesia (DRCC). Tugasmu menghitung kebutuhan logistik (air, pangan, kendaraan, relawan) dan menyusun rencana distribusi.' },
  recon: { name:'RECON', fullName:'Response Commander',    role:'Kamu adalah RECON, AI Response Commander untuk sistem komando bencana Indonesia (DRCC). Tugasmu merencanakan jalur evakuasi, lokasi posko, dan koordinasi tim respons lapangan.' },
  pulse: { name:'PULSE', fullName:'Public Alert System',   role:'Kamu adalah PULSE, AI Public Alert System untuk sistem komando bencana Indonesia (DRCC). Tugasmu menyusun pesan peringatan publik dan menentukan level siaga yang harus disebarkan ke masyarakat.' },
};

function isConfigured() {
  return !!genAI;
}

/**
 * Panggil Gemini untuk satu agent, dengan structured JSON output.
 * Mengembalikan { steps:[{title,desc}], confidence, conclusion, raw }
 */
async function runAgentReasoning(agentId, input) {
  const agent = AGENTS[agentId];
  if (!agent) throw new Error(`Unknown agent: ${agentId}`);

  if (!isConfigured()) {
    // Fallback jika API key belum diisi — agar sistem tetap berjalan saat setup awal
    return _fallbackReasoning(agentId, input);
  }

  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const prompt = `${agent.role}

Data bencana yang harus kamu analisis:
- Jenis bencana: ${input.type}
- Magnitude/skala: ${input.magnitude}
- Lokasi: ${input.location}, ${input.province}
- Populasi terdampak (estimasi): ${input.population}
- Severity awal: ${input.severity || 'belum ditentukan'}

Berikan analisis dalam format JSON PERSIS seperti ini, tanpa markdown code block, tanpa teks tambahan di luar JSON:
{
  "steps": [
    {"title": "judul langkah 1", "desc": "penjelasan detail langkah 1 dengan angka konkret"},
    {"title": "judul langkah 2", "desc": "penjelasan detail langkah 2 dengan angka konkret"},
    {"title": "judul langkah 3", "desc": "penjelasan detail langkah 3 dengan angka konkret"}
  ],
  "confidence": 85,
  "conclusion": "kesimpulan akhir analisis dalam satu kalimat"
}

Gunakan Bahasa Indonesia. Angka harus realistis berdasarkan data yang diberikan.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      agentId, agentName: agent.name, fullName: agent.fullName,
      steps: parsed.steps || [], confidence: parsed.confidence || 75,
      conclusion: parsed.conclusion || '', raw: text,
    };
  } catch (err) {
    console.error(`[Gemini] ${agentId} failed:`, err.message);
    return _fallbackReasoning(agentId, input, err.message);
  }
}

/** Fallback template jika API key belum diset atau request gagal (tetap menjaga UX) */
function _fallbackReasoning(agentId, input, errorMsg = null) {
  const agent = AGENTS[agentId];
  return {
    agentId, agentName: agent.name, fullName: agent.fullName,
    steps: [
      { title: 'Mode Fallback', desc: errorMsg ? `Gemini API error: ${errorMsg}. Menggunakan estimasi lokal.` : 'GEMINI_API_KEY belum diset di .env — menggunakan estimasi lokal sederhana.' },
      { title: 'Data Diterima', desc: `${input.type} M${input.magnitude} di ${input.location}, populasi ${input.population}` },
    ],
    confidence: 50, conclusion: 'Analisis fallback — set GEMINI_API_KEY untuk analisis AI penuh.', raw: null,
  };
}

/**
 * Jalankan ke-4 agent secara paralel dan hitung risk score gabungan.
 */
async function runFullAnalysis(input) {
  const agentIds = ['aria', 'logi', 'recon', 'pulse'];
  const results = await Promise.all(agentIds.map(id => runAgentReasoning(id, input)));

  const avgConfidence = Math.round(results.reduce((s,r) => s + r.confidence, 0) / results.length);

  // Risk score: kombinasi magnitude + population + rata2 confidence agent
  const magFactor = Math.min(40, (input.magnitude || 0) * 5);
  const popFactor = Math.min(30, Math.log10((input.population || 1) + 1) * 6);
  const aiFactor   = Math.min(30, avgConfidence * 0.3);
  const riskScore  = Math.round(Math.min(100, magFactor + popFactor + aiFactor));
  const riskLevel  = riskScore >= 80 ? 'BAHAYA' : riskScore >= 60 ? 'SIAGA' : riskScore >= 35 ? 'WASPADA' : 'NORMAL';

  return {
    reasoning: results,
    risk: { score: riskScore, level: riskLevel },
    avgConfidence,
  };
}

module.exports = { isConfigured, runAgentReasoning, runFullAnalysis, AGENTS };
