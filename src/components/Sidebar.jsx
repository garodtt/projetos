export default function Sidebar({ projects, currentProjectId, onSelect, onNewProject }) {
  return (
    <aside className="sidebar">
      <h2>📁 Projetos</h2>
      <div className="project-list">
        {projects.map(p => (
          <div
            key={p.id}
            className={'project-item' + (p.id === currentProjectId ? ' active' : '')}
            onClick={() => onSelect(p.id)}
          >
            {p.name}
          </div>
        ))}
      </div>
      <button className="new-project-btn" onClick={onNewProject}>+ Novo Projeto</button>
    </aside>
  );
}