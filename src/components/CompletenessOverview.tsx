import type { FormField, ProcessedForm } from '../types';
import { countByType } from '../types';

interface CompletenessOverviewProps {
  fields: FormField[];
  formName: string;
  patientName: string;
  aiMeta?: ProcessedForm['aiMeta'];
  onStartReview: (filter?: 'prefilled' | 'judgment' | 'unable') => void;
  onFillForDemo: () => void;
}

export default function CompletenessOverview({
  fields,
  formName,
  patientName,
  aiMeta,
  onStartReview,
  onFillForDemo,
}: CompletenessOverviewProps) {
  const counts = countByType(fields);

  return (
    <div className="flow-screen">
      <header className="flow-screen__header">
        <span className="flow-screen__logo">Verifill</span>
        <h1>Completeness overview</h1>
        <p>
          {formName} · {patientName} — here&apos;s what Verifill could and
          couldn&apos;t fill from the record.
        </p>
      </header>

      {aiMeta?.fallback && aiMeta.message && (
        <div className="ai-banner ai-banner--warning" role="status">
          {aiMeta.message}
        </div>
      )}
      {aiMeta?.used && !aiMeta.fallback && (
        <div className="ai-banner ai-banner--ok" role="status">
          Fields routed with AI from structured patient record rows.
        </div>
      )}

      <div className="completeness-card">
        <div className="completeness-summary">
          <span className="completeness-summary__total">
            {counts.total} fields
          </span>
          <span className="completeness-summary__arrow">→</span>
          <button
            type="button"
            className="completeness-chip completeness-chip--prefilled"
            onClick={() => onStartReview('prefilled')}
          >
            <strong>{counts.prefilled}</strong> pre-filled
          </button>
          <span className="completeness-summary__dot">·</span>
          <button
            type="button"
            className="completeness-chip completeness-chip--judgment"
            onClick={() => onStartReview('judgment')}
          >
            <strong>{counts.judgment}</strong> need your judgment
          </button>
          <span className="completeness-summary__dot">·</span>
          <button
            type="button"
            className="completeness-chip completeness-chip--unable"
            onClick={() => onStartReview('unable')}
          >
            <strong>{counts.unable}</strong> unable to assess
          </button>
        </div>

        <div className="completeness-breakdown">
          <section className="completeness-section">
            <h3>
              <span className="completeness-dot completeness-dot--blue" />
              Pre-filled — high confidence
            </h3>
            <p>
              One-to-one demographics from patients.csv (name, DOB, address).
              Practitioner/date fields from session context.
            </p>
            <ul>
              {fields
                .filter((f) => f.type === 'prefilled')
                .map((f) => (
                  <li key={f.id}>
                    <span className="completeness-field-label">{f.label}</span>
                    <span className="completeness-field-value">{f.value}</span>
                  </li>
                ))}
            </ul>
          </section>

          <section className="completeness-section">
            <h3>
              <span className="completeness-dot completeness-dot--light-blue" />
              Need your judgment
            </h3>
            <p>
              AI reads cited record rows and synthesizes evidence — no
              pre-filled verdict. You decide.
            </p>
            <ul>
              {fields
                .filter((f) => f.type === 'comment-only')
                .map((f) => (
                  <li key={f.id}>{f.label}</li>
                ))}
            </ul>
          </section>

          <section className="completeness-section">
            <h3>
              <span className="completeness-dot completeness-dot--amber" />
              Unable to assess
            </h3>
            <p>No evidence or out of scope — honest gaps, not guesses.</p>
            <ul>
              {fields
                .filter((f) => f.type === 'unable-to-assess')
                .map((f) => (
                  <li key={f.id}>
                    {f.label}
                    <span className="completeness-unable-reason">
                      {f.unableReason}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        </div>

        <div className="completeness-actions">
          <button
            type="button"
            className="btn btn--secondary btn--lg"
            onClick={onFillForDemo}
          >
            Fill for demo &amp; export
          </button>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={() => onStartReview()}
          >
            Start review →
          </button>
        </div>
      </div>
    </div>
  );
}
