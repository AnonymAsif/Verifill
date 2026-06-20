import { useEffect, useRef } from 'react';
import type { PatientRecord } from '../types';

interface SourcePanelProps {
  record: PatientRecord | null;
  activeSourceId: string | null;
  activeFieldId: string | null;
}

export default function SourcePanel({
  record,
  activeSourceId,
  activeFieldId,
}: SourcePanelProps) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!activeSourceId) return;
    const highlightEl = document.getElementById(`highlight-${activeSourceId}`);
    if (highlightEl && panelRef.current) {
      highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeSourceId, activeFieldId]);

  return (
    <aside className="source-panel" ref={panelRef}>
      <div className="source-panel__header">
        <h2 className="source-panel__title">Source</h2>
        <span className="source-panel__subtitle">
          Patient record{record ? ` — ${record.displayName}` : ''}
        </span>
      </div>

      {!activeSourceId || !record ? (
        <div className="source-panel__empty">
          <div className="source-panel__empty-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path
                d="M4 8h24M4 14h24M4 20h16M4 26h10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p>
            Click a source on any field to see the exact record row it came
            from.
          </p>
        </div>
      ) : (
        <div className="source-panel__content">
          {record.timeline.map((group) => (
            <section key={group.table} className="synthea-group">
              <header className="synthea-group__header">
                <h3>{group.label}</h3>
                <code>{group.table}</code>
              </header>
              <div className="synthea-rows">
                {group.rows.map((row) => {
                  const isHighlighted = row.id === activeSourceId;
                  return (
                    <div
                      key={row.id}
                      id={`highlight-${row.id}`}
                      className={`synthea-row ${isHighlighted ? 'synthea-row--highlighted' : ''}`}
                    >
                      <div className="synthea-row__meta">
                        <span className="synthea-row__id">{row.id}</span>
                        {row.date && (
                          <time className="synthea-row__date">{row.date}</time>
                        )}
                      </div>
                      <dl className="synthea-row__cells">
                        {row.cells.map((cell) => (
                          <div key={cell.key} className="synthea-cell">
                            <dt>{cell.key}</dt>
                            <dd>{cell.value || '—'}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </aside>
  );
}
