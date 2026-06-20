import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import type { AuditEntry, FieldState, FormField, FormSchema } from '../types';
import {
  buildPdfFieldMap,
  serializeAuditForApi,
} from './pdfFieldValues';

/** Standard PDF fonts (Helvetica) only support WinAnsi — strip/replace Unicode. */
function sanitizeForPdfText(text: string): string {
  return text
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[^\t\n\r\x20-\x7E\xA0-\xFF]/g, '?');
}

function getSummaryValue(field: FormField, state: FieldState): string {
  if (field.type === 'unable-to-assess') {
    if (state.editedValue) return state.editedValue;
    if (state.acceptedAsIs) return field.unableReason ?? 'Unable to assess';
    return field.unableReason ?? 'Unable to assess';
  }
  if (field.type === 'comment-only') {
    return state.editedValue ?? '(judgment not entered)';
  }
  return state.editedValue ?? field.value ?? '(empty)';
}

function wrapLines(text: string, maxChars: number): string[] {
  const clean = sanitizeForPdfText(text);
  if (!clean.trim()) return ['(empty)'];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars) {
      if (line) lines.push(line);
      line = word.length > maxChars ? word.slice(0, maxChars) : word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export interface PdfExportResult {
  blob: Blob;
  filename: string;
  usedTemplate: boolean;
  message?: string;
}

async function exportViaServer(
  schema: FormSchema,
  fields: FormField[],
  fieldStates: Record<string, FieldState>,
  auditLog: AuditEntry[],
): Promise<PdfExportResult | null> {
  const pdfValues = buildPdfFieldMap(fields, fieldStates, schema);
  const filename = `${schema.formId}-filled.pdf`;

  const res = await fetch('/api/export-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pdfFile: schema.pdfFile,
      pdfValues,
      auditLog: serializeAuditForApi(auditLog),
      filename,
    }),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body.error) detail = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  const blob = await res.blob();
  return {
    blob,
    filename,
    usedTemplate: true,
    message:
      'Official form PDF filled via pdftk (SYNTHETIC / DRAFT watermark + audit trail appended).',
  };
}

async function exportSummaryFallback(
  schema: FormSchema,
  fields: FormField[],
  fieldStates: Record<string, FieldState>,
  auditLog: AuditEntry[],
  reason: string,
): Promise<PdfExportResult> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  appendFormSummaryPages(pdfDoc, schema, fields, fieldStates, font, bold);
  watermarkPages(pdfDoc, font);
  await appendAuditPages(pdfDoc, auditLog, font);

  const pdfBytes = await pdfDoc.save();
  return {
    blob: new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
    filename: `${schema.formId}-filled.pdf`,
    usedTemplate: false,
    message: reason,
  };
}

export async function exportFilledPdf(
  schema: FormSchema,
  fields: FormField[],
  fieldStates: Record<string, FieldState>,
  auditLog: AuditEntry[],
): Promise<PdfExportResult> {
  try {
    const result = await exportViaServer(schema, fields, fieldStates, auditLog);
    if (result) return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isOffline =
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('Load failed');

    if (!isOffline) {
      return exportSummaryFallback(
        schema,
        fields,
        fieldStates,
        auditLog,
        `${msg} — exported summary PDF instead.`,
      );
    }
  }

  return exportSummaryFallback(
    schema,
    fields,
    fieldStates,
    auditLog,
    'PDF server not running. Start with: npm run dev (requires pdftk-java). Exported summary PDF instead.',
  );
}

function appendFormSummaryPages(
  pdfDoc: PDFDocument,
  schema: FormSchema,
  fields: FormField[],
  fieldStates: Record<string, FieldState>,
  font: PDFFont,
  bold: PDFFont,
) {
  const margin = 48;
  const pageWidth = 612;
  const pageHeight = 792;
  const contentWidth = pageWidth - margin * 2;
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  const drawLine = (text: string, size: number, lineFont: PDFFont, indent = 0) => {
    ensureSpace(size + 6);
    page.drawText(text, {
      x: margin + indent,
      y,
      size,
      font: lineFont,
      maxWidth: contentWidth - indent,
    });
    y -= size + 6;
  };

  drawLine('Verifill - Filled Form Summary', 16, bold);
  drawLine(sanitizeForPdfText(schema.title), 12, font);
  drawLine(
    `Exported ${new Date().toLocaleString('en-CA')} - SYNTHETIC / DRAFT demo output`,
    9,
    font,
  );
  y -= 8;

  for (const section of schema.sections) {
    const sectionFields = fields.filter((f) =>
      section.fields.some((sf) => sf.id === f.id),
    );
    if (sectionFields.length === 0) continue;

    ensureSpace(24);
    drawLine(sanitizeForPdfText(section.title), 11, bold);

    for (const field of sectionFields) {
      const value = getSummaryValue(field, fieldStates[field.id]);
      drawLine(`${sanitizeForPdfText(field.label)}:`, 9, bold);
      for (const line of wrapLines(value, 88)) {
        drawLine(line, 9, font, 12);
      }
      y -= 4;
    }
    y -= 6;
  }
}

function watermarkPages(pdfDoc: PDFDocument, font: PDFFont) {
  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize();
    page.drawText('SYNTHETIC / DRAFT - Verifill demo', {
      x: width / 2 - 120,
      y: height - 24,
      size: 10,
      font,
      color: rgb(0.7, 0.7, 0.7),
    });
  }
}

async function appendAuditPages(
  pdfDoc: PDFDocument,
  auditLog: AuditEntry[],
  font: PDFFont,
) {
  const margin = 40;
  const lineHeight = 12;
  let page = pdfDoc.addPage();
  let y = page.getHeight() - 40;

  page.drawText('Verifill - Audit Trail', {
    x: margin,
    y,
    size: 14,
    font,
  });
  y -= 24;

  for (const entry of [...auditLog].reverse()) {
    const line = sanitizeForPdfText(
      `${entry.timestamp.toLocaleTimeString()}  ${entry.message}`,
    );
    if (y < 40) {
      page = pdfDoc.addPage();
      y = page.getHeight() - 40;
    }
    page.drawText(line.slice(0, 90), { x: margin, y, size: 9, font });
    y -= lineHeight;
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function checkPdfServer(): Promise<{
  ok: boolean;
  pdftk: boolean;
  message?: string;
}> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return { ok: false, pdftk: false };
    return res.json();
  } catch {
    return { ok: false, pdftk: false, message: 'PDF server offline' };
  }
}
