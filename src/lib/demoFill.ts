import type { FieldState, FormField } from '../types';

interface AnswerKeyEntry {
  status?: string;
  value?: string;
  suggested?: string;
  comment?: string;
  reason?: string;
}

function flattenAnswerKey(data: Record<string, unknown>): Map<string, AnswerKeyEntry> {
  const map = new Map<string, AnswerKeyEntry>();
  const skip = new Set(['form', 'patient', 'asOfDate', 'purpose', 'demoCounts']);

  for (const [key, val] of Object.entries(data)) {
    if (skip.has(key)) continue;
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue;

    for (const [fieldId, entry] of Object.entries(val as Record<string, unknown>)) {
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        map.set(fieldId, entry as AnswerKeyEntry);
      }
    }
  }
  return map;
}

export async function loadDemoAnswerKey(
  formId: string,
): Promise<Map<string, AnswerKeyEntry>> {
  if (formId !== 't2201') return new Map();
  try {
    const res = await fetch('/forms/golda_answer_key_t2201.json');
    if (!res.ok) return new Map();
    return flattenAnswerKey(await res.json());
  } catch {
    return new Map();
  }
}

function pickOption(field: FormField, preferred: string[]): string | undefined {
  if (!field.options?.length) return undefined;
  for (const p of preferred) {
    if (field.options.includes(p)) return p;
  }
  return field.options[0];
}

function normalizeSuggested(suggested: string, field: FormField): string {
  const lower = suggested.toLowerCase();
  if (field.inputType === 'select' || field.schemaType === 'radio') {
    if (field.options?.includes(suggested)) return suggested;
    if (lower.startsWith('yes')) return pickOption(field, ['Yes', '1']) ?? suggested;
    if (lower.startsWith('no')) return pickOption(field, ['No', '0']) ?? suggested;
    if (lower.includes('assess') || lower.includes('unable')) {
      return pickOption(field, ['Unable to determine', 'No', 'Yes']) ?? suggested;
    }
  }
  return suggested;
}

function resolveDemoValue(
  field: FormField,
  entry: AnswerKeyEntry | undefined,
): string {
  if (entry?.value && !entry.value.startsWith('<')) {
    return entry.value;
  }
  if (entry?.suggested) {
    return normalizeSuggested(entry.suggested, field);
  }
  if (entry?.comment) {
    return entry.comment;
  }

  if (field.inputType === 'select' || field.schemaType === 'radio') {
    if (field.id.includes('markedly_restricted')) {
      if (field.id.startsWith('walking_')) {
        return pickOption(field, ['Yes']) ?? 'Yes';
      }
      return pickOption(field, ['Unable to determine', 'No']) ?? 'No';
    }
    if (field.id.includes('duration_12mo')) {
      if (field.id.startsWith('walking_')) {
        return pickOption(field, ['Yes', '1']) ?? 'Yes';
      }
      return pickOption(field, ['No', '0']) ?? 'No';
    }
    if (field.id.includes('practitioner_profession')) {
      return pickOption(field, ['0', '1']) ?? field.options?.[0] ?? '0';
    }
    return pickOption(field, ['Yes', 'No']) ?? field.options?.[0] ?? 'Yes';
  }

  if (field.reasoning?.length) {
    return field.reasoning[0];
  }

  if (field.id.includes('onset_year')) return '2025';
  if (field.id.includes('nature') || field.id.includes('effects')) {
    return 'Chronic paralysis due to spinal cord injury (2025-09-10). Demo fill.';
  }
  if (field.id.includes('cumulative')) {
    return 'Combined mobility and self-care restrictions from traumatic SCI. Demo fill.';
  }

  return 'Demo fill — see clinical record.';
}

export function applyDemoFill(
  fields: FormField[],
  currentStates: Record<string, FieldState>,
  answerKey: Map<string, AnswerKeyEntry>,
): Record<string, FieldState> {
  const next: Record<string, FieldState> = { ...currentStates };

  for (const field of fields) {
    const entry = answerKey.get(field.id);
    const prev = next[field.id] ?? {
      approved: false,
      sourcesViewed: new Set<string>(),
    };

    const sourcesViewed = new Set(prev.sourcesViewed);
    if (field.citations?.length) {
      for (const c of field.citations) sourcesViewed.add(c.id);
    } else if (field.sourceId) {
      sourcesViewed.add(field.sourceId);
    } else {
      sourcesViewed.add('demo');
    }

    if (field.type === 'prefilled') {
      next[field.id] = { ...prev, approved: true, sourcesViewed };
    } else if (field.type === 'unable-to-assess') {
      next[field.id] = {
        ...prev,
        acceptedAsIs: true,
        approved: true,
        sourcesViewed,
      };
    } else if (field.type === 'comment-only') {
      next[field.id] = {
        ...prev,
        editedValue: resolveDemoValue(field, entry),
        approved: true,
        sourcesViewed,
      };
    }
  }

  return next;
}
