import type {
  FormSchemaSection,
  PatientRecord,
  RecordRow,
  SchemaField,
  SourceCitation,
} from '../types';
import {
  findRowById,
  getAllRowIds,
  getContextRowsForSection,
  serializeRecordForAI,
} from './recordContext';
import { gatherJudgmentEvidence, rowsToCitations } from './recordExtractor';

export type AIRoute = 'prefilled' | 'comment_judgment' | 'unable_to_assess';

export interface AIFieldResult {
  fieldId: string;
  route: AIRoute;
  value?: string;
  reasoning?: string[];
  citedRowIds: string[];
  unableReason?: string;
  confidence?: number;
}

export interface AIEngineMeta {
  used: boolean;
  fallback: boolean;
  message?: string;
}

let lastMeta: AIEngineMeta = { used: false, fallback: false };

export function getAIEngineMeta(): AIEngineMeta {
  return lastMeta;
}

export function isAIConfigured(): boolean {
  const key = import.meta.env.VITE_OPENAI_API_KEY;
  return Boolean(key && key.length > 10);
}

/** Only bare demographics map 1:1 to patients.csv columns — no AI. */
export function isDirectMappableFieldId(fieldId: string): boolean {
  return DIRECT_MAPPABLE.has(fieldId);
}

const DIRECT_MAPPABLE = new Set([
  'patient_first_name',
  'patient_last_name',
  'patient_dob',
  'patient_sin',
  'patient_address',
  'patient_city',
  'patient_postal',
  'worker_first_name',
  'worker_last_name',
  'worker_initials',
  'worker_dob',
  'worker_address',
  'worker_city',
  'worker_postal',
  'worker_sin',
]);

const APP_CONTEXT = new Set([
  'practitioner_name',
  'practitioner_license',
  'practitioner_phone',
  'practitioner_address',
  'practitioner_profession',
  'certification_date',
  'signoff_date',
  'signoff_signature',
  'billing_service_date',
  'billing_provider_name',
  'rtw_provider_name',
]);

export function isAppContextFieldId(fieldId: string): boolean {
  return APP_CONTEXT.has(fieldId);
}

export function fieldNeedsAI(field: SchemaField): boolean {
  if (isDirectMappableFieldId(field.id) || isAppContextFieldId(field.id)) {
    return false;
  }
  return true;
}

export async function aiRouteSection(
  section: FormSchemaSection,
  fields: SchemaField[],
  record: PatientRecord,
  formTitle: string,
): Promise<Map<string, AIFieldResult>> {
  const results = new Map<string, AIFieldResult>();

  if (fields.length === 0) return results;

  if (!isAIConfigured()) {
    lastMeta = {
      used: false,
      fallback: true,
      message:
        'AI not configured — set VITE_OPENAI_API_KEY. Using keyword fallback (demo only).',
    };
    for (const field of fields) {
      results.set(field.id, keywordFallback(field, section.id, record));
    }
    return results;
  }

  try {
    const contextRows = getContextRowsForSection(section.id, record);
    const validIds = getAllRowIds(record);
    const aiResults = await callLLM(
      formTitle,
      section,
      fields,
      contextRows,
      validIds,
    );
    lastMeta = { used: true, fallback: false };
    for (const r of aiResults) {
      results.set(r.fieldId, r);
    }
    return results;
  } catch (err) {
    lastMeta = {
      used: false,
      fallback: true,
      message: `AI error: ${err instanceof Error ? err.message : String(err)}. Using keyword fallback.`,
    };
    for (const field of fields) {
      results.set(field.id, keywordFallback(field, section.id, record));
    }
    return results;
  }
}

async function callLLM(
  formTitle: string,
  section: FormSchemaSection,
  fields: SchemaField[],
  contextRows: RecordRow[],
  validRowIds: Set<string>,
): Promise<AIFieldResult[]> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY!;
  const model = import.meta.env.VITE_OPENAI_MODEL ?? 'gpt-4o-mini';
  const baseUrl =
    import.meta.env.VITE_OPENAI_BASE_URL ?? 'https://api.openai.com/v1';

  const fieldSpec = fields.map((f) => ({
    fieldId: f.id,
    label: f.label,
    type: f.type,
    nature: f.nature,
  }));

  const systemPrompt = `You are Verifill, a clinical form assistant. You fill form fields from a structured patient record.

CRITICAL RULES:
1. citedRowIds MUST ONLY contain ids from the PATIENT RECORD section below — never invent ids or quote text not in those rows.
2. Fields with nature "judgment": route MUST be "comment_judgment". Leave value empty/null. Provide 1-3 reasoning paragraphs that synthesize relevant evidence but do NOT give a final yes/no verdict — the doctor decides.
3. Fields with nature "objective" that require synthesis across rows: use "comment_judgment" if not a single clear fact, or "prefilled" only for a direct one-to-one extraction from one row.
4. route "unable_to_assess" when the record has no relevant evidence for that field.
5. Never coach the doctor toward approval; surface true relevant evidence only.

Respond with JSON: { "fields": [ { "fieldId", "route", "value"?, "reasoning"?: string[], "citedRowIds": string[], "unableReason"?, "confidence"?: number } ] }`;

  const userPrompt = `Form: ${formTitle}
Section: ${section.title} (${section.id})

FIELDS TO ROUTE:
${JSON.stringify(fieldSpec, null, 2)}

PATIENT RECORD (cite using [id] prefix only):
${serializeRecordForAI(contextRows)}

Route every field listed above.`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty AI response');

  const parsed = JSON.parse(content) as { fields: AIFieldResult[] };
  return (parsed.fields ?? []).map((f) => sanitizeResult(f, validRowIds));
}

function sanitizeResult(
  raw: AIFieldResult,
  validRowIds: Set<string>,
): AIFieldResult {
  const citedRowIds = (raw.citedRowIds ?? []).filter((id) =>
    validRowIds.has(id),
  );

  if (raw.route === 'comment_judgment') {
    return {
      ...raw,
      value: undefined,
      citedRowIds,
      reasoning: raw.reasoning?.length
        ? raw.reasoning
        : ['Review the cited record rows and enter your judgment.'],
    };
  }

  if (raw.route === 'unable_to_assess') {
    return {
      ...raw,
      citedRowIds,
      unableReason:
        raw.unableReason ?? 'Unable to assess — no relevant evidence in record',
    };
  }

  // prefilled
  return {
    ...raw,
    citedRowIds,
    confidence: raw.confidence ?? 0.85,
  };
}

/** Demo fallback when no API key — keyword search only, not production quality. */
function keywordFallback(
  field: SchemaField,
  sectionId: string,
  record: PatientRecord,
): AIFieldResult {
  const { rows } = gatherJudgmentEvidence(field, sectionId, record);

  if (rows.length === 0) {
    return {
      fieldId: field.id,
      route: 'unable_to_assess',
      citedRowIds: [],
      unableReason: `No relevant evidence in record for "${field.label}"`,
    };
  }

  if (field.nature === 'judgment') {
    return {
      fieldId: field.id,
      route: 'comment_judgment',
      citedRowIds: rows.map((r) => r.id),
      reasoning: [
        `Keyword fallback (AI not configured): ${rows.length} potentially relevant row(s) found — review and decide.`,
      ],
      confidence: 0.4,
    };
  }

  return {
    fieldId: field.id,
    route: 'unable_to_assess',
    citedRowIds: rows.map((r) => r.id),
    unableReason: `Objective field "${field.label}" needs AI extraction — configure VITE_OPENAI_API_KEY`,
  };
}

export function aiResultToCitations(
  result: AIFieldResult,
  record: PatientRecord,
): SourceCitation[] {
  const rows = result.citedRowIds
    .map((id) => findRowById(record, id))
    .filter(Boolean) as RecordRow[];
  return rowsToCitations(rows);
}

export function citationsFromRowIds(
  record: PatientRecord,
  ids: string[],
): SourceCitation[] {
  const rows = ids
    .map((id) => findRowById(record, id))
    .filter(Boolean) as RecordRow[];
  return rowsToCitations(rows);
}
