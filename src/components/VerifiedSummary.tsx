interface VerifiedSummaryProps {
  count: number;
  onExpand: () => void;
  onApproveAll: () => void;
}

export default function VerifiedSummary({
  count,
  onExpand,
  onApproveAll,
}: VerifiedSummaryProps) {
  return (
    <div className="verified-summary">
      <div className="verified-summary__content">
        <div className="verified-summary__icon">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 1.667a8.333 8.333 0 1 0 0 16.666A8.333 8.333 0 0 0 10 1.667Zm-1.25 11.458L5.833 9.792l1.042-1.042 1.875 1.875 4.375-4.375 1.042 1.042-5.417 5.417Z"
              fill="currentColor"
            />
          </svg>
        </div>
        <div>
          <p className="verified-summary__title">
            {count} verified fields ready to approve
          </p>
          <p className="verified-summary__hint">
            Objective extractions with high confidence — review sources or bulk
            approve.
          </p>
        </div>
      </div>
      <div className="verified-summary__actions">
        <button type="button" className="link-btn" onClick={onExpand}>
          Expand all
        </button>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={onApproveAll}
        >
          Approve all verified
        </button>
      </div>
    </div>
  );
}
