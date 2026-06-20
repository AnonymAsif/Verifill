interface PatientSelectScreenProps {
  formName: string;
  onSelect: () => void;
  onBack: () => void;
}

export default function PatientSelectScreen({
  formName,
  onSelect,
  onBack,
}: PatientSelectScreenProps) {
  return (
    <div className="flow-screen">
      <header className="flow-screen__header">
        <button type="button" className="link-btn flow-back" onClick={onBack}>
          ← Back
        </button>
        <span className="flow-screen__logo">Verifill</span>
        <h1>Select patient record</h1>
        <p>
          Choose a patient record for <strong>{formName}</strong>. In production
          this connects to your EMR — the demo uses a synthetic record.
        </p>
      </header>

      <div className="patient-select-grid">
        <button
          type="button"
          className="patient-card patient-card--selected"
          onClick={onSelect}
        >
          <div className="patient-card__avatar">GH</div>
          <div className="patient-card__info">
            <h2>Golda Heller</h2>
            <p className="patient-card__meta">
              F · DOB 1976-11-24 · Synthetic record
            </p>
            <ul className="patient-card__highlights">
              <li>Traumatic SCI — 2025-09-10</li>
              <li>Chronic spinal cord paralysis</li>
              <li>SCI rehab + physiotherapy</li>
              <li>GAD-7 / PHQ-2 screenings on file</li>
            </ul>
          </div>
          <span className="patient-card__action">Select →</span>
        </button>

        <div className="patient-card patient-card--disabled">
          <div className="patient-card__avatar patient-card__avatar--muted">
            +
          </div>
          <div className="patient-card__info">
            <h2>Connect EMR</h2>
            <p className="patient-card__meta">
              Live integration deferred — demo uses bundled patient record
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
