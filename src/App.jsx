import { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabaseClient';
import Sidebar from './components/Sidebar';
import ProjectModal from './components/ProjectModal';
import ActivitiesTab from './components/activities/ActivitiesTab';
import TasksTab from './components/tasks/TasksTab';
import ScheduleTab from './components/schedule/ScheduleTab';
import Spinner from './components/Spinner';

export default function App() {
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [pendingCounts, setPendingCounts] = useState({});
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [currentProject, setCurrentProject] = useState(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('activities');
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectModalMode, setProjectModalMode] = useState('new');
  const [initialFolderId, setInitialFolderId] = useState(null);
  const [taskRefreshTick, setTaskRefreshTick] = useState(0);

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
      .from('kanban_columns').select('id, project_id').eq('is_indicator', true);
    if (colsError) { console.error(colsError); return; }
    if (!indicatorCols || !indicatorCols.length) { setPendingCounts({}); return; }

    const colIds = indicatorCols.map(c => c.id);
    const { data: cards, error: cardsError } = await supabase
      .from('versions').select('column_id').in('column_id', colIds);
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

  useEffect(() => {
    loadProjects();
    loadPendingCounts();
  }, [loadProjects, loadPendingCounts]);

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

  async function selectProject(id) {
    if (id === currentProjectId) return;
    setCurrentProjectId(id);
    setProjectLoading(true);
    setActiveTab('activities');
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
  }

  return (
    <div className="app">
      <Sidebar
        projects={projects}
        loading={projectsLoading}
        pendingCounts={pendingCounts}
        currentProjectId={currentProjectId}
        onSelect={selectProject}
        onNewProject={openNewProjectModal}
      />

      <main className="content">
        {!currentProjectId && (
          <div className="empty-state"><p>Selecione um projeto na lateral ou crie um novo para começar.</p></div>
        )}

        {currentProjectId && projectLoading && (
          <div className="empty-state"><Spinner /></div>
        )}

        {currentProjectId && !projectLoading && currentProject && (
          <>
            <div className="project-header">
              <h1>{currentProject.name}</h1>
              <button className="secondary" onClick={openEditProjectModal}>📄 Resumo</button>
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
              <TasksTab projectId={currentProjectId} onDataChanged={loadPendingCounts} refreshTick={taskRefreshTick} />
            </div>
            <div className={'panel' + (activeTab === 'schedule' ? ' active' : '')}>
              <ScheduleTab projectId={currentProjectId} />
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
    </div>
  );
}