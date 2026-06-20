import { useState } from 'react';
import type { FieldState, FormField } from '../types';
import ConfidenceBar from './ConfidenceBar';

interface FieldCardProps {
  field: FormField;
  state: FieldState;
  onApprove: () => void;
  onEdit: (newValue: string, oldValue: string) => void;
  onViewSource: (sourceId: string, label: string) => void;
  onAcceptUnable: () => void;
  onOverrideUnable: (value: string) => void;
  isActive: boolean;
}

export default function FieldCard({
  field,
  state,
  onApprove,
  onEdit,
  onViewSource,
  onAcceptUnable,
  onOverrideUnable,
  isActive,
}: FieldCardProps) {
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideValue, setOverrideValue] = useState('');

  const displayValue =
    state.editedValue ?? field.value ?? '';
  const isApproved = state.approved;

  if (field.type === 'prefilled' && isApproved) {
    return (
      <div className="field-row field-row--approved">
        <span className="field-row__check">✓</span>
        <span className="field-row__label">{field.label}</span>
        <span className="field-row__value">{displayValue}</span>
      </div>
    );
  }

  const cardClass = [
    'field-card',
    `field-card--${field.type}`,
    isActive ? 'field-card--active' : '',
    isApproved ? 'field-card--approved' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const canApproveComment =
    field.type === 'comment-only' &&
    Boolean(state.editedValue?.trim()) &&
    state.sourcesViewed.size > 0;

  const canApprovePrefilled = field.type === 'prefilled' && !isApproved;

  return (
    <div className={cardClass}>
      <div className="field-card__header">
        <span className="field-card__label">{field.label}</span>
        {field.type === 'comment-only' && (
          <span className="badge badge--judgment">Needs your judgment</span>
        )}
        {field.type === 'unable-to-assess' && (
          <span className="badge badge--amber">Unable to assess</span>
        )}
      </div>

      {field.type === 'prefilled' && (
        <>
          <div className="field-card__value">{displayValue}</div>
          {field.confidence !== undefined && (
            <ConfidenceBar confidence={field.confidence} />
          )}
          {field.typeCheckNote && (
            <p className="field-typecheck-note">{field.typeCheckNote}</p>
          )}
          <div className="field-card__footer">
            {field.sourceId && (
              <button
                type="button"
                className="link-btn"
                onClick={() =>
                  onViewSource(field.sourceId!, field.label)
                }
              >
                View source
              </button>
            )}
            <label className="approve-check">
              <input
                type="checkbox"
                checked={isApproved}
                onChange={onApprove}
                disabled={!canApprovePrefilled}
              />
              <span>Approve</span>
            </label>
          </div>
        </>
      )}

      {field.type === 'comment-only' && (
        <>
          <div className="field-card__empty-input">
            {field.inputType === 'select' ? (
              <select
                className="field-input field-input--select"
                value={state.editedValue ?? ''}
                onChange={(e) =>
                  onEdit(e.target.value, state.editedValue ?? '')
                }
              >
                <option value="">Select your answer…</option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <textarea
                className="field-input"
                placeholder="Enter your clinical judgment…"
                value={state.editedValue ?? ''}
                onChange={(e) =>
                  onEdit(e.target.value, state.editedValue ?? '')
                }
                rows={2}
              />
            )}
          </div>

          <div className="comment-box">
            <div className="comment-box__avatar">AI</div>
            <div className="comment-box__body">
              {field.reasoning?.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
              {field.citations && field.citations.length > 0 && (
                <div className="comment-box__citations">
                  <span className="comment-box__citations-label">Sources:</span>
                  {field.citations.map((cite) => (
                    <button
                      key={cite.id}
                      type="button"
                      className={`citation-chip ${
                        state.sourcesViewed.has(cite.id)
                          ? 'citation-chip--viewed'
                          : ''
                      }`}
                      onClick={() =>
                        onViewSource(cite.id, cite.label)
                      }
                    >
                      {cite.table}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="field-card__footer field-card__footer--hint">
            {!state.sourcesViewed.size && (
              <span className="field-hint">
                Open at least one source to unlock approval
              </span>
            )}
            {state.sourcesViewed.size > 0 && !state.editedValue?.trim() && (
              <span className="field-hint">
                Enter your answer to unlock approval
              </span>
            )}
            <label className="approve-check">
              <input
                type="checkbox"
                checked={isApproved}
                onChange={onApprove}
                disabled={!canApproveComment}
              />
              <span>Approve</span>
            </label>
          </div>
        </>
      )}

      {field.type === 'unable-to-assess' && (
        <>
          <div className="unable-box">
            <p>{field.unableReason}</p>
          </div>

          {!isApproved && !overrideMode && (
            <div className="field-card__footer">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={onAcceptUnable}
              >
                Accept as-is
              </button>
              <button
                type="button"
                className="link-btn"
                onClick={() => setOverrideMode(true)}
              >
                Override with value
              </button>
            </div>
          )}

          {overrideMode && !isApproved && (
            <div className="override-box">
              <input
                type="text"
                className="field-input"
                placeholder="Enter override value…"
                value={overrideValue}
                onChange={(e) => setOverrideValue(e.target.value)}
              />
              <div className="override-box__actions">
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  disabled={!overrideValue.trim()}
                  onClick={() => {
                    onOverrideUnable(overrideValue);
                    setOverrideMode(false);
                  }}
                >
                  Save override
                </button>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setOverrideMode(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {isApproved && (
            <div className="field-row field-row--approved-inline">
              <span className="field-row__check">✓</span>
              <span>
                {state.acceptedAsIs
                  ? 'Accepted — unable to assess'
                  : `Overridden: ${state.editedValue}`}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
