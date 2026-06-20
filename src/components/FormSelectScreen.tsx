import { FORM_LIBRARY } from '../lib/formEngine';

interface FormSelectScreenProps {
  onSelect: (formId: string) => void;
}

export default function FormSelectScreen({ onSelect }: FormSelectScreenProps) {
  return (
    <div className="flow-screen">
      <header className="flow-screen__header">
        <span className="flow-screen__logo">Verifill</span>
        <h1>Choose a form</h1>
        <p>
          Select a standard form from the built-in library. Each form ships with
          a pre-built field schema — Verifill matches your patient record to
          the fields and routes them for review.
        </p>
      </header>

      <div className="form-preset-grid">
        {FORM_LIBRARY.map((form) => (
          <button
            key={form.formId}
            type="button"
            className="form-preset-card"
            onClick={() => onSelect(form.formId)}
          >
            <span className="form-preset-card__badge">Standard form</span>
            <h2>{form.title}</h2>
            <p>{form.description}</p>
            <span className="form-preset-card__meta">
              Pre-built schema · AcroForm PDF fill target
            </span>
          </button>
        ))}
      </div>

      <p className="flow-footnote">
        Form definitions live in <code>/forms/*.schema.json</code> — authored
        once, not parsed at runtime.
      </p>
    </div>
  );
}
