import { useState } from 'react';
import { downloadBlob, exportFilledPdf } from '../lib/pdfExport';
import type {
  AuditEntry,
  FieldState,
  FormField,
  FormSchema,
} from '../types';

interface ExportViewProps {
  schema: FormSchema;
  fields: FormField[];
  fieldStates: Record<string, FieldState>;
  auditLog: AuditEntry[];
  formName: string;
  patientName: string;
  sectionOrder: string[];
  onBack: () => void;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-CA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function getFinalValue(field: FormField, state: FieldState): string {
  if (field.type === 'unable-to-assess') {
    if (state.acceptedAsIs) return field.unableReason ?? 'Unable to assess';
    if (state.editedValue) return state.editedValue;
    return field.unableReason ?? 'Unable to assess';
  }
  if (field.type === 'comment-only') {
    return state.editedValue ?? '—';
  }
  return state.editedValue ?? field.value ?? '—';
}

export default function ExportView({
  schema,
  fields,
  fieldStates,
  auditLog,
  formName,
  patientName,
  sectionOrder,
  onBack,
}: ExportViewProps) {
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const bySection = sectionOrder.map((section) => ({
    section,
    fields: fields.filter((f) => f.section === section),
  }));

  const handleDownloadPdf = async () => {
    setExporting(true);
    setExportMsg(null);
    try {
      const result = await exportFilledPdf(
        schema,
        fields,
        fieldStates,
        auditLog,
      );
      downloadBlob(result.blob, result.filename);
      setExportMsg(result.message ?? 'PDF downloaded.');
    } catch (e) {
      setExportMsg(String(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="export-view">
      <header className="export-view__header">
        <div className="export-success">
          <span className="export-success__icon">✓</span>
          <div>
            <h1>Form signed &amp; exported</h1>
            <p>
              {formName} — {patientName} — every value traceable to the patient
              record
            </p>
          </div>
        </div>
        <div className="export-view__actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={exporting}
            onClick={handleDownloadPdf}
          >
            {exporting ? 'Generating…' : 'Download filled PDF'}
          </button>
          <button type="button" className="btn btn--secondary" onClick={onBack}>
            Back to review
          </button>
        </div>
      </header>

      {exportMsg && <p className="export-view__notice">{exportMsg}</p>}

      <div className="export-view__grid">
        <section className="export-form">
          <h2>Completed form — review summary</h2>
          {bySection.map(({ section, fields: sectionFields }) => (
            <div key={section} className="export-section">
              <h3>{section}</h3>
              <dl className="export-fields">
                {sectionFields.map((field) => (
                  <div key={field.id} className="export-field">
                    <dt>{field.label}</dt>
                    <dd>{getFinalValue(field, fieldStates[field.id])}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
          <div className="export-signature">
            <p>
              <strong>Date signed:</strong>{' '}
              {new Date().toLocaleDateString('en-CA')}
            </p>
            <p className="export-signature__note">
              Export fills the original AcroForm template via{' '}
              <code>pdftk</code> on the local PDF server (
              <code>npm run dev</code>). Requires{' '}
              <code>brew install pdftk-java</code>. Template:{' '}
              <code>{schema.pdfFile}</code> in <code>public/forms/</code>.
            </p>
          </div>
        </section>

        <section className="export-audit">
          <h2>Audit trail</h2>
          <p className="export-audit__subtitle">
            Complete record of AI suggestions, type-checks, and physician actions
          </p>
          <ul className="audit-list audit-list--export">
            {[...auditLog].reverse().map((entry) => (
              <li key={entry.id} className="audit-list__item">
                <time className="audit-list__time">
                  {formatTime(entry.timestamp)}
                </time>
                <span className="audit-list__message">{entry.message}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
