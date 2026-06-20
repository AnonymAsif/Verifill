import type {
  FormField,
  FormSchema,
  FormSchemaSection,
  PatientRecord,
  ProcessedForm,
  SchemaField,
} from '../types';
import {
  aiResultToCitations,
  aiRouteSection,
  fieldNeedsAI,
  getAIEngineMeta,
  isAppContextFieldId,
  isDirectMappableFieldId,
  type AIFieldResult,
} from './aiEngine';
import {
  extractObjectiveValue,
  validatePostal,
} from './recordExtractor';
import { inputTypeForSchema, typeCheckValue } from './typeCheck';

export { getAIEngineMeta, isAIConfigured } from './aiEngine';

export const FORM_LIBRARY = [
  {
    formId: 't2201',
    title: 'T2201 — Disability Tax Credit Certificate',
    description:
      'CRA medical practitioner section — severe and prolonged impairment attestation',
    schemaPath: '/forms/t2201.schema.json',
  },
  {
    formId: 'wsib_form8',
    title: "WSIB Form 8 — Health Professional's Report",
    description:
      'Ontario WSIB — clinical findings, treatment plan, billing, return-to-work',
    schemaPath: '/forms/wsib_form8.schema.json',
  },
];

export async function loadSchema(path: string): Promise<FormSchema> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load schema: ${path}`);
  return res.json();
}

export async function processForm(
  formId: string,
  record: PatientRecord,
): Promise<ProcessedForm> {
  const entry = FORM_LIBRARY.find((f) => f.formId === formId);
  if (!entry) throw new Error(`Unknown form: ${formId}`);

  const schema = await loadSchema(entry.schemaPath);
  const fields: FormField[] = [];

  for (const section of schema.sections) {
    const aiFields = section.fields.filter(fieldNeedsAI);
    const aiResults =
      aiFields.length > 0
        ? await aiRouteSection(section, aiFields, record, schema.title)
        : new Map<string, AIFieldResult>();

    for (const schemaField of section.fields) {
      const field = await routeField(
        schemaField,
        section,
        record,
        schema.dateFormat,
        aiResults.get(schemaField.id),
      );
      fields.push(field);
    }
  }

  return {
    schema,
    fields,
    record,
    aiMeta: getAIEngineMeta(),
  };
}

async function routeField(
  schemaField: SchemaField,
  section: FormSchemaSection,
  record: PatientRecord,
  dateFormat: string | undefined,
  aiResult: AIFieldResult | undefined,
): Promise<FormField> {
  const base = {
    id: schemaField.id,
    label: schemaField.label,
    section: section.title,
    schemaType: schemaField.type,
    pdfField: schemaField.pdfField,
    inputType: inputTypeForSchema(schemaField.type),
    options:
      schemaField.options ??
      schemaField.states?.map((s) => s.replace(/^\//, '')),
    pdfStates: schemaField.states,
  };

  if (isDirectMappableFieldId(schemaField.id) || isAppContextFieldId(schemaField.id)) {
    return routeDirectObjective(base, schemaField, section.id, record, dateFormat);
  }

  if (aiResult) {
    return buildFromAI(base, schemaField, record, aiResult, dateFormat);
  }

  return {
    ...base,
    type: 'unable-to-assess',
    unableReason: 'No routing result for field',
  };
}

function routeDirectObjective(
  base: Omit<FormField, 'type'>,
  schemaField: SchemaField,
  sectionId: string,
  record: PatientRecord,
  dateFormat?: string,
): FormField {
  const extracted = extractObjectiveValue(schemaField, sectionId, record);

  if (!extracted?.value) {
    return {
      ...base,
      type: 'unable-to-assess',
      unableReason: `No matching data in patient record for "${schemaField.label}"`,
    };
  }

  if (schemaField.id.includes('postal')) {
    const postal = validatePostal(extracted.value);
    if (!postal.ok) {
      return {
        ...base,
        type: 'unable-to-assess',
        unableReason: postal.reason ?? 'Invalid postal code in record',
        typeCheckPassed: false,
        typeCheckNote: postal.reason,
      };
    }
  }

  const check = typeCheckValue(schemaField, extracted.value, dateFormat);
  if (!check.passed) {
    return {
      ...base,
      type: 'unable-to-assess',
      unableReason:
        check.note ??
        `Type-check failed — "${extracted.value}" cannot be written to this field`,
      typeCheckPassed: false,
      typeCheckNote: check.note,
    };
  }

  return {
    ...base,
    type: 'prefilled',
    value: check.coercedValue,
    confidence: Math.min(extracted.confidence, check.confidence),
    typeCheckPassed: true,
    typeCheckNote: extracted.note,
    sourceId:
      extracted.sourceRowId === 'app-context'
        ? undefined
        : extracted.sourceRowId,
  };
}

function buildFromAI(
  base: Omit<FormField, 'type'>,
  schemaField: SchemaField,
  record: PatientRecord,
  ai: AIFieldResult,
  dateFormat?: string,
): FormField {
  const citations = aiResultToCitations(ai, record);

  if (ai.route === 'unable_to_assess') {
    return {
      ...base,
      type: 'unable-to-assess',
      unableReason: ai.unableReason ?? 'Unable to assess from record',
      citations: citations.length ? citations : undefined,
    };
  }

  if (ai.route === 'comment_judgment') {
    return {
      ...base,
      type: 'comment-only',
      reasoning: ai.reasoning ?? ['Review cited sources and enter your judgment.'],
      citations,
      confidence: ai.confidence ?? 0.5,
      options:
        schemaField.type === 'radio' || schemaField.type === 'choice'
          ? ['Yes', 'No', 'Unable to determine']
          : base.options,
    };
  }

  // AI pre-fill (objective synthesis — rare, type-checked)
  const check = typeCheckValue(schemaField, ai.value ?? '', dateFormat);
  if (!check.passed || !check.coercedValue) {
    return {
      ...base,
      type: 'comment-only',
      reasoning: [
        ...(ai.reasoning ?? []),
        check.note ?? 'AI suggested a value but type-check failed — enter manually.',
      ],
      citations,
      confidence: 0.45,
      options: base.options,
    };
  }

  return {
    ...base,
    type: 'prefilled',
    value: check.coercedValue,
    confidence: Math.min(ai.confidence ?? 0.8, check.confidence),
    typeCheckPassed: true,
    typeCheckNote: 'AI extraction — verify source',
    sourceId: ai.citedRowIds[0],
    citations,
  };
}

export function getPrefilledFields(fields: FormField[]): FormField[] {
  return fields.filter((f) => f.type === 'prefilled');
}

export function getAttentionFields(fields: FormField[]): FormField[] {
  return fields.filter(
    (f) => f.type === 'comment-only' || f.type === 'unable-to-assess',
  );
}
