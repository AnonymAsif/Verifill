# Verifill

AI-assisted clinical form review — pick a standard form from the library, load a patient record, review AI-routed fields with verifiable sources, and export a filled PDF with audit trail.

## Quick start

```bash
npm install
brew install pdftk-java   # required for filling the official CRA/WSIB PDFs
cp .env.example .env      # optional: OpenAI key for AI field routing
# set VITE_OPENAI_API_KEY=sk-... in .env
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

`npm run dev` starts **two processes**: the Vite UI (5173) and a local PDF server (3001) that fills the original AcroForm templates with **pdftk**. If you only run `vite`, export falls back to a summary PDF.

Without `VITE_OPENAI_API_KEY`, judgment fields use keyword fallback (demo only).

## PDF export (official form fill)

| Requirement | Why |
|---|---|
| `brew install pdftk-java` | CRA/WSIB PDFs are encrypted Adobe AcroForm — browser pdf-lib cannot fill them; pdftk can |
| `npm run dev` (not `vite` alone) | Starts `server/index.mjs` on port 3001 |
| Templates in `public/forms/` | `t2201-fill-23e.pdf`, `0008a_202408_healthprofessionalsreport_web.pdf` |

Export pipeline: **pdftk** fills the original PDF field-for-field → **pdf-lib** adds SYNTHETIC/DRAFT watermark + audit trail page.

Check the server: [http://localhost:3001/api/health](http://localhost:3001/api/health) should return `"pdftk": true`.

Production: `npm run build && npm start` (serves UI + PDF API on port 3001).

## Demo flow (PRD §14)

1. **Pick the form** — T2201 or WSIB Form 8 from the built-in library (no upload)
2. **Pick the patient** — Golda Heller (synthetic Synthea CSV bundle)
3. **Processing** — direct column extract for demographics, then **AI routes every other field** from structured record rows
4. **Completeness overview** — e.g. `21 fields → 9 pre-filled · 6 need your judgment · 6 unable to assess`
5. **Review** — bulk-approve verified, resolve judgment fields, accept unable-to-assess
6. **Sign & export** — download filled PDF (SYNTHETIC/DRAFT watermark + audit page)

## How fields get filled

| Route | Mechanism |
|---|---|
| **Pre-filled (demographics)** | 1:1 column map from `patients.csv` (name, DOB, address, etc.) + practitioner/session context |
| **Need your judgment** | LLM reads citeable `[row-id]` record context, synthesizes evidence in comments, cites real rows — **does not** pre-fill yes/no |
| **Unable to assess** | LLM (or fallback) finds no relevant evidence — honest gap, not a guess |

The answer key at `public/forms/golda_answer_key_t2201.json` is for **eval/testing only** — never used at runtime.

## Architecture

| Piece | Location |
|---|---|
| Form schemas (F1) | `public/forms/*.schema.json` |
| Patient CSV bundle | `public/demo_patient_golda/` |
| CSV parser (F2) | `src/lib/csvParser.ts`, `src/lib/patientRecord.ts` |
| Record context for LLM | `src/lib/recordContext.ts` |
| AI routing engine | `src/lib/aiEngine.ts` |
| Form orchestration (F5) | `src/lib/formEngine.ts` |
| Type checking (F4) | `src/lib/typeCheck.ts` |
| PDF export (F10) | `server/` (pdftk fill) + `src/lib/pdfExport.ts` |

### Environment

| Variable | Purpose |
|---|---|
| `VITE_OPENAI_API_KEY` | OpenAI (or compatible) API key — **required for production routing** |
| `VITE_OPENAI_MODEL` | Optional, default `gpt-4o-mini` |
| `VITE_OPENAI_BASE_URL` | Optional, default `https://api.openai.com/v1` |

Add blank PDF templates to `public/forms/` for full AcroForm fill:
- `t2201-fill-23e.pdf`
- `0008a_202408_healthprofessionalsreport_web.pdf`

Without PDFs, export generates an audit-trail PDF only.

## Stack

React 18 + TypeScript + Vite + pdf-lib + OpenAI chat completions (JSON mode)
