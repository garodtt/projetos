import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../Toast';
import Spinner from '../Spinner';
import ScheduleTaskTable from './ScheduleTaskTable';
import GanttChart from './GanttChart';
import { computeEndDate, computeDateRange } from '../../utils/schedule';

const TABLE_WIDTH_STORAGE_KEY = 'cronograma_table_width';

export default function ScheduleTab({ projectId }) {
  const showToast = useToast();
  const [tasks, setTasks] = useState([]);
  const [dependencies, setDependencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('Dia');
  const [predecessorDrafts, setPredecessorDrafts] = useState({});
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());

  const [tableWidth, setTableWidth] = useState(() => {
    const saved = Number(localStorage.getItem(TABLE_WIDTH_STORAGE_KEY));
    return Number.isFinite(saved) && saved > 0 ? saved : 700;
  });
  const tableWidthRef = useRef(tableWidth);
  const wrapRef = useRef(null);

  const load = useCallback(async () => {
    const [tasksRes, depsRes] = await Promise.all([
      supabase.from('schedule_tasks').select('*').eq('project_id', projectId).order('position', { ascending: true }),
      supabase.from('schedule_dependencies').select('*'),
    ]);
    if (tasksRes.error) { alert('Erro ao carregar cronograma: ' + tasksRes.error.message); setLoading(false); return; }
    if (depsRes.error) { alert('Erro ao carregar dependências: ' + depsRes.error.message); setLoading(false); return; }
    setTasks(tasksRes.data);
    const taskIds = new Set(tasksRes.data.map(t => t.id));
    setDependencies(depsRes.data.filter(d => taskIds.has(d.task_id) && taskIds.has(d.predecessor_id)));
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

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

  async function addTask() {
    const today = new Date().toISOString().slice(0, 10);
    const position = tasks.length ? Math.max(...tasks.map(t => t.position)) + 1 : 0;
    const { error } = await supabase.from('schedule_tasks').insert({
      project_id: projectId,
      name: 'Nova tarefa',
      level: 0,
      position,
      duration_value: 1,
      duration_unit: 'dias',
      start_date: today,
      end_date: computeEndDate(today, 1, 'dias'),
    });
    if (error) { alert('Erro ao criar tarefa: ' + error.message); return; }
    load();
  }

  function handleNameChange(task, value) { updateLocalTask(task.id, { name: value }); }
  function handleNameBlur(task) { persistTask(task.id, { name: task.name }); }

  function handleDurationValueChange(task, value) {
    const newEnd = computeEndDate(task.start_date, value, task.duration_unit);
    updateLocalTask(task.id, { duration_value: value, end_date: newEnd });
  }
  function handleDurationValueBlur(task) {
    persistTask(task.id, { duration_value: task.duration_value, end_date: task.end_date });
  }

  function handleDurationUnitChange(task, unit) {
    const newEnd = computeEndDate(task.start_date, task.duration_value, unit);
    updateLocalTask(task.id, { duration_unit: unit, end_date: newEnd });
    persistTask(task.id, { duration_unit: unit, end_date: newEnd });
  }

  function handleStartDateChange(task, value) {
    const newEnd = computeEndDate(value, task.duration_value, task.duration_unit);
    updateLocalTask(task.id, { start_date: value, end_date: newEnd });
    persistTask(task.id, { start_date: value, end_date: newEnd });
  }

  function handleResourceChange(task, value) { updateLocalTask(task.id, { resource_names: value }); }
  function handleResourceBlur(task) { persistTask(task.id, { resource_names: task.resource_names }); }

  function handleColorChange(task, color) {
    updateLocalTask(task.id, { color });
    persistTask(task.id, { color });
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
    if (!confirm('Excluir esta tarefa do cronograma?')) return;
    const { error } = await supabase.from('schedule_tasks').delete().eq('id', task.id);
    if (error) { alert('Erro ao excluir: ' + error.message); return; }
    showToast('Tarefa excluída');
    load();
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

  if (loading) {
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
          <button className="primary small" onClick={addTask}>+ Nova Tarefa</button>
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
              onNameChange={handleNameChange}
              onNameBlur={handleNameBlur}
              onDurationValueChange={handleDurationValueChange}
              onDurationValueBlur={handleDurationValueBlur}
              onDurationUnitChange={handleDurationUnitChange}
              onStartDateChange={handleStartDateChange}
              onResourceChange={handleResourceChange}
              onResourceBlur={handleResourceBlur}
              onColorChange={handleColorChange}
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
          />
        </div>
      )}
    </div>
  );
}