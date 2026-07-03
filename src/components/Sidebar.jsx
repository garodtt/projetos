import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from './Toast';
import Spinner from './Spinner';

export default function Sidebar({ projects, loading, pendingCounts, currentProjectId, onSelect, onNewProject }) {
  const showToast = useToast();
  const [folders, setFolders] = useState([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [expanded, setExpanded] = useState(() => new Set());

  const loadFolders = useCallback(async () => {
    const { data, error } = await supabase.from('folders').select('*').order('created_at', { ascending: false });
    if (error) { alert('Erro ao carregar pastas: ' + error.message); setFoldersLoading(false); return; }
    setFolders(data);
    setFoldersLoading(false);
  }, []);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  useEffect(() => {
    if (!currentProjectId) return;
    const proj = projects.find(p => p.id === currentProjectId);
    if (proj?.folder_id) {
      setExpanded(prev => (prev.has(proj.folder_id) ? prev : new Set(prev).add(proj.folder_id)));
    }
  }, [currentProjectId, projects]);

  function toggleFolder(id) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function addFolder() {
    const name = prompt('Nome da nova pasta:');
    if (!name) return;
    const { error } = await supabase.from('folders').insert({ name });
    if (error) { alert('Erro ao criar pasta: ' + error.message); return; }
    showToast('Pasta criada');
    loadFolders();
  }

  async function renameFolder(folder, e) {
    e.stopPropagation();
    const name = prompt('Novo nome da pasta:', folder.name);
    if (!name || name === folder.name) return;
    const { error } = await supabase.from('folders').update({ name }).eq('id', folder.id);
    if (error) { alert('Erro ao renomear pasta: ' + error.message); return; }
    showToast('Pasta renomeada');
    loadFolders();
  }

  async function deleteFolder(folder, e) {
    e.stopPropagation();
    const hasProjects = projects.some(p => p.folder_id === folder.id);
    if (hasProjects) { alert('Mova os projetos pra fora dessa pasta antes de excluí-la.'); return; }
    if (!confirm('Excluir esta pasta?')) return;
    const { error } = await supabase.from('folders').delete().eq('id', folder.id);
    if (error) { alert('Erro ao excluir pasta: ' + error.message); return; }
    showToast('Pasta excluída');
    loadFolders();
  }

  const topLevelProjects = projects.filter(p => !p.folder_id);
  const sidebarItems = [
    ...folders.map(f => ({ kind: 'folder', data: f, sortKey: f.created_at })),
    ...topLevelProjects.map(p => ({ kind: 'project', data: p, sortKey: p.created_at })),
  ].sort((a, b) => new Date(b.sortKey) - new Date(a.sortKey));

  function renderProjectRow(p) {
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
  }

  function renderFolderRow(folder) {
    const isOpen = expanded.has(folder.id);
    const children = projects.filter(p => p.folder_id === folder.id);
    const folderPending = children.reduce((sum, p) => sum + (pendingCounts?.[p.id] || 0), 0);

    return (
      <div key={folder.id} className="folder-block">
        <div className="folder-row" onClick={() => toggleFolder(folder.id)}>
          <span className="folder-chevron">{isOpen ? '▾' : '▸'}</span>
          <span className="folder-icon">📁</span>
          <span className="folder-name">{folder.name}</span>
          {folderPending > 0 && <span className="pending-badge">{folderPending}</span>}
          <div className="folder-actions">
            <button className="icon-btn" onClick={e => { e.stopPropagation(); onNewProject(folder.id); }} title="Novo projeto nesta pasta" aria-label="Novo projeto nesta pasta">+</button>
            <button className="icon-btn" onClick={e => renameFolder(folder, e)} title="Renomear pasta" aria-label="Renomear pasta">✎</button>
            <button className="icon-btn delete-col" onClick={e => deleteFolder(folder, e)} title="Excluir pasta" aria-label="Excluir pasta">✕</button>
          </div>
        </div>
        {isOpen && (
          <div className="folder-children">
            {children.length === 0 ? (
              <p className="folder-empty">Nenhum projeto aqui ainda.</p>
            ) : (
              children.map(renderProjectRow)
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className="sidebar">
      <h2>📁 Projetos</h2>
      <div className="sidebar-actions">
        <button className="new-project-btn" onClick={() => onNewProject()}>+ Novo Projeto</button>
        <button className="new-folder-btn" onClick={addFolder}>+ Nova Pasta</button>
      </div>
      <div className="project-list">
        {(loading || foldersLoading) ? (
          <Spinner />
        ) : sidebarItems.length === 0 ? (
          <p className="sidebar-empty">Nenhum projeto ainda.</p>
        ) : (
          sidebarItems.map(item => item.kind === 'folder' ? renderFolderRow(item.data) : renderProjectRow(item.data))
        )}
      </div>
    </aside>
  );
}