export type FieldType = 'prefilled' | 'comment-only' | 'unable-to-assess';

export type SchemaFieldType =
  | 'text'
  | 'date'
  | 'number'
  | 'checkbox'
  | 'radio'
  | 'choice';

export type SchemaFieldNature = 'objective' | 'judgment';

export interface SchemaField {
  id: string;
  label: string;
  type: SchemaFieldType;
  nature: SchemaFieldNature;
  pdfField?: string;
  states?: string[];
  options?: string[];
  note?: string;
}

export interface FormSchemaSection {
  id: string;
  title: string;
  note?: string;
  fields: SchemaField[];
}

export interface FormSchema {
  formId: string;
  title: string;
  issuer?: string;
  pdfFile: string;
  dateFormat?: string;
  sections: FormSchemaSection[];
  patientNameOnEveryPage?: { pdfFields: string[] };
}

export interface FormLibraryEntry {
  formId: string;
  title: string;
  description: string;
  schemaPath: string;
}

export interface SourceCitation {
  id: string;
  label: string;
  table: string;
  date?: string;
}

export interface FormField {
  id: string;
  label: string;
  section: string;
  type: FieldType;
  schemaType: SchemaFieldType;
  pdfField?: string;
  value?: string;
  confidence?: number;
  typeCheckPassed?: boolean;
  typeCheckNote?: string;
  sourceId?: string;
  reasoning?: string[];
  citations?: SourceCitation[];
  unableReason?: string;
  options?: string[];
  pdfStates?: string[];
  inputType?: 'text' | 'select' | 'textarea';
}

export interface AuditEntry {
  id: string;
  timestamp: Date;
  message: string;
  fieldId?: string;
}

export interface FieldState {
  approved: boolean;
  editedValue?: string;
  sourcesViewed: Set<string>;
  acceptedAsIs?: boolean;
}

export interface RecordRow {
  id: string;
  table: string;
  date?: string;
  cells: { key: string; value: string }[];
}

export interface RecordTableGroup {
  table: string;
  label: string;
  rows: RecordRow[];
}

export interface PatientRecord {
  tables: Map<string, Record<string, string>[]>;
  timeline: RecordTableGroup[];
  displayName: string;
}

export interface ProcessedForm {
  schema: FormSchema;
  fields: FormField[];
  record: PatientRecord;
  aiMeta?: {
    used: boolean;
    fallback: boolean;
    message?: string;
  };
}

export function countByType(fields: FormField[]) {
  return {
    prefilled: fields.filter((f) => f.type === 'prefilled').length,
    judgment: fields.filter((f) => f.type === 'comment-only').length,
    unable: fields.filter((f) => f.type === 'unable-to-assess').length,
    total: fields.length,
  };
}

export function getSectionOrder(fields: FormField[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const f of fields) {
    if (!seen.has(f.section)) {
      seen.add(f.section);
      order.push(f.section);
    }
  }
  return order;
}
