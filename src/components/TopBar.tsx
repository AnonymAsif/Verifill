interface TopBarProps {
  formName: string;
  patientName: string;
  reviewedCount: number;
  totalCount: number;
  allReviewed: boolean;
  aiMetaMessage?: string;
  onFillForDemo: () => void;
  onSignExport: () => void;
}

export default function TopBar({
  formName,
  patientName,
  reviewedCount,
  totalCount,
  allReviewed,
  aiMetaMessage,
  onFillForDemo,
  onSignExport,
}: TopBarProps) {
  const pct = Math.round((reviewedCount / totalCount) * 100);

  return (
    <>
      {aiMetaMessage && (
        <div className="ai-banner ai-banner--warning ai-banner--compact" role="status">
          {aiMetaMessage}
        </div>
      )}
      <header className="top-bar">
      <div className="top-bar__brand">
        <span className="top-bar__logo">Verifill</span>
        <span className="top-bar__divider" />
        <span className="top-bar__form-name">{formName}</span>
      </div>

      <div className="top-bar__center">
        <span className="patient-chip">{patientName}</span>
        <div className="progress-meter">
          <div className="progress-meter__track">
            <div
              className="progress-meter__fill"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="progress-meter__label">
            {reviewedCount} of {totalCount} fields reviewed
          </span>
        </div>
      </div>

      <div className="top-bar__actions">
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={onFillForDemo}
        >
          Fill for demo
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!allReviewed}
          onClick={onSignExport}
        >
          Sign &amp; Export
        </button>
      </div>
    </header>
    </>
  );
}
