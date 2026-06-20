import {
  CLINICAL_TABLES,
  parseCsv,
  TABLE_LABELS,
} from './csvParser';
import type { PatientRecord, RecordRow, RecordTableGroup } from '../types';

const PATIENT_BUNDLE = '/demo_patient_golda';

export async function loadPatientRecord(
  bundlePath = PATIENT_BUNDLE,
): Promise<PatientRecord> {
  const tables = new Map<string, Record<string, string>[]>();

  await Promise.all(
    CLINICAL_TABLES.map(async (table) => {
      try {
        const res = await fetch(`${bundlePath}/${table}.csv`);
        if (!res.ok) return;
        const text = await res.text();
        const rows = parseCsv(text);
        if (rows.length > 0) tables.set(table, rows);
      } catch {
        /* empty table — skip */
      }
    }),
  );

  const patients = tables.get('patients') ?? [];
  const first = patients[0]?.FIRST ?? '';
  const last = patients[0]?.LAST ?? '';
  const displayName = `${first} ${last}`.trim() || 'Patient';

  const timeline = buildTimeline(tables);

  return { tables, timeline, displayName };
}

function buildTimeline(
  tables: Map<string, Record<string, string>[]>,
): RecordTableGroup[] {
  const groups: RecordTableGroup[] = [];

  for (const table of CLINICAL_TABLES) {
    const rows = tables.get(table);
    if (!rows?.length) continue;

    const recordRows: RecordRow[] = rows.map((row, index) => {
      const date =
        row.START?.slice(0, 10) ??
        row.DATE?.slice(0, 10) ??
        row.BIRTHDATE ??
        undefined;

      const cells = Object.entries(row)
        .filter(([, v]) => v !== '')
        .map(([key, value]) => ({ key, value }));

      return {
        id: `row-${table}-${index}`,
        table: `${table}.csv`,
        date,
        cells,
      };
    });

    groups.push({
      table: `${table}.csv`,
      label: TABLE_LABELS[table] ?? table,
      rows: recordRows,
    });
  }

  return groups;
}

export function findRowBySource(
  record: PatientRecord,
  source: {
    file: string;
    match?: string;
    field?: string;
    date?: string;
  },
): RecordRow | undefined {
  const tableName = source.file.replace('.csv', '');
  const group = record.timeline.find((g) => g.table === source.file);
  if (!group) return undefined;

  if (source.field && tableName === 'patients') {
    const row = group.rows[0];
    if (row) return row;
  }

  if (source.match) {
    const match = source.match.toLowerCase();
    return group.rows.find((row) =>
      row.cells.some((c) => c.value.toLowerCase().includes(match)),
    );
  }

  if (source.date) {
    return group.rows.find((row) => row.date === source.date);
  }

  return undefined;
}

export function findRowByMatch(
  record: PatientRecord,
  file: string,
  match: string,
  date?: string,
): RecordRow | undefined {
  return findRowBySource(record, { file, match, date });
}

export function getPatientField(
  record: PatientRecord,
  field: string,
): string | undefined {
  const patients = record.tables.get('patients');
  return patients?.[0]?.[field];
}
