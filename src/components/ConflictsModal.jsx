import { useState, useEffect } from 'react';
import { computeAllConflicts } from '../utils/resources';
import Spinner from './Spinner';

export default function ConflictsModal({ onClose, onOpenProject }) {
  const [conflicts, setConflicts] = useState(null);

  useEffect(() => {
    computeAllConflicts().then(setConflicts);
  }, []);

  return (
    <div className="overlay">
      <div className="modal wide">
        <h3>Conflitos de recursos</h3>
        {conflicts === null ? (
          <Spinner />
        ) : conflicts.length === 0 ? (
          <p className="empty-state">Nenhum conflito de alocação encontrado.</p>
        ) : (
          <div className="version-history-list">
            {conflicts.map((c, idx) => (
              <div key={idx} className="version-history-item">
                <strong>{c.resourceName}</strong>
                <p className="conflict-detail">Total {c.total}h de {c.capacity}h disponíveis:</p>
                <ul className="version-history-items-list">
                  {c.tasks.map((t, tIdx) => (
                    <li key={tIdx}>
                      <span className="conflict-task-link" onClick={() => onOpenProject(t.projectId)}>{t.projectName} / {t.name}</span> — {t.hours}h
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <div className="actions">
          <button className="secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}