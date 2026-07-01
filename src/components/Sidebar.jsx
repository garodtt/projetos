import Spinner from './Spinner';

export default function Sidebar({ projects, loading, currentProjectId, onSelect, onNewProject }) {
  return (
    <aside className="sidebar">
      <h2>📁 Projetos</h2>
      <div className="project-list">
        {loading ? (
          <Spinner />
        ) : projects.length === 0 ? (
          <p className="sidebar-empty">Nenhum projeto ainda.</p>
        ) : (
          projects.map(p => (
            <div
              key={p.id}
              className={'project-item' + (p.id === currentProjectId ? ' active' : '')}
              onClick={() => onSelect(p.id)}
            >
              {p.name}
            </div>
          ))
        )}
      </div>
      <button className="new-project-btn" onClick={onNewProject}>+ Novo Projeto</button>
    </aside>
  );
}