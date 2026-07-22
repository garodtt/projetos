import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from './Toast';
import Spinner from './Spinner';
import TextPromptModal from './TextPromptModal';

export default function Sidebar({
  projects, loading, pendingCounts, currentProjectId, onSelect, onNewProject,
  onOpenGlobalSchedule, onOpenFolderSchedule, isGlobalScheduleActive, activeFolderScheduleId,
  onOpenSearch, onOpenTrash, onOpenArchived, onOpenResources, onOpenConflicts,
  resourceConflictProjectIds, isAdmin, onOpenAdminPanel, userEmail, onLogout, onOpenMyAccount,
}) {
  const showToast = useToast();
  const [folders, setFolders] = useState([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [expanded, setExpanded] = useState(() => new Set());
  const [textPromptConfig, setTextPromptConfig] = useState(null);
  const [toolsOpen, setToolsOpen] = useState(false);

  const loadFolders = useCallback(async () => {
    const { data, error } = await supabase.from('folders').select('*').is('deleted_at', null).order('created_at', { ascending: false });
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

  function openAddFolderPrompt() {
    setTextPromptConfig({
      title: 'Nova pasta',
      label: 'Nome da pasta',
      initialValue: '',
      confirmLabel: 'Criar',
      onConfirm: async (value) => {
        setTextPromptConfig(null);
        const { error } = await supabase.from('folders').insert({ name: value });
        if (error) { alert('Erro ao criar pasta: ' + error.message); return; }
        showToast('Pasta criada');
        loadFolders();
      },
    });
  }

  function openRenameFolderPrompt(folder, e) {
    e.stopPropagation();
    setTextPromptConfig({
      title: 'Renomear pasta',
      label: 'Nome da pasta',
      initialValue: folder.name,
      confirmLabel: 'Salvar',
      onConfirm: async (value) => {
        setTextPromptConfig(null);
        const { error } = await supabase.from('folders').update({ name: value }).eq('id', folder.id);
        if (error) { alert('Erro ao renomear pasta: ' + error.message); return; }
        showToast('Pasta renomeada');
        loadFolders();
      },
    });
  }

  async function deleteFolder(folder, e) {
    e.stopPropagation();
    const hasProjects = projects.some(p => p.folder_id === folder.id);
    if (hasProjects) { alert('Mova os projetos pra fora dessa pasta antes de excluí-la.'); return; }
    const { error } = await supabase.from('folders').update({ deleted_at: new Date().toISOString() }).eq('id', folder.id);
    if (error) { alert('Erro ao excluir pasta: ' + error.message); return; }
    showToast('Pasta excluída', {
      actionLabel: 'Desfazer',
      onAction: async () => {
        await supabase.from('folders').update({ deleted_at: null }).eq('id', folder.id);
        loadFolders();
      },
    });
    loadFolders();
  }

  const activeProjects = projects.filter(p => !p.is_archived);
  const archivedCount = projects.length - activeProjects.length;

  const topLevelProjects = activeProjects.filter(p => !p.folder_id);
  const sidebarItems = [
    ...folders.map(f => ({ kind: 'folder', data: f, sortKey: f.created_at })),
    ...topLevelProjects.map(p => ({ kind: 'project', data: p, sortKey: p.created_at })),
  ].sort((a, b) => new Date(b.sortKey) - new Date(a.sortKey));

  function renderProjectRow(p) {
    const count = pendingCounts?.[p.id] || 0;
    const hasConflict = resourceConflictProjectIds?.has(p.id);
    return (
      <div
        key={p.id}
        className={'project-item' + (p.id === currentProjectId ? ' active' : '')}
        onClick={() => onSelect(p.id)}
      >
        <span className="project-item-name">{p.name}</span>
        {hasConflict && <span className="conflict-badge" title="Conflito de recurso">⚠</span>}
        {count > 0 && <span className="pending-badge">{count}</span>}
      </div>
    );
  }

  function renderFolderRow(folder) {
    const isOpen = expanded.has(folder.id);
    const children = activeProjects.filter(p => p.folder_id === folder.id);
    const folderPending = children.reduce((sum, p) => sum + (pendingCounts?.[p.id] || 0), 0);
    const folderHasConflict = children.some(p => resourceConflictProjectIds?.has(p.id));

    return (
      <div key={folder.id} className="folder-block">
        <div className="folder-row" onClick={() => toggleFolder(folder.id)}>
          <span className="folder-chevron">{isOpen ? '▾' : '▸'}</span>
          <span className="folder-icon">📁</span>
          <span className="folder-name">{folder.name}</span>
          {folderHasConflict && <span className="conflict-badge" title="Conflito de recurso em algum projeto">⚠</span>}
          {folderPending > 0 && <span className="pending-badge">{folderPending}</span>}
          <div className="folder-actions">
            <button className="icon-btn" onClick={e => { e.stopPropagation(); onNewProject(folder.id); }} title="Novo projeto nesta pasta" aria-label="Novo projeto nesta pasta">+</button>
            <button
              className={'icon-btn schedule-folder-btn' + (activeFolderScheduleId === folder.id ? ' active' : '')}
              onClick={e => { e.stopPropagation(); onOpenFolderSchedule(folder); }}
              title="Cronograma desta pasta"
              aria-label="Cronograma desta pasta"
            >📅</button>
            <button className="icon-btn" onClick={e => openRenameFolderPrompt(folder, e)} title="Renomear pasta" aria-label="Renomear pasta">✎</button>
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
        <button className="new-folder-btn" onClick={openAddFolderPrompt}>+ Nova Pasta</button>
        <button
          className={'schedule-general-btn' + (isGlobalScheduleActive ? ' active' : '')}
          onClick={onOpenGlobalSchedule}
        >
          📅 Cronograma Geral
        </button>
        <button className="sidebar-utility-btn" onClick={onOpenSearch}>🔍 Buscar</button>

        <button type="button" className="sidebar-tools-toggle" onClick={() => setToolsOpen(o => !o)}>
          {toolsOpen ? '▾' : '▸'} Mais opções
        </button>
        {toolsOpen && (
          <div className="sidebar-utility-list">
            <button className="sidebar-utility-btn" onClick={onOpenTrash}>🗑️ Lixeira</button>
            <button className="sidebar-utility-btn" onClick={onOpenResources}>🧑‍💼 Recursos</button>
            <button className="sidebar-utility-btn" onClick={onOpenConflicts}>⚠ Conflitos</button>
            {isAdmin && (
              <button className="sidebar-utility-btn" onClick={onOpenAdminPanel}>⚙️ Administração</button>
            )}
          </div>
        )}
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
      {archivedCount > 0 && (
        <button className="archived-link" onClick={onOpenArchived}>📦 Arquivados ({archivedCount})</button>
      )}

      {userEmail && (
        <div className="sidebar-user-row">
          <button className="sidebar-user-email" title="Minha conta" onClick={onOpenMyAccount}>
            👤 <span className="sidebar-user-email-text">{userEmail}</span>
          </button>
          <button className="sidebar-logout-btn" onClick={onLogout}>Sair</button>
        </div>
      )}

      {textPromptConfig && (
        <TextPromptModal
          title={textPromptConfig.title}
          label={textPromptConfig.label}
          initialValue={textPromptConfig.initialValue}
          confirmLabel={textPromptConfig.confirmLabel}
          onConfirm={textPromptConfig.onConfirm}
          onClose={() => setTextPromptConfig(null)}
        />
      )}
    </aside>
  );
}