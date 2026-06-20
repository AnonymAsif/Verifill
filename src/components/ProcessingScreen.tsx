import { useEffect, useState } from 'react';

const STEPS = [
  'Loading form schema from library…',
  'Loading patient record (CSV)…',
  'Direct extraction — demographics & identity…',
  'AI routing — synthesizing evidence for remaining fields…',
  'Type-checking extracted values…',
  'Building review screen…',
];

interface ProcessingScreenProps {
  onProcess: () => Promise<void>;
  onComplete: () => void;
}

export default function ProcessingScreen({
  onProcess,
  onComplete,
}: ProcessingScreenProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const stepTimer = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, 550);

    const progressTimer = setInterval(() => {
      setProgress((p) => Math.min(p + 3, 92));
    }, 100);

    onProcess()
      .then(() => {
        if (cancelled) return;
        setProgress(100);
        setStepIndex(STEPS.length - 1);
        setTimeout(onComplete, 400);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        clearInterval(stepTimer);
        clearInterval(progressTimer);
      });

    return () => {
      cancelled = true;
      clearInterval(stepTimer);
      clearInterval(progressTimer);
    };
  }, [onProcess, onComplete]);

  return (
    <div className="flow-screen flow-screen--centered">
      <div className="processing-card">
        <div className="processing-card__spinner" />
        <h1>Processing</h1>
        {error ? (
          <p className="processing-card__error">{error}</p>
        ) : (
          <p className="processing-card__step">{STEPS[stepIndex]}</p>
        )}
        <div className="processing-card__bar">
          <div
            className="processing-card__fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <ul className="processing-steps">
          {STEPS.map((step, i) => (
            <li
              key={step}
              className={
                i < stepIndex
                  ? 'processing-steps__item processing-steps__item--done'
                  : i === stepIndex
                    ? 'processing-steps__item processing-steps__item--active'
                    : 'processing-steps__item'
              }
            >
              {i < stepIndex ? '✓' : i === stepIndex ? '→' : '·'} {step}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
