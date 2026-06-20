import type { SchemaField, SchemaFieldType } from '../types';

export interface TypeCheckResult {
  passed: boolean;
  coercedValue?: string;
  note?: string;
  confidence: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function typeCheckValue(
  field: SchemaField,
  rawValue: string,
  dateFormat = 'YYYY-MM-DD',
): TypeCheckResult {
  const value = rawValue.trim();
  if (!value) {
    return {
      passed: false,
      note: 'Empty value — cannot pre-fill',
      confidence: 0,
    };
  }

  switch (field.type) {
    case 'date': {
      const normalized = normalizeDate(value, dateFormat);
      if (!normalized) {
        return {
          passed: false,
          note: `Date "${value}" failed format check (${dateFormat})`,
          confidence: 0.2,
        };
      }
      return { passed: true, coercedValue: normalized, confidence: 0.97 };
    }

    case 'number': {
      if (Number.isNaN(Number(value))) {
        return {
          passed: false,
          note: `"${value}" is not numeric`,
          confidence: 0.2,
        };
      }
      return { passed: true, coercedValue: value, confidence: 0.95 };
    }

    case 'radio':
    case 'choice': {
      const allowed = field.options ?? field.states ?? [];
      const match = allowed.find(
        (opt) => opt === value || opt.replace(/^\//, '') === value,
      );
      if (!match && allowed.length > 0) {
        return {
          passed: false,
          note: `Value "${value}" not in allowed options — routed to judgment`,
          confidence: 0.3,
        };
      }
      return {
        passed: true,
        coercedValue: match ?? value,
        confidence: match ? 0.92 : 0.75,
      };
    }

    case 'checkbox':
      return { passed: true, coercedValue: value, confidence: 0.9 };

    case 'text':
    default:
      return { passed: true, coercedValue: value, confidence: 0.94 };
  }
}

function normalizeDate(value: string, format: string): string | null {
  if (DATE_RE.test(value)) return value;
  if (format === 'YYYY-MM-DD' && value.length >= 10) {
    const slice = value.slice(0, 10);
    if (DATE_RE.test(slice)) return slice;
  }
  return null;
}

export function inputTypeForSchema(type: SchemaFieldType): 'text' | 'select' | 'textarea' {
  if (type === 'radio' || type === 'choice') return 'select';
  return 'text';
}
