import type { AuditEntry } from '../types';

interface AuditDrawerProps {
  entries: AuditEntry[];
  open: boolean;
  onToggle: () => void;
  formatTime: (date: Date) => string;
}

export default function AuditDrawer({
  entries,
  open,
  onToggle,
  formatTime,
}: AuditDrawerProps) {
  return (
    <div className={`audit-drawer ${open ? 'audit-drawer--open' : ''}`}>
      <button
        type="button"
        className="audit-drawer__toggle"
        onClick={onToggle}
      >
        <span className="audit-drawer__toggle-label">
          Audit trail
          <span className="audit-drawer__count">{entries.length}</span>
        </span>
        <span className="audit-drawer__chevron">{open ? '▼' : '▲'}</span>
      </button>

      {open && (
        <div className="audit-drawer__body">
          <ul className="audit-list">
            {entries.map((entry) => (
              <li key={entry.id} className="audit-list__item">
                <time className="audit-list__time">
                  {formatTime(entry.timestamp)}
                </time>
                <span className="audit-list__message">{entry.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
