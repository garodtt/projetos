import Spinner from './Spinner';

export default function Sidebar({ projects, loading, pendingCounts, currentProjectId, onSelect, onNewProject }) {
  return (
    <aside className="sidebar">
      <h2>📁 Projetos</h2>
      <button className="new-project-btn" onClick={onNewProject}>+ Novo Projeto</button>
      <div className="project-list">
        {loading ? (
          <Spinner />
        ) : projects.length === 0 ? (
          <p className="sidebar-empty">Nenhum projeto ainda.</p>
        ) : (
          projects.map(p => {
            const count = pendingCounts?.[p.id] || 0;
            return (
              <div
                key={p.id}
                className={'project-item' + (p.id === currentProjectId ? ' active' : '')}
                onClick={() => onSelect(p.id)}
              >
                <span className="project-item-name">{p.name}</span>
                {count > 0 && <span className="pending-badge">{count}</span>}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}