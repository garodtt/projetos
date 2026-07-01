import { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabaseClient';
import Sidebar from './components/Sidebar';
import ProjectModal from './components/ProjectModal';
import ActivitiesTab from './components/activities/ActivitiesTab';
import TasksTab from './components/tasks/TasksTab';
import Spinner from './components/Spinner';

export default function App() {
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [currentProject, setCurrentProject] = useState(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('activities');
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectModalMode, setProjectModalMode] = useState('new');

  const loadProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('projects').select('*').order('created_at', { ascending: false });
    if (error) { alert('Erro ao carregar projetos: ' + error.message); setProjectsLoading(false); return; }
    setProjects(data);
    setProjectsLoading(false);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

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

  function openNewProjectModal() {
    setProjectModalMode('new');
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

  return (
    <div className="app">
      <Sidebar
        projects={projects}
        loading={projectsLoading}
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
            </div>

            <div className={'panel' + (activeTab === 'activities' ? ' active' : '')}>
              <ActivitiesTab projectId={currentProjectId} onActivityConvertedToTask={() => setActiveTab('kanban')} />
            </div>
            <div className={'panel' + (activeTab === 'kanban' ? ' active' : '')}>
              <TasksTab projectId={currentProjectId} />
            </div>
          </>
        )}
      </main>

      {projectModalOpen && (
        <ProjectModal
          mode={projectModalMode}
          project={projectModalMode === 'edit' ? currentProject : null}
          onClose={() => setProjectModalOpen(false)}
          onSaved={handleProjectSaved}
        />
      )}
    </div>
  );
}