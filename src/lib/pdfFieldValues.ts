import type { AuditEntry, FieldState, FormField, FormSchema } from '../types';

function getFinalValue(field: FormField, state: FieldState): string | undefined {
  if (field.type === 'unable-to-assess') {
    if (state.acceptedAsIs) return field.unableReason;
    if (state.editedValue) return state.editedValue;
    return undefined;
  }
  if (field.type === 'comment-only') return state.editedValue;
  return state.editedValue ?? field.value;
}

/** Map UI value to AcroForm state (e.g. Yes -> /1). */
export function toPdfFieldValue(field: FormField, value: string): string {
  if (
    (field.schemaType === 'radio' || field.schemaType === 'choice') &&
    field.pdfStates?.length
  ) {
    const opts =
      field.options ?? field.pdfStates.map((s) => s.replace(/^\//, ''));
    const idx = opts.findIndex((o) => o === value);
    if (idx >= 0 && field.pdfStates[idx]) return field.pdfStates[idx];

    const lower = value.toLowerCase();
    if (lower === 'yes' && field.pdfStates[1]) return field.pdfStates[1];
    if (lower === 'no' && field.pdfStates[0]) return field.pdfStates[0];
    if (lower.includes('unable') && field.pdfStates[2]) return field.pdfStates[2];
  }
  return value;
}

export function buildPdfFieldMap(
  fields: FormField[],
  fieldStates: Record<string, FieldState>,
  schema: FormSchema,
): Record<string, string> {
  const map: Record<string, string> = {};

  for (const field of fields) {
    const value = getFinalValue(field, fieldStates[field.id]);
    if (!value || !field.pdfField) continue;
    map[field.pdfField] = toPdfFieldValue(field, value);
  }

  const fullName = fields
    .filter((f) => f.id === 'patient_first_name' || f.id === 'patient_last_name')
    .map((f) => getFinalValue(f, fieldStates[f.id]) ?? f.value)
    .join(' ')
    .trim();

  if (schema.patientNameOnEveryPage?.pdfFields && fullName) {
    for (const pdfFieldName of schema.patientNameOnEveryPage.pdfFields) {
      map[pdfFieldName] = fullName;
    }
  }

  return map;
}

export function serializeAuditForApi(auditLog: AuditEntry[]) {
  return auditLog.map((entry) => ({
    timestamp: entry.timestamp.toISOString(),
    message: entry.message,
    fieldId: entry.fieldId,
  }));
}
