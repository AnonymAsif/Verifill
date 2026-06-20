import type { PatientRecord, RecordRow } from '../types';
import { searchEvidence, SECTION_KEYWORDS } from './recordExtractor';

/** Serialize record rows for the LLM — each line is citeable by `id`. */
export function serializeRecordForAI(rows: RecordRow[]): string {
  return rows
    .map((row) => {
      const cells = row.cells
        .map((c) => `${c.key}=${JSON.stringify(c.value)}`)
        .join(' | ');
      return `[${row.id}] ${row.table}${row.date ? ` (${row.date})` : ''}: ${cells}`;
    })
    .join('\n');
}

/** Rows sent to the model: demographics + section-relevant evidence. */
export function getContextRowsForSection(
  sectionId: string,
  record: PatientRecord,
): RecordRow[] {
  const seen = new Set<string>();
  const out: RecordRow[] = [];

  const add = (row: RecordRow | undefined) => {
    if (row && !seen.has(row.id)) {
      seen.add(row.id);
      out.push(row);
    }
  };

  const patients = record.timeline.find((g) => g.table === 'patients.csv');
  patients?.rows.forEach(add);

  const keywords = SECTION_KEYWORDS[sectionId];
  if (keywords?.length) {
    searchEvidence(record, keywords).forEach(add);
  }

  // Impairment / clinical sections: always include spinal/SCI conditions + recent meds
  if (
    sectionId.includes('walking') ||
    sectionId.includes('mental') ||
    sectionId.startsWith('B_') ||
    sectionId.startsWith('C_') ||
    sectionId.startsWith('D_') ||
    sectionId.startsWith('F_') ||
    ['eliminating', 'dressing', 'cumulative'].includes(sectionId)
  ) {
    searchEvidence(record, ['spinal', 'paralysis', 'fracture', 'injury']).forEach(
      add,
    );
    searchEvidence(record, ['therapy', 'rehabilitation', 'medication']).forEach(
      add,
    );
  }

  // Cap token load while keeping diverse tables
  if (out.length > 80) {
    return out.slice(0, 80);
  }
  return out;
}

export function getAllRowIds(record: PatientRecord): Set<string> {
  const ids = new Set<string>();
  for (const group of record.timeline) {
    for (const row of group.rows) {
      ids.add(row.id);
    }
  }
  return ids;
}

export function findRowById(
  record: PatientRecord,
  id: string,
): RecordRow | undefined {
  for (const group of record.timeline) {
    const row = group.rows.find((r) => r.id === id);
    if (row) return row;
  }
  return undefined;
}
