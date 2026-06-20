import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

function sanitizeForPdfText(text) {
  return String(text)
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[^\t\n\r\x20-\x7E\xA0-\xFF]/g, '?');
}

export async function watermarkAndAppendAudit(filledPdfBytes, auditLog) {
  const doc = await PDFDocument.load(filledPdfBytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    page.drawText('SYNTHETIC / DRAFT - Verifill demo', {
      x: width / 2 - 120,
      y: height - 24,
      size: 10,
      font,
      color: rgb(0.7, 0.7, 0.7),
    });
  }

  let page = doc.addPage();
  let y = page.getHeight() - 40;
  const margin = 40;
  const lineHeight = 12;

  page.drawText('Verifill - Audit Trail', {
    x: margin,
    y,
    size: 14,
    font,
  });
  y -= 24;

  for (const entry of auditLog) {
    const ts = new Date(entry.timestamp);
    const line = sanitizeForPdfText(
      `${ts.toLocaleTimeString('en-CA')}  ${entry.message}`,
    );
    if (y < 40) {
      page = doc.addPage();
      y = page.getHeight() - 40;
    }
    page.drawText(line.slice(0, 90), { x: margin, y, size: 9, font });
    y -= lineHeight;
  }

  return Buffer.from(await doc.save());
}
