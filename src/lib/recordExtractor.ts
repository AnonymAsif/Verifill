import type { PatientRecord, RecordRow, SchemaField, SourceCitation } from '../types';
import { getPatientField } from './patientRecord';

export interface ExtractResult {
  value: string;
  sourceRowId: string;
  confidence: number;
  note?: string;
}

/** Direct column lookups for objective demographic / identity fields. */
const PATIENT_COLUMN: Record<string, string> = {
  patient_first_name: 'FIRST',
  patient_last_name: 'LAST',
  patient_dob: 'BIRTHDATE',
  patient_sin: 'SSN',
  patient_address: 'ADDRESS',
  patient_city: 'CITY',
  patient_postal: 'ZIP',
  worker_first_name: 'FIRST',
  worker_last_name: 'LAST',
  worker_initials: 'FIRST',
  worker_dob: 'BIRTHDATE',
  worker_address: 'ADDRESS',
  worker_city: 'CITY',
  worker_postal: 'ZIP',
  worker_sin: 'SSN',
};

const APP_CONTEXT_FIELDS: Record<string, () => string> = {
  practitioner_name: () => 'Dr. Demo Physician',
  practitioner_license: () => 'MD-48291',
  practitioner_phone: () => '(555) 010-2200',
  practitioner_address: () => '100 Clinic Way, Toronto ON',
  certification_date: () => new Date().toISOString().slice(0, 10),
  signoff_date: () => new Date().toISOString().slice(0, 10),
  billing_service_date: () => new Date().toISOString().slice(0, 10),
  signoff_signature: () => 'Dr. Demo Physician',
  billing_provider_name: () => 'Dr. Demo Physician',
  rtw_provider_name: () => 'Dr. Demo Physician',
};

/** Keywords used to find relevant rows for a form section (impairment area). */
export const SECTION_KEYWORDS: Record<string, string[]> = {
  vision: ['vision', 'visual', 'ophthalm', 'eye', 'sight'],
  speaking: ['speech', 'speaking', 'language', 'aphasia', 'dysarthria'],
  hearing: ['hearing', 'audiolog', 'deaf', 'ear'],
  walking: [
    'walk',
    'mobil',
    'gait',
    'paralysis',
    'spinal cord',
    'physical therapy',
    'physiotherapy',
    'occupational therapy',
  ],
  eliminating: ['elimin', 'bowel', 'bladder', 'incontinen', 'urinary', 'catheter'],
  feeding: ['feed', 'swallow', 'dysphagia', 'nutrition'],
  dressing: ['dress', 'groom', 'adl'],
  mental: [
    'mental',
    'cognitive',
    'anxiety',
    'depression',
    'gad-7',
    'phq',
    'brain',
    'memory',
    'concentrat',
  ],
  cumulative: ['spinal', 'paralysis', 'impairment', 'restrict', 'rehabilitation'],
  B_incident: ['injury', 'spinal', 'trauma', 'fracture', 'incident'],
  C_clinical: ['diagnosis', 'spinal', 'paralysis', 'fracture', 'injury'],
  D_treatment: [
    'medication',
    'therapy',
    'rehabilitation',
    'treatment',
    'oxycodone',
    'acetaminophen',
  ],
  F_rtw: ['therapy', 'rehabilitation', 'restrict', 'mobil', 'occupational', 'physical'],
};

const IMPAIRMENT_SECTIONS = new Set([
  'vision',
  'speaking',
  'hearing',
  'walking',
  'eliminating',
  'feeding',
  'dressing',
  'mental',
]);

function patientsRowId(record: PatientRecord): string | undefined {
  return record.timeline.find((g) => g.table === 'patients.csv')?.rows[0]?.id;
}

function rowSummary(row: RecordRow): string {
  const desc =
    row.cells.find((c) => c.key === 'DESCRIPTION')?.value ??
    row.cells.find((c) => c.key === 'VALUE')?.value ??
    row.cells.slice(0, 3).map((c) => `${c.key}: ${c.value}`).join('; ');
  const date = row.date ? ` (${row.date})` : '';
  return `${desc}${date}`;
}

export function searchEvidence(
  record: PatientRecord,
  keywords: string[],
  options?: { since?: string; tables?: string[] },
): RecordRow[] {
  const since = options?.since;
  const tableFilter = options?.tables
    ? new Set(options.tables.map((t) => (t.endsWith('.csv') ? t : `${t}.csv`)))
    : null;

  const hits: RecordRow[] = [];

  for (const group of record.timeline) {
    if (tableFilter && !tableFilter.has(group.table)) continue;

    for (const row of group.rows) {
      if (since && row.date && row.date < since) continue;

      const haystack = row.cells
        .map((c) => c.value)
        .join(' ')
        .toLowerCase();

      if (keywords.some((kw) => haystack.includes(kw.toLowerCase()))) {
        hits.push(row);
      }
    }
  }

  return hits;
}

export function extractObjectiveValue(
  field: SchemaField,
  sectionId: string,
  record: PatientRecord,
): ExtractResult | null {
  const appFn = APP_CONTEXT_FIELDS[field.id];
  if (appFn) {
    return {
      value: appFn(),
      sourceRowId: 'app-context',
      confidence: 0.99,
      note: 'From practitioner profile / signing context',
    };
  }

  const column = PATIENT_COLUMN[field.id];
  if (column) {
    let value = getPatientField(record, column);
    if (field.id === 'worker_initials' && value) {
      value = value.slice(0, 1).toUpperCase();
    }
    if (value) {
      return {
        value,
        sourceRowId: patientsRowId(record) ?? '',
        confidence: 0.97,
      };
    }
    return null;
  }

  if (field.id === 'med1_name') {
    const meds = record.tables.get('medications') ?? [];
    const painMed = meds.find(
      (m) =>
        m.DESCRIPTION?.toLowerCase().includes('oxy') ||
        m.DESCRIPTION?.toLowerCase().includes('pain'),
    );
    const med = painMed ?? meds[meds.length - 1];
    if (med?.DESCRIPTION) {
      const idx = meds.indexOf(med);
      return {
        value: med.DESCRIPTION,
        sourceRowId: `row-medications-${idx}`,
        confidence: 0.88,
      };
    }
  }

  if (field.id === 'med1_dose' || field.id === 'med1_frequency' || field.id === 'med1_duration') {
    return null;
  }

  if (field.id === 'incident_date') {
    const sci = findPrimaryImpairmentCondition(record);
    if (sci?.date) {
      return {
        value: sci.date,
        sourceRowId: sci.id,
        confidence: 0.9,
      };
    }
  }

  if (field.id.includes('onset_year')) {
    const cond = findPrimaryImpairmentCondition(record);
    if (cond?.date) {
      return {
        value: cond.date.slice(0, 4),
        sourceRowId: cond.id,
        confidence: 0.85,
        note: 'Year derived from condition onset date in record',
      };
    }
  }

  if (sectionId === 'patient_details' || sectionId === 'A_worker') {
    return null;
  }

  return null;
}

function findPrimaryImpairmentCondition(record: PatientRecord): RecordRow | undefined {
  const keywords = ['spinal cord', 'paralysis', 'spinal'];
  const conditions = record.timeline.find((g) => g.table === 'conditions.csv');
  if (!conditions) return undefined;

  const sciRows = conditions.rows.filter((row) => {
    const text = row.cells.map((c) => c.value).join(' ').toLowerCase();
    return keywords.some((k) => text.includes(k));
  });

  sciRows.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  return sciRows[0];
}

export function gatherJudgmentEvidence(
  field: SchemaField,
  sectionId: string,
  record: PatientRecord,
): { rows: RecordRow[]; keywords: string[] } {
  const keywords =
    SECTION_KEYWORDS[sectionId] ??
    field.label
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3);

  let rows = searchEvidence(record, keywords);

  if (field.id.includes('duration') || field.id.includes('12mo')) {
    const cond = findPrimaryImpairmentCondition(record);
    if (cond && !rows.some((r) => r.id === cond.id)) {
      rows = [cond, ...rows];
    }
  }

  if (field.id.includes('diagnosis') || field.id.includes('nature')) {
    const cond = findPrimaryImpairmentCondition(record);
    if (cond) rows = [cond, ...rows.filter((r) => r.id !== cond.id)];
  }

  const seen = new Set<string>();
  rows = rows.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  return { rows: rows.slice(0, 6), keywords };
}

export function buildJudgmentComment(
  field: SchemaField,
  _sectionId: string,
  rows: RecordRow[],
): string[] {
  if (rows.length === 0) {
    return [`No relevant evidence found in the patient record for "${field.label}".`];
  }

  const bullets = rows.map((r) => rowSummary(r));
  const paragraphs: string[] = [
    `The patient record contains ${rows.length} row(s) that may be relevant to "${field.label}":`,
    ...bullets.map((b) => `• ${b}`),
  ];

  if (field.id.includes('duration') || field.id.includes('12mo')) {
    const cond = rows.find((r) => r.table === 'conditions.csv');
    if (cond?.date) {
      const onset = new Date(cond.date);
      const months = Math.floor(
        (Date.now() - onset.getTime()) / (1000 * 60 * 60 * 24 * 30),
      );
      paragraphs.push(
        `Onset documented ${cond.date} (~${months} months ago). Whether this meets the ≥12 consecutive months threshold is a clinical/legal judgment — the record shows chronicity but you must decide.`,
      );
    }
  }

  if (field.id.includes('markedly_restricted') || field.type === 'radio') {
    paragraphs.push(
      'This is a judgment field — Verifill has not pre-filled a yes/no. Review the cited sources and enter your attestation.',
    );
  } else {
    paragraphs.push(
      'Review the cited sources and provide your clinical judgment. No value has been pre-filled.',
    );
  }

  return paragraphs;
}

export function rowsToCitations(rows: RecordRow[]): SourceCitation[] {
  return rows.map((row) => {
    const label =
      row.cells.find((c) => c.key === 'DESCRIPTION')?.value ??
      row.cells.find((c) => c.key === 'VALUE')?.value ??
      row.id;
    return {
      id: row.id,
      label: `${row.table} — ${String(label).slice(0, 48)}`,
      table: row.table,
      date: row.date,
    };
  });
}

export function assessImpairmentSection(
  sectionId: string,
  record: PatientRecord,
): { hasEvidence: boolean; rows: RecordRow[] } {
  if (!IMPAIRMENT_SECTIONS.has(sectionId)) {
    return { hasEvidence: true, rows: [] };
  }

  const keywords = SECTION_KEYWORDS[sectionId] ?? [];
  const rows = searchEvidence(record, keywords);
  return { hasEvidence: rows.length > 0, rows };
}

export function validatePostal(value: string): { ok: boolean; reason?: string } {
  const canadian = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
  if (canadian.test(value.trim())) return { ok: true };
  if (value === '00000' || value.length <= 5) {
    return {
      ok: false,
      reason:
        'Record contains US-format ZIP, not a Canadian postal code — cannot pre-fill',
    };
  }
  return { ok: false, reason: `Value "${value}" is not a valid postal code format` };
}
