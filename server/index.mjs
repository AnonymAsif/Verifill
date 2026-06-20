import express from 'express';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fillPdfWithPdftk, isPdftkAvailable } from './pdftkFill.mjs';
import { watermarkAndAppendAudit } from './postProcess.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FORMS_DIR = join(ROOT, 'public', 'forms');
const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.use(express.json({ limit: '4mb' }));

let pdftkReady = false;

app.get('/api/health', async (_req, res) => {
  pdftkReady = await isPdftkAvailable();
  res.json({
    ok: pdftkReady,
    pdftk: pdftkReady,
    message: pdftkReady
      ? 'Ready to fill official AcroForm PDFs'
      : 'pdftk not found — install with: brew install pdftk-java',
  });
});

app.post('/api/export-pdf', async (req, res) => {
  try {
    pdftkReady = await isPdftkAvailable();
    if (!pdftkReady) {
      res.status(503).json({
        error:
          'pdftk is not installed. Run: brew install pdftk-java, then restart npm run dev',
      });
      return;
    }

    const { pdfFile, pdfValues, auditLog = [] } = req.body ?? {};
    if (!pdfFile || !pdfValues) {
      res.status(400).json({ error: 'pdfFile and pdfValues are required' });
      return;
    }

    const templatePath = join(FORMS_DIR, pdfFile);
    if (!existsSync(templatePath)) {
      res.status(404).json({
        error: `Template not found: public/forms/${pdfFile}`,
      });
      return;
    }

    const filled = await fillPdfWithPdftk(templatePath, pdfValues);
    const finalPdf = await watermarkAndAppendAudit(filled, auditLog);

    const filename =
      typeof req.body.filename === 'string'
        ? req.body.filename
        : 'filled.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename.replace(/"/g, '')}"`,
    );
    res.send(finalPdf);
  } catch (err) {
    console.error('[export-pdf]', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

if (process.env.NODE_ENV === 'production') {
  const dist = join(ROOT, 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => {
    res.sendFile(join(dist, 'index.html'));
  });
}

app.listen(PORT, async () => {
  pdftkReady = await isPdftkAvailable();
  console.log(`Verifill PDF server http://localhost:${PORT}`);
  console.log(
    pdftkReady
      ? 'pdftk ready — official AcroForm fill enabled'
      : 'WARNING: pdftk not found. Install: brew install pdftk-java',
  );
});
