/** Minimal CSV parser — handles quoted fields and commas. */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export const CLINICAL_TABLES = [
  'patients',
  'conditions',
  'medications',
  'observations',
  'procedures',
  'careplans',
  'encounters',
  'immunizations',
  'devices',
] as const;

export const TABLE_LABELS: Record<string, string> = {
  patients: 'Demographics',
  conditions: 'Conditions',
  medications: 'Medications',
  observations: 'Observations & screenings',
  procedures: 'Procedures',
  careplans: 'Care plans',
  encounters: 'Encounters',
  immunizations: 'Immunizations',
  devices: 'Devices',
};
