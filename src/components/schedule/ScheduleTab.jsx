import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../Toast';
import Spinner from '../Spinner';
import ScheduleTaskTable from './ScheduleTaskTable';
import GanttChart from './GanttChart';
import NewScheduleTaskModal from './NewScheduleTaskModal';
import TaskResourcesModal from './TaskResourcesModal';
import HolidaySettingsModal from './HolidaySettingsModal';
import { computeDateRange, addDaysToDate, daysBetweenDates } from '../../utils/schedule';
import { formatDate } from '../../utils/format';
import { computeEndDateWithCalendar, fetchScheduleCalendar, snapToNextBusinessDay } from '../../utils/businessDays';
import { checkConflictsForTaskDateChange } from '../../utils/resources';

const TABLE_WIDTH_STORAGE_KEY = 'cronograma_table_width';

export default function ScheduleTab({ projectId, onResourcesChanged }) {
  const showToast = useToast();
  const [tasks, setTasks] = useState([]);
  const [dependencies, setDependencies] = useState([]);
  const [resourceSummaryByTaskId, setResourceSummaryByTaskId] = useState({});
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('Dia');
  const [showActual, setShowActual] = useState(false);
  const [predecessorDrafts, setPredecessorDrafts] = useState({});
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const [newTaskModalOpen, setNewTaskModalOpen] = useState(false);
  const [resourcesModalTask, setResourcesModalTask] = useState(null);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const durationEditOriginalEnd = useRef({});

  const [tableWidth, setTableWidth] = useState(() => {
    const saved = Number(localStorage.getItem(TABLE_WIDTH_STORAGE_KEY));
    return Number.isFinite(saved) && saved > 0 ? saved : 700;
  });
  const tableWidthRef = useRef(tableWidth);
  const wrapRef = useRef(null);

  const load = useCallback(async () => {
    const [tasksRes, depsRes, calendarData] = await Promise.all([
      supabase.from('schedule_tasks').select('*').eq('project_id', projectId).is('deleted_at', null).order('position', { ascending: true }),
      supabase.from('schedule_dependencies').select('*'),
      fetchScheduleCalendar(),
    ]);
    if (tasksRes.error) { alert('Erro ao carregar cronograma: ' + tasksRes.error.message); setLoading(false); return; }
    if (depsRes.error) { alert('Erro ao carregar dependências: ' + depsRes.error.message); setLoading(false); return; }
    setTasks(tasksRes.data);
    setCalendar(calendarData);
    const taskIds = new Set(tasksRes.data.map(t => t.id));
    setDependencies(depsRes.data.filter(d => taskIds.has(d.task_id) && taskIds.has(d.predecessor_id)));

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
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function refreshCalendar() {
    const data = await fetchScheduleCalendar();
    setCalendar(data);
  }

  const displayNumberByTaskId = useMemo(() => {
    const map = {};
    tasks.forEach((t, idx) => { map[t.id] = idx + 1; });
    return map;
  }, [tasks]);

  const taskIdByDisplayNumber = useMemo(() => {
    const map = {};
    tasks.forEach((t, idx) => { map[idx + 1] = t.id; });
    return map;
  }, [tasks]);

  const predecessorsTextByTaskId = useMemo(() => {
    const map = {};
    tasks.forEach(t => {
      const nums = dependencies
        .filter(d => d.task_id === t.id)
        .map(d => displayNumberByTaskId[d.predecessor_id])
        .filter(Boolean)
        .sort((a, b) => a - b);
      map[t.id] = nums.join(', ');
    });
    return map;
  }, [tasks, dependencies, displayNumberByTaskId]);

  const hasChildrenByTaskId = useMemo(() => {
    const map = {};
    tasks.forEach((t, idx) => {
      const next = tasks[idx + 1];
      map[t.id] = Boolean(next && next.level > t.level);
    });
    return map;
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    const result = [];
    let skipUntilLevel = null;
    for (const t of tasks) {
      if (skipUntilLevel !== null) {
        if (t.level > skipUntilLevel) continue;
        skipUntilLevel = null;
      }
      result.push(t);
      if (collapsedIds.has(t.id)) skipUntilLevel = t.level;
    }
    return result;
  }, [tasks, collapsedIds]);

  const { rangeStart, totalDays } = useMemo(() => computeDateRange(tasks), [tasks]);

  function toggleCollapse(taskId) {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function handleDividerPointerDown(e) {
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startWidth = tableWidth;
    const containerWidth = wrapRef.current ? wrapRef.current.getBoundingClientRect().width : 1200;
    const minWidth = 240;
    const maxWidth = Math.max(minWidth, containerWidth - 200);

    function onMove(moveEvt) {
      const dx = moveEvt.clientX - startX;
      const next = Math.min(maxWidth, Math.max(minWidth, startWidth + dx));
      tableWidthRef.current = next;
      setTableWidth(next);
    }
    function onUp() {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      localStorage.setItem(TABLE_WIDTH_STORAGE_KEY, String(tableWidthRef.current));
    }
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  }

  function updateLocalTask(taskId, changes) {
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, ...changes } : t)));
  }

  async function persistTask(taskId, changes) {
    const { error } = await supabase
      .from('schedule_tasks')
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq('id', taskId);
    if (error) { alert('Erro ao salvar: ' + error.message); load(); }
  }

  function computeCascadeUpdates(rootTaskId, rootSelfChanges, oldEndDate) {
    const taskById = new Map(tasks.map(t => [t.id, t]));
    const updates = new Map();
    updates.set(rootTaskId, rootSelfChanges);

    const newEndDate = rootSelfChanges.end_date;
    const delta = daysBetweenDates(oldEndDate, newEndDate);

    if (delta !== 0) {
      const visited = new Set([rootTaskId]);
      const queue = [rootTaskId];
      while (queue.length) {
        const currentId = queue.shift();
        const successorIds = dependencies
          .filter(d => d.predecessor_id === currentId)
          .map(d => d.task_id);
        for (const succId of successorIds) {
          if (visited.has(succId)) continue;
          visited.add(succId);
          const succTask = taskById.get(succId);
          if (!succTask) continue;
          const base = updates.get(succId) || succTask;
          const shiftedStart = addDaysToDate(base.start_date, delta);
          const shiftedEnd = addDaysToDate(base.end_date, delta);
          updates.set(succId, { start_date: shiftedStart, end_date: shiftedEnd });
          queue.push(succId);
        }
      }
    }
    return updates;
  }

  async function commitTaskDatesWithCascade(taskId, selfChanges, oldEndDate) {
    const updates = computeCascadeUpdates(taskId, selfChanges, oldEndDate);

    setTasks(prev => prev.map(t => (updates.has(t.id) ? { ...t, ...updates.get(t.id) } : t)));

    const entries = Array.from(updates.entries());
    const results = await Promise.all(entries.map(([id, changes]) =>
      supabase.from('schedule_tasks').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', id)
    ));
    const failed = results.find(r => r.error);
    if (failed) { alert('Erro ao salvar datas: ' + failed.error.message); load(); return; }

    if (entries.length > 1) {
      showToast('Datas ajustadas em ' + (entries.length - 1) + ' tarefa(s) dependente(s)');
    }

    // As datas já foram salvas acima — relemos do banco dentro da checagem,
    // então não precisa (e não deve) passar nenhum valor local aqui.
    const conflictChecks = await Promise.all(entries.map(([id]) => checkConflictsForTaskDateChange(id)));
    const allConflicts = conflictChecks.flat();
    if (allConflicts.length) {
      const seen = new Set();
      const lines = [];
      allConflicts.forEach(c => {
        const key = c.resourceName + '|' + c.projectName + '|' + c.taskName;
        if (seen.has(key)) return;
        seen.add(key);
        lines.push(`${c.resourceName}: ${c.projectName} / ${c.taskName} (${c.existingHours}h) — total ${c.total}h de ${c.capacity}h`);
      });
      alert('Aviso de conflito de recurso após a mudança de data:\n\n' + lines.join('\n'));
    }
    onResourcesChanged?.();
  }

  function handleNameChange(task, value) { updateLocalTask(task.id, { name: value }); }
  function handleNameBlur(task) { persistTask(task.id, { name: task.name }); }

  function handleDurationValueChange(task, value) {
    if (!(task.id in durationEditOriginalEnd.current)) {
      durationEditOriginalEnd.current[task.id] = task.end_date;
    }
    const newEnd = computeEndDateWithCalendar(task.start_date, value, task.duration_unit, calendar);
    updateLocalTask(task.id, { duration_value: value, end_date: newEnd });
  }
  function handleDurationValueBlur(task) {
    const oldEnd = durationEditOriginalEnd.current[task.id] ?? task.end_date;
    delete durationEditOriginalEnd.current[task.id];
    commitTaskDatesWithCascade(task.id, { duration_value: task.duration_value, end_date: task.end_date }, oldEnd);
  }

  function handleDurationUnitChange(task, unit) {
    const newEnd = computeEndDateWithCalendar(task.start_date, task.duration_value, unit, calendar);
    commitTaskDatesWithCascade(task.id, { duration_unit: unit, end_date: newEnd }, task.end_date);
  }

  function handleStartDateChange(task, value) {
    const snapped = snapToNextBusinessDay(value, calendar);
    if (snapped !== value) {
      showToast('Início ajustado para o próximo dia útil (' + formatDate(snapped) + ')');
    }
    const newEnd = computeEndDateWithCalendar(snapped, task.duration_value, task.duration_unit, calendar);
    commitTaskDatesWithCascade(task.id, { start_date: snapped, end_date: newEnd }, task.end_date);
  }

  function handleColorChange(task, color) {
    updateLocalTask(task.id, { color });
    persistTask(task.id, { color });
  }

  function handleActualStartChange(task, value) {
    updateLocalTask(task.id, { actual_start_date: value || null });
    persistTask(task.id, { actual_start_date: value || null });
  }
  function handleActualEndChange(task, value) {
    updateLocalTask(task.id, { actual_end_date: value || null });
    persistTask(task.id, { actual_end_date: value || null });
  }

  async function indentTask(task) {
    updateLocalTask(task.id, { level: task.level + 1 });
    await persistTask(task.id, { level: task.level + 1 });
  }
  async function outdentTask(task) {
    if (task.level <= 0) return;
    updateLocalTask(task.id, { level: task.level - 1 });
    await persistTask(task.id, { level: task.level - 1 });
  }

  async function moveTask(task, direction) {
    const idx = tasks.findIndex(t => t.id === task.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= tasks.length) return;
    const other = tasks[swapIdx];
    const [r1, r2] = await Promise.all([
      supabase.from('schedule_tasks').update({ position: other.position }).eq('id', task.id),
      supabase.from('schedule_tasks').update({ position: task.position }).eq('id', other.id),
    ]);
    if (r1.error || r2.error) { alert('Erro ao reordenar: ' + (r1.error || r2.error).message); return; }
    load();
  }

  async function deleteTask(task) {
    const { error } = await supabase.from('schedule_tasks').update({ deleted_at: new Date().toISOString() }).eq('id', task.id);
    if (error) { alert('Erro ao excluir: ' + error.message); return; }
    showToast('Tarefa excluída', {
      actionLabel: 'Desfazer',
      onAction: async () => {
        await supabase.from('schedule_tasks').update({ deleted_at: null }).eq('id', task.id);
        load();
      },
    });
    load();
    onResourcesChanged?.();
  }

  function handlePredecessorsInputChange(taskId, text) {
    setPredecessorDrafts(prev => ({ ...prev, [taskId]: text }));
  }

  async function savePredecessors(task) {
    const text = predecessorDrafts[task.id];
    if (text === undefined) return;
    const numbers = text.split(',').map(s => s.trim()).filter(Boolean).map(Number);
    const validIds = [];
    const invalid = [];
    numbers.forEach(n => {
      const id = taskIdByDisplayNumber[n];
      if (id && id !== task.id) validIds.push(id);
      else invalid.push(n);
    });
    if (invalid.length) {
      alert('Número(s) inválido(s) de predecessora: ' + invalid.join(', ') + '. Use o ID mostrado na primeira coluna.');
    }

    await supabase.from('schedule_dependencies').delete().eq('task_id', task.id);
    if (validIds.length) {
      const rows = validIds.map(pid => ({ task_id: task.id, predecessor_id: pid }));
      const { error } = await supabase.from('schedule_dependencies').insert(rows);
      if (error) alert('Erro ao salvar predecessoras: ' + error.message);
    }
    setPredecessorDrafts(prev => {
      const next = { ...prev };
      delete next[task.id];
      return next;
    });
    load();
  }

  function handleTaskCreated() {
    setNewTaskModalOpen(false);
    load();
    onResourcesChanged?.();
  }

  function handleResourcesSaved() {
    setResourcesModalTask(null);
    load();
    onResourcesChanged?.();
  }

  if (loading || !calendar) {
    return (
      <div>
        <div className="section-header"><h3>Cronograma</h3></div>
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <div className="section-header">
        <h3>Cronograma</h3>
        <div className="section-header-buttons">
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
          <button
            type="button"
            className={'secondary small' + (showActual ? ' active-toggle' : '')}
            onClick={() => setShowActual(v => !v)}
          >
            📊 Datas reais
          </button>
          <button type="button" className="secondary small" onClick={() => setCalendarModalOpen(true)}>📅 Calendário</button>
          <button className="primary small" onClick={() => setNewTaskModalOpen(true)}>+ Nova Tarefa</button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <p className="empty-state">Nenhuma tarefa no cronograma ainda. Clique em + Nova Tarefa.</p>
      ) : (
        <div className="gantt-unified-wrap" ref={wrapRef}>
          <div className="gantt-unified-table-pane" style={{ width: tableWidth }}>
            <ScheduleTaskTable
              tasks={visibleTasks}
              displayNumberByTaskId={displayNumberByTaskId}
              hasChildrenByTaskId={hasChildrenByTaskId}
              collapsedIds={collapsedIds}
              onToggleCollapse={toggleCollapse}
              predecessorDrafts={predecessorDrafts}
              predecessorsTextByTaskId={predecessorsTextByTaskId}
              resourceSummaryByTaskId={resourceSummaryByTaskId}
              showActual={showActual}
              onNameChange={handleNameChange}
              onNameBlur={handleNameBlur}
              onDurationValueChange={handleDurationValueChange}
              onDurationValueBlur={handleDurationValueBlur}
              onDurationUnitChange={handleDurationUnitChange}
              onStartDateChange={handleStartDateChange}
              onColorChange={handleColorChange}
              onEditResources={setResourcesModalTask}
              onActualStartChange={handleActualStartChange}
              onActualEndChange={handleActualEndChange}
              onIndent={indentTask}
              onOutdent={outdentTask}
              onMoveUp={t => moveTask(t, 'up')}
              onMoveDown={t => moveTask(t, 'down')}
              onDelete={deleteTask}
              onPredecessorsInputChange={handlePredecessorsInputChange}
              onPredecessorsBlur={savePredecessors}
            />
          </div>

          <div
            className="gantt-resize-handle"
            onPointerDown={handleDividerPointerDown}
            title="Arraste para redimensionar"
          >
            <span className="gantt-resize-handle-grip" />
          </div>

          <GanttChart
            tasks={visibleTasks}
            dependencies={dependencies}
            viewMode={viewMode}
            rangeStart={rangeStart}
            totalDays={totalDays}
            calendar={calendar}
            showActual={showActual}
          />
        </div>
      )}

      {newTaskModalOpen && (
        <NewScheduleTaskModal
          projectId={projectId}
          nextPosition={tasks.length ? Math.max(...tasks.map(t => t.position)) + 1 : 0}
          calendar={calendar}
          onClose={() => setNewTaskModalOpen(false)}
          onCreated={handleTaskCreated}
        />
      )}

      {resourcesModalTask && (
        <TaskResourcesModal
          task={resourcesModalTask}
          onClose={() => setResourcesModalTask(null)}
          onSaved={handleResourcesSaved}
        />
      )}

      {calendarModalOpen && (
        <HolidaySettingsModal
          onClose={() => setCalendarModalOpen(false)}
          onSaved={refreshCalendar}
        />
      )}
    </div>
  );
}