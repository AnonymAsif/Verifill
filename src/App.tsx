import { useCallback, useMemo, useRef, useState } from 'react';
import {
  getAttentionFields,
  getPrefilledFields,
  processForm,
} from './lib/formEngine';
import { loadPatientRecord } from './lib/patientRecord';
import type {
  AuditEntry,
  FieldState,
  FormField,
  ProcessedForm,
} from './types';
import { getSectionOrder } from './types';
import TopBar from './components/TopBar';
import FormPane from './components/FormPane';
import SourcePanel from './components/SourcePanel';
import AuditDrawer from './components/AuditDrawer';
import ExportView from './components/ExportView';
import FormSelectScreen from './components/FormSelectScreen';
import PatientSelectScreen from './components/PatientSelectScreen';
import ProcessingScreen from './components/ProcessingScreen';
import CompletenessOverview from './components/CompletenessOverview';

function createInitialFieldStates(fields: FormField[]): Record<string, FieldState> {
  const states: Record<string, FieldState> = {};
  for (const field of fields) {
    states[field.id] = {
      approved: false,
      sourcesViewed: new Set(),
      acceptedAsIs: field.type === 'unable-to-assess' ? false : undefined,
    };
  }
  return states;
}

function createInitialAudit(fields: FormField[]): AuditEntry[] {
  const now = new Date();
  return fields
    .filter((f) => f.type === 'prefilled')
    .map((f) => {
      const typeNote = f.typeCheckNote ? ` (${f.typeCheckNote})` : '';
      return {
        id: `audit-init-${f.id}`,
        timestamp: new Date(now.getTime() - 60000),
        message: `AI suggested "${f.label}": ${f.value}${typeNote}`,
        fieldId: f.id,
      };
    });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-CA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

let auditCounter = 0;

type Screen =
  | 'form-select'
  | 'patient-select'
  | 'processing'
  | 'completeness'
  | 'review'
  | 'export';

export default function App() {
  const [screen, setScreen] = useState<Screen>('form-select');
  const [selectedFormId, setSelectedFormId] = useState('t2201');
  const [processed, setProcessed] = useState<ProcessedForm | null>(null);

  const activeFields = processed?.fields ?? [];
  const formName = processed?.schema.title ?? 'Form';
  const patientName = processed?.record.displayName ?? 'Patient';

  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>({});
  const [verifiedCollapsed, setVerifiedCollapsed] = useState(true);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<
    'prefilled' | 'judgment' | 'unable' | null
  >(null);

  const processRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const prefilledFields = useMemo(
    () => getPrefilledFields(activeFields),
    [activeFields],
  );

  const attentionFields = useMemo(
    () => getAttentionFields(activeFields),
    [activeFields],
  );

  const sectionOrder = useMemo(
    () => getSectionOrder(activeFields),
    [activeFields],
  );

  const isFieldReviewed = useCallback(
    (field: FormField, state: FieldState): boolean => {
      if (field.type === 'prefilled') return state.approved;
      if (field.type === 'unable-to-assess')
        return state.approved || state.acceptedAsIs === true;
      if (field.type === 'comment-only') {
        const hasValue = Boolean(state.editedValue?.trim());
        return state.approved && hasValue;
      }
      return false;
    },
    [],
  );

  const reviewedCount = useMemo(
    () =>
      activeFields.filter((f) => isFieldReviewed(f, fieldStates[f.id])).length,
    [activeFields, fieldStates, isFieldReviewed],
  );

  const allReviewed =
    activeFields.length > 0 && reviewedCount === activeFields.length;

  const updateFieldState = useCallback(
    (fieldId: string, patch: Partial<FieldState>) => {
      setFieldStates((prev) => ({
        ...prev,
        [fieldId]: { ...prev[fieldId], ...patch },
      }));
    },
    [],
  );

  const addAudit = useCallback((message: string, fieldId?: string) => {
    auditCounter += 1;
    setAuditLog((prev) => [
      {
        id: `audit-${auditCounter}`,
        timestamp: new Date(),
        message,
        fieldId,
      },
      ...prev,
    ]);
  }, []);

  const handleViewSource = useCallback(
    (fieldId: string, sourceId: string, label: string) => {
      setActiveSourceId(sourceId);
      setActiveFieldId(fieldId);
      setFieldStates((prev) => {
        const current = prev[fieldId];
        const viewed = new Set(current.sourcesViewed);
        viewed.add(sourceId);
        return {
          ...prev,
          [fieldId]: { ...current, sourcesViewed: viewed },
        };
      });
      addAudit(`Source viewed — ${label}`, fieldId);
    },
    [addAudit],
  );

  const handleApprove = useCallback(
    (field: FormField) => {
      updateFieldState(field.id, { approved: true });
      if (field.type === 'comment-only' && fieldStates[field.id].editedValue) {
        addAudit(
          `Doctor entered judgment: "${fieldStates[field.id].editedValue}"`,
          field.id,
        );
      }
      addAudit(`Doctor approved "${field.label}"`, field.id);
    },
    [addAudit, fieldStates, updateFieldState],
  );

  const handleApproveAllVerified = useCallback(() => {
    setFieldStates((prev) => {
      const next = { ...prev };
      for (const field of prefilledFields) {
        if (!next[field.id]?.approved) {
          next[field.id] = { ...next[field.id], approved: true };
        }
      }
      return next;
    });
    addAudit(`Doctor bulk-approved ${prefilledFields.length} verified fields`);
    for (const field of prefilledFields) {
      addAudit(`Doctor approved "${field.label}"`, field.id);
    }
  }, [addAudit, prefilledFields]);

  const handleEdit = useCallback(
    (fieldId: string, newValue: string, oldValue: string, label: string) => {
      updateFieldState(fieldId, { editedValue: newValue });
      if (oldValue !== newValue && newValue.trim()) {
        addAudit(`Doctor edited "${label}": ${oldValue} → ${newValue}`, fieldId);
      }
    },
    [addAudit, updateFieldState],
  );

  const handleAcceptUnable = useCallback(
    (field: FormField) => {
      updateFieldState(field.id, { acceptedAsIs: true, approved: true });
      addAudit(
        `Doctor accepted "unable to assess" for "${field.label}"`,
        field.id,
      );
    },
    [addAudit, updateFieldState],
  );

  const handleOverrideUnable = useCallback(
    (fieldId: string, value: string, label: string) => {
      updateFieldState(fieldId, {
        editedValue: value,
        acceptedAsIs: false,
        approved: true,
      });
      addAudit(`Doctor overrode "${label}" with: ${value}`, fieldId);
    },
    [addAudit, updateFieldState],
  );

  const handleSignExport = useCallback(() => {
    addAudit('Form signed — generating filled PDF');
    setScreen('export');
  }, [addAudit]);

  const handleSelectForm = (formId: string) => {
    setSelectedFormId(formId);
    setScreen('patient-select');
  };

  const handleSelectPatient = () => {
    processRef.current = async () => {
      const record = await loadPatientRecord();
      const result = await processForm(selectedFormId, record);
      setProcessed(result);
      setFieldStates(createInitialFieldStates(result.fields));
      setAuditLog(createInitialAudit(result.fields));
      setVerifiedCollapsed(true);
      setActiveSourceId(null);
      setReviewFilter(null);
    };
    setScreen('processing');
  };

  const handleStartReview = (
    filter?: 'prefilled' | 'judgment' | 'unable',
  ) => {
    setReviewFilter(filter ?? null);
    if (filter === 'prefilled') setVerifiedCollapsed(false);
    setScreen('review');
  };

  if (screen === 'form-select') {
    return <FormSelectScreen onSelect={handleSelectForm} />;
  }

  if (screen === 'patient-select') {
    return (
      <PatientSelectScreen
        formName={
          selectedFormId === 't2201'
            ? 'T2201 — Disability Tax Credit Certificate'
            : "WSIB Form 8 — Health Professional's Report"
        }
        onSelect={handleSelectPatient}
        onBack={() => setScreen('form-select')}
      />
    );
  }

  if (screen === 'processing') {
    return (
      <ProcessingScreen
        onProcess={() => processRef.current()}
        onComplete={() => setScreen('completeness')}
      />
    );
  }

  if (screen === 'completeness' && processed) {
    return (
      <CompletenessOverview
        fields={processed.fields}
        formName={formName}
        patientName={patientName}
        aiMeta={processed.aiMeta}
        onStartReview={handleStartReview}
      />
    );
  }

  if (screen === 'export' && processed) {
    return (
      <ExportView
        schema={processed.schema}
        fields={processed.fields}
        fieldStates={fieldStates}
        auditLog={auditLog}
        formName={formName}
        patientName={patientName}
        sectionOrder={sectionOrder}
        onBack={() => setScreen('review')}
      />
    );
  }

  if (!processed) return null;

  return (
    <div className="app">
      <TopBar
        formName={formName}
        patientName={patientName}
        reviewedCount={reviewedCount}
        totalCount={activeFields.length}
        allReviewed={allReviewed}
        aiMetaMessage={
          processed.aiMeta?.fallback ? processed.aiMeta.message : undefined
        }
        onSignExport={handleSignExport}
      />

      <div className="workspace">
        <FormPane
          sectionOrder={sectionOrder}
          prefilledFields={prefilledFields}
          attentionFields={attentionFields}
          fieldStates={fieldStates}
          verifiedCollapsed={verifiedCollapsed}
          reviewFilter={reviewFilter}
          onToggleVerifiedCollapsed={() => setVerifiedCollapsed((v) => !v)}
          onApproveAllVerified={handleApproveAllVerified}
          onApprove={handleApprove}
          onEdit={handleEdit}
          onViewSource={handleViewSource}
          onAcceptUnable={handleAcceptUnable}
          onOverrideUnable={handleOverrideUnable}
          activeFieldId={activeFieldId}
        />

        <SourcePanel
          record={processed.record}
          activeSourceId={activeSourceId}
          activeFieldId={activeFieldId}
        />
      </div>

      <AuditDrawer
        entries={auditLog}
        open={auditOpen}
        onToggle={() => setAuditOpen((v) => !v)}
        formatTime={formatTime}
      />
    </div>
  );
}
