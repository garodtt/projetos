import { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabaseClient';
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import ProjectModal from './components/ProjectModal';
import ProjectVersionModal from './components/ProjectVersionModal';
import GlobalSearchModal from './components/GlobalSearchModal';
import TrashModal from './components/TrashModal';
import ArchivedProjectsModal from './components/ArchivedProjectsModal';
import ResourcesModal from './components/ResourcesModal';
import ConflictsModal from './components/ConflictsModal';
import ActivitiesTab from './components/activities/ActivitiesTab';
import TasksTab from './components/tasks/TasksTab';
import ScheduleTab from './components/schedule/ScheduleTab';
import CombinedScheduleView from './components/schedule/CombinedScheduleView';
import Spinner from './components/Spinner';
import { computeAllConflicts } from './utils/resources';

export default function App() {
  // undefined = ainda checando se há sessão; null = deslogado; objeto = logado
  const [session, setSession] = useState(undefined);
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [pendingCounts, setPendingCounts] = useState({});
  const [resourceConflictProjectIds, setResourceConflictProjectIds] = useState(new Set());
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [currentProject, setCurrentProject] = useState(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('activities');
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectModalMode, setProjectModalMode] = useState('new');
  const [initialFolderId, setInitialFolderId] = useState(null);
  const [taskRefreshTick, setTaskRefreshTick] = useState(0);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [trashModalOpen, setTrashModalOpen] = useState(false);
  const [archivedModalOpen, setArchivedModalOpen] = useState(false);
  const [resourcesModalOpen, setResourcesModalOpen] = useState(false);
  const [conflictsModalOpen, setConflictsModalOpen] = useState(false);

  const [mainView, setMainView] = useState('project');
  const [combinedScope, setCombinedScope] = useState(null);

  const bumpTaskRefresh = useCallback(() => setTaskRefreshTick(t => t + 1), []);

  const loadProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('projects').select('*').order('created_at', { ascending: false });
    if (error) { alert('Erro ao carregar projetos: ' + error.message); setProjectsLoading(false); return; }
    setProjects(data);
    setProjectsLoading(false);
  }, []);

  const loadPendingCounts = useCallback(async () => {
    const { data: indicatorCols, error: colsError } = await supabase
      .from('kanban_columns').select('id, project_id').eq('is_indicator', true).is('deleted_at', null);
    if (colsError) { console.error(colsError); return; }
    if (!indicatorCols || !indicatorCols.length) { setPendingCounts({}); return; }

    const colIds = indicatorCols.map(c => c.id);
    const { data: cards, error: cardsError } = await supabase
      .from('versions').select('column_id').in('column_id', colIds).is('deleted_at', null);
    if (cardsError) { console.error(cardsError); return; }

    const colToProject = {};
    indicatorCols.forEach(c => { colToProject[c.id] = c.project_id; });

    const counts = {};
    cards.forEach(v => {
      const pid = colToProject[v.column_id];
      if (pid) counts[pid] = (counts[pid] || 0) + 1;
    });
    setPendingCounts(counts);
  }, []);

  const refreshConflicts = useCallback(async () => {
    const conflicts = await computeAllConflicts();
    const ids = new Set();
    conflicts.forEach(c => c.tasks.forEach(t => ids.add(t.projectId)));
    setResourceConflictProjectIds(ids);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    loadProjects();
    loadPendingCounts();
    refreshConflicts();
  }, [session, loadProjects, loadPendingCounts, refreshConflicts]);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  async function refreshCurrentProject() {
    if (!currentProjectId) return;
    const { data, error } = await supabase.from('projects').select('*').eq('id', currentProjectId).single();
    if (!error && data) setCurrentProject(data);
  }

  async function createDefaultColumns(projectId) {
    const defaults = [
      { name: 'Planejado', position: 0 },
      { name: 'Em andamento', position: 1 },
      { name: 'Concluído', position: 2 },
    ];
    const { error } = await supabase.from('kanban_columns').insert(
      defaults.map(c => ({ project_id: projectId, ...c }))
    );
    if (error) alert('Não foi possível criar as colunas padrão: ' + error.message);
  }

  async function selectProject(id, tab) {
    setMainView('project');
    if (id === currentProjectId) {
      if (tab) setActiveTab(tab);
      return;
    }
    setCurrentProjectId(id);
    setProjectLoading(true);
    setActiveTab(tab || 'activities');
    const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
    if (error) { alert('Erro ao carregar projeto: ' + error.message); setProjectLoading(false); return; }
    setCurrentProject(data);
    setProjectLoading(false);
  }

  function openNewProjectModal(folderId = null) {
    setProjectModalMode('new');
    setInitialFolderId(folderId || null);
    setProjectModalOpen(true);
  }

  function openEditProjectModal() {
    setProjectModalMode('edit');
    setProjectModalOpen(true);
  }

  async function handleProjectSaved(savedProject, isNew) {
    setProjectModalOpen(false);
    await loadProjects();
    if (isNew) await createDefaultColumns(savedProject.id);
    setCurrentProjectId(null);
    selectProject(savedProject.id);
  }

  async function handleProjectDeleted() {
    setProjectModalOpen(false);
    setCurrentProjectId(null);
    setCurrentProject(null);
    await loadProjects();
    await loadPendingCounts();
    await refreshConflicts();
  }

  function openGlobalSchedule() {
    setCurrentProjectId(null);
    setMainView('combinedSchedule');
    setCombinedScope({ type: 'global' });
  }

  function openFolderSchedule(folder) {
    setCurrentProjectId(null);
    setMainView('combinedSchedule');
    setCombinedScope({ type: 'folder', folderId: folder.id, folderName: folder.name });
  }

  async function handleOpenProjectFromCombined(projectId) {
    await selectProject(projectId);
    setActiveTab('schedule');
  }

  function handleSearchNavigate(target) {
    setSearchModalOpen(false);
    if (target.type === 'project') selectProject(target.projectId, target.tab);
  }

  async function handleOpenProjectFromConflicts(projectId) {
    setConflictsModalOpen(false);
    await selectProject(projectId);
    setActiveTab('schedule');
  }

  if (session === undefined) {
    return <div className="login-loading"><Spinner /></div>;
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <div className="app">
      <Sidebar
        projects={projects}
        loading={projectsLoading}
        pendingCounts={pendingCounts}
        resourceConflictProjectIds={resourceConflictProjectIds}
        currentProjectId={currentProjectId}
        onSelect={selectProject}
        onNewProject={openNewProjectModal}
        onOpenGlobalSchedule={openGlobalSchedule}
        onOpenFolderSchedule={openFolderSchedule}
        isGlobalScheduleActive={mainView === 'combinedSchedule' && combinedScope?.type === 'global'}
        activeFolderScheduleId={mainView === 'combinedSchedule' && combinedScope?.type === 'folder' ? combinedScope.folderId : null}
        onOpenSearch={() => setSearchModalOpen(true)}
        onOpenTrash={() => setTrashModalOpen(true)}
        onOpenArchived={() => setArchivedModalOpen(true)}
        onOpenResources={() => setResourcesModalOpen(true)}
        onOpenConflicts={() => setConflictsModalOpen(true)}
        userEmail={session.user.email}
        onLogout={handleLogout}
      />

      <main className="content">
        {mainView === 'combinedSchedule' && combinedScope && (
          <CombinedScheduleView scope={combinedScope} onOpenProject={handleOpenProjectFromCombined} />
        )}

        {mainView === 'project' && !currentProjectId && (
          <div className="empty-state"><p>Selecione um projeto na lateral ou crie um novo para começar.</p></div>
        )}

        {mainView === 'project' && currentProjectId && projectLoading && (
          <div className="empty-state"><Spinner /></div>
        )}

        {mainView === 'project' && currentProjectId && !projectLoading && currentProject && (
          <>
            <div className="project-header-block">
              <div className="project-header">
                <h1>{currentProject.name}</h1>
                <button className="secondary" onClick={openEditProjectModal}>📄 Resumo</button>
              </div>
              <div className="project-header-secondary-row">
                <button
                  className="secondary version-badge-btn"
                  onClick={() => setVersionModalOpen(true)}
                >
                  v{currentProject.version_major}.{currentProject.version_minor}.{currentProject.version_patch}
                </button>
              </div>
            </div>

            <div className="tabs">
              <button className={'tab-btn' + (activeTab === 'activities' ? ' active' : '')} onClick={() => setActiveTab('activities')}>Atividades</button>
              <button className={'tab-btn' + (activeTab === 'kanban' ? ' active' : '')} onClick={() => setActiveTab('kanban')}>Tarefas</button>
              <button className={'tab-btn' + (activeTab === 'schedule' ? ' active' : '')} onClick={() => setActiveTab('schedule')}>Cronograma</button>
            </div>

            <div className={'panel' + (activeTab === 'activities' ? ' active' : '')}>
              <ActivitiesTab
                projectId={currentProjectId}
                projectName={currentProject.name}
                onActivityConvertedToTask={() => setActiveTab('kanban')}
                onDataChanged={loadPendingCounts}
                onTaskCreatedElsewhere={bumpTaskRefresh}
              />
            </div>
            <div className={'panel' + (activeTab === 'kanban' ? ' active' : '')}>
              <TasksTab
                projectId={currentProjectId}
                onDataChanged={loadPendingCounts}
                refreshTick={taskRefreshTick}
                onVersionChanged={refreshCurrentProject}
                onOpenVersionModal={() => setVersionModalOpen(true)}
              />
            </div>
            <div className={'panel' + (activeTab === 'schedule' ? ' active' : '')}>
              <ScheduleTab projectId={currentProjectId} projectName={currentProject.name} onResourcesChanged={refreshConflicts} />
            </div>
          </>
        )}
      </main>

      {projectModalOpen && (
        <ProjectModal
          mode={projectModalMode}
          project={projectModalMode === 'edit' ? currentProject : null}
          initialFolderId={initialFolderId}
          onClose={() => setProjectModalOpen(false)}
          onSaved={handleProjectSaved}
          onDeleted={handleProjectDeleted}
        />
      )}

      {versionModalOpen && currentProjectId && (
        <ProjectVersionModal
          projectId={currentProjectId}
          onClose={() => { setVersionModalOpen(false); refreshCurrentProject(); }}
        />
      )}

      {searchModalOpen && (
        <GlobalSearchModal
          onClose={() => setSearchModalOpen(false)}
          onNavigate={handleSearchNavigate}
        />
      )}

      {trashModalOpen && (
        <TrashModal
          onClose={() => setTrashModalOpen(false)}
          onRestored={() => { loadPendingCounts(); refreshConflicts(); if (currentProjectId) bumpTaskRefresh(); }}
        />
      )}

      {archivedModalOpen && (
        <ArchivedProjectsModal
          projects={projects}
          onClose={() => setArchivedModalOpen(false)}
          onUnarchived={loadProjects}
        />
      )}

      {resourcesModalOpen && (
        <ResourcesModal onClose={() => { setResourcesModalOpen(false); refreshConflicts(); }} />
      )}

      {conflictsModalOpen && (
        <ConflictsModal
          onClose={() => setConflictsModalOpen(false)}
          onOpenProject={handleOpenProjectFromConflicts}
        />
      )}
    </div>
  );
}