import type { FieldState, FormField } from '../types';
import FieldCard from './FieldCard';
import VerifiedSummary from './VerifiedSummary';

interface FormPaneProps {
  sectionOrder: string[];
  prefilledFields: FormField[];
  attentionFields: FormField[];
  fieldStates: Record<string, FieldState>;
  verifiedCollapsed: boolean;
  reviewFilter?: 'prefilled' | 'judgment' | 'unable' | null;
  onToggleVerifiedCollapsed: () => void;
  onApproveAllVerified: () => void;
  onApprove: (field: FormField) => void;
  onEdit: (
    fieldId: string,
    newValue: string,
    oldValue: string,
    label: string,
  ) => void;
  onViewSource: (fieldId: string, sourceId: string, label: string) => void;
  onAcceptUnable: (field: FormField) => void;
  onOverrideUnable: (fieldId: string, value: string, label: string) => void;
  activeFieldId: string | null;
}

export default function FormPane({
  sectionOrder,
  prefilledFields,
  attentionFields,
  fieldStates,
  verifiedCollapsed,
  reviewFilter,
  onToggleVerifiedCollapsed,
  onApproveAllVerified,
  onApprove,
  onEdit,
  onViewSource,
  onAcceptUnable,
  onOverrideUnable,
  activeFieldId,
}: FormPaneProps) {
  const allPrefilledApproved = prefilledFields.every(
    (f) => fieldStates[f.id].approved,
  );
  const pendingPrefilledCount = prefilledFields.filter(
    (f) => !fieldStates[f.id].approved,
  ).length;

  const showAttention = reviewFilter !== 'prefilled';
  const showVerified =
    reviewFilter === 'prefilled' ||
    reviewFilter === null ||
    reviewFilter === undefined;
  const forceExpanded = reviewFilter === 'prefilled';

  const filteredAttention =
    reviewFilter === 'judgment'
      ? attentionFields.filter((f) => f.type === 'comment-only')
      : reviewFilter === 'unable'
        ? attentionFields.filter((f) => f.type === 'unable-to-assess')
        : attentionFields;

  const attentionBySection = sectionOrder
    .map((section) => ({
      section,
      fields: filteredAttention.filter((f) => f.section === section),
    }))
    .filter((g) => g.fields.length > 0);

  return (
    <main className="form-pane">
      <div className="form-pane__header">
        <h1 className="form-pane__title">Medical practitioner section</h1>
        <p className="form-pane__subtitle">
          Review AI suggestions, make judgment calls, then sign.
        </p>
      </div>

      {showAttention &&
        attentionBySection.map(({ section, fields }) => (
        <section key={section} className="form-section form-section--attention">
          <h2 className="form-section__title">{section}</h2>
          {fields.map((field) => (
            <FieldCard
              key={field.id}
              field={field}
              state={fieldStates[field.id]}
              onApprove={() => onApprove(field)}
              onEdit={(val, old) => onEdit(field.id, val, old, field.label)}
              onViewSource={(sourceId, label) =>
                onViewSource(field.id, sourceId, label)
              }
              onAcceptUnable={() => onAcceptUnable(field)}
              onOverrideUnable={(val) =>
                onOverrideUnable(field.id, val, field.label)
              }
              isActive={activeFieldId === field.id}
            />
          ))}
        </section>
        ))}

      {showVerified && !allPrefilledApproved && verifiedCollapsed && !forceExpanded && (
        <VerifiedSummary
          count={pendingPrefilledCount}
          onExpand={onToggleVerifiedCollapsed}
          onApproveAll={onApproveAllVerified}
        />
      )}

      {showVerified && (!verifiedCollapsed || forceExpanded) && (
        <section className="form-section form-section--verified">
          <div className="form-section__header">
            <h2 className="form-section__title">
              {allPrefilledApproved
                ? 'Verified extractions'
                : 'Pre-filled — high confidence'}
            </h2>
            {!allPrefilledApproved && (
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={onApproveAllVerified}
              >
                Approve all verified
              </button>
            )}
          </div>
          {prefilledFields.map((field) => (
            <FieldCard
              key={field.id}
              field={field}
              state={fieldStates[field.id]}
              onApprove={() => onApprove(field)}
              onEdit={(val, old) => onEdit(field.id, val, old, field.label)}
              onViewSource={(sourceId, label) =>
                onViewSource(field.id, sourceId, label)
              }
              onAcceptUnable={() => onAcceptUnable(field)}
              onOverrideUnable={(val) =>
                onOverrideUnable(field.id, val, field.label)
              }
              isActive={activeFieldId === field.id}
            />
          ))}
        </section>
      )}

      {showVerified && allPrefilledApproved && verifiedCollapsed && !forceExpanded && (
        <div className="verified-collapsed-bar">
          <span className="verified-collapsed-bar__icon">✓</span>
          <span>
            {prefilledFields.length} verified fields approved
          </span>
          <button
            type="button"
            className="link-btn"
            onClick={onToggleVerifiedCollapsed}
          >
            Show details
          </button>
        </div>
      )}
    </main>
  );
}
