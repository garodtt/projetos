import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import GanttChart from './GanttChart';
import CombinedScheduleTable from './CombinedScheduleTable';
import Spinner from '../Spinner';
import { computeDateRange } from '../../utils/schedule';
import { fetchScheduleCalendar } from '../../utils/businessDays';

const PROJECT_COLOR_PALETTE = ['#60a5fa', '#34d399', '#f97316', '#a78bfa', '#f472b6', '#facc15', '#22d3ee', '#fb7185'];

export default function CombinedScheduleView({ scope, onOpenProject }) {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [dependencies, setDependencies] = useState([]);
  const [resourceSummaryByTaskId, setResourceSummaryByTaskId] = useState({});
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('Dia');
  const [hiddenProjectIds, setHiddenProjectIds] = useState(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('projects').select('id, name, folder_id').order('created_at', { ascending: true });
    if (scope.type === 'folder') query = query.eq('folder_id', scope.folderId);
    const [{ data: projectsData, error: projErr }, calendarData] = await Promise.all([
      query,
      fetchScheduleCalendar(),
    ]);
    if (projErr) { alert('Erro ao carregar projetos: ' + projErr.message); setLoading(false); return; }
    setCalendar(calendarData);

    const projectIds = projectsData.map(p => p.id);
    if (!projectIds.length) {
      setProjects([]); setTasks([]); setDependencies([]); setLoading(false);
      return;
    }

    const [tasksRes, depsRes] = await Promise.all([
      supabase.from('schedule_tasks').select('*').in('project_id', projectIds).is('deleted_at', null).order('position', { ascending: true }),
      supabase.from('schedule_dependencies').select('*'),
    ]);
    if (tasksRes.error) { alert('Erro ao carregar cronogramas: ' + tasksRes.error.message); setLoading(false); return; }

    const taskIds = new Set(tasksRes.data.map(t => t.id));
    setProjects(projectsData);
    setTasks(tasksRes.data);
    setDependencies((depsRes.data || []).filter(d => taskIds.has(d.task_id) && taskIds.has(d.predecessor_id)));

    if (tasksRes.data.length) {
      const { data: resRows, error: resError } = await supabase
        .from('schedule_task_resources').select('task_id, hours_per_day, resources(name)')
        .in('task_id', tasksRes.data.map(t => t.id));
      if (!resError) {
        const summary = {};
        (resRows || []).forEach(r => {
          const label = (r.resources?.name || '(recurso)') + ' (' + r.hours_per_day + 'h)';
          summary[r.task_id] = summary[r.task_id] ? summary[r.task_id] + ', ' + label : label;
        });
        setResourceSummaryByTaskId(summary);
      }
    } else {
      setResourceSummaryByTaskId({});
    }

    setLoading(false);
  }, [scope.type, scope.folderId]);

  useEffect(() => { load(); }, [load]);

  const projectColorById = useMemo(() => {
    const map = {};
    projects.forEach((p, idx) => { map[p.id] = PROJECT_COLOR_PALETTE[idx % PROJECT_COLOR_PALETTE.length]; });
    return map;
  }, [projects]);

  const projectNameById = useMemo(() => {
    const map = {};
    projects.forEach(p => { map[p.id] = p.name; });
    return map;
  }, [projects]);

  const projectOrderIndex = useMemo(() => {
    const map = {};
    projects.forEach((p, idx) => { map[p.id] = idx; });
    return map;
  }, [projects]);

  const taskNameById = useMemo(() => {
    const map = {};
    tasks.forEach(t => { map[t.id] = t.name; });
    return map;
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    return tasks
      .filter(t => !hiddenProjectIds.has(t.project_id))
      .slice()
      .sort((a, b) => {
        const pa = projectOrderIndex[a.project_id] ?? 0;
        const pb = projectOrderIndex[b.project_id] ?? 0;
        if (pa !== pb) return pa - pb;
        return (a.position ?? 0) - (b.position ?? 0);
      })
      .map(t => ({
        ...t,
        color: t.color || projectColorById[t.project_id],
        predecessorNames: dependencies
          .filter(d => d.task_id === t.id)
          .map(d => taskNameById[d.predecessor_id])
          .filter(Boolean),
      }));
  }, [tasks, hiddenProjectIds, projectOrderIndex, projectColorById, dependencies, taskNameById]);

  const visibleDependencies = useMemo(() => {
    const visibleIds = new Set(visibleTasks.map(t => t.id));
    return dependencies.filter(d => visibleIds.has(d.task_id) && visibleIds.has(d.predecessor_id));
  }, [dependencies, visibleTasks]);

  const { rangeStart, totalDays } = useMemo(() => computeDateRange(visibleTasks), [visibleTasks]);

  function toggleProjectVisibility(projectId) {
    setHiddenProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId); else next.add(projectId);
      return next;
    });
  }

  const title = scope.type === 'folder' ? 'Cronograma da pasta: ' + scope.folderName : 'Cronograma Geral';

  if (loading || !calendar) {
    return (
      <div>
        <div className="project-header"><h1>{title}</h1></div>
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <div className="project-header">
        <h1>{title}</h1>
      </div>

      {projects.length === 0 ? (
        <p className="empty-state">Nenhum projeto encontrado{scope.type === 'folder' ? ' nesta pasta' : ''}.</p>
      ) : (
        <>
          <div className="section-header">
            <div className="project-filter-chips">
              {projects.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className={'project-chip' + (hiddenProjectIds.has(p.id) ? ' is-hidden' : '')}
                  style={{ borderColor: projectColorById[p.id] }}
                  onClick={() => toggleProjectVisibility(p.id)}
                >
                  <span className="project-chip-dot" style={{ background: projectColorById[p.id] }} />
                  {p.name}
                </button>
              ))}
            </div>
            <div className="view-mode-toggle">
              {['Dia', 'Semana', 'Mês'].map(mode => (
                <button
                  key={mode}
                  type="button"
                  className={'secondary small' + (viewMode === mode ? ' active-toggle' : '')}
                  onClick={() => setViewMode(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {visibleTasks.length === 0 ? (
            <p className="empty-state">Nenhuma tarefa de cronograma nos projetos visíveis.</p>
          ) : (
            <div className="gantt-unified-wrap">
              <div className="gantt-unified-table-pane combined-table-pane">
                <CombinedScheduleTable
                  tasks={visibleTasks}
                  projectColorById={projectColorById}
                  projectNameById={projectNameById}
                  resourceSummaryByTaskId={resourceSummaryByTaskId}
                  onRowClick={onOpenProject}
                />
              </div>
              <GanttChart
                tasks={visibleTasks}
                dependencies={visibleDependencies}
                viewMode={viewMode}
                rangeStart={rangeStart}
                totalDays={totalDays}
                calendar={calendar}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}