interface ConfidenceBarProps {
  confidence: number;
}

export default function ConfidenceBar({ confidence }: ConfidenceBarProps) {
  const pct = Math.round(confidence * 100);
  const opacity = 0.35 + confidence * 0.65;

  return (
    <div className="confidence-bar">
      <div
        className="confidence-bar__fill"
        style={{
          width: `${pct}%`,
          opacity,
        }}
      />
      <span className="confidence-bar__label">{pct}% confidence</span>
    </div>
  );
}
