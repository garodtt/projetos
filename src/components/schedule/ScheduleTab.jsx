import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../Toast';
import Spinner from '../Spinner';
import ScheduleTaskTable from './ScheduleTaskTable';
import GanttChart from './GanttChart';
import NewScheduleTaskModal from './NewScheduleTaskModal';
import TaskResourcesModal from './TaskResourcesModal';
import HolidaySettingsModal from './HolidaySettingsModal';
import { computeDateRange, addDaysToDate, daysBetweenDates, hasCircularDependency, parsePredecessorTokens, formatPredecessorToken } from '../../utils/schedule';
import { formatDate } from '../../utils/format';
import { computeEndDateWithCalendar, fetchScheduleCalendar, resolveBusinessDayChoice, snapToNextBusinessDay } from '../../utils/businessDays';
import { checkConflictsForTaskDateChange } from '../../utils/resources';
import { exportSchedulePdf } from '../../utils/exportPdf';

const TABLE_WIDTH_STORAGE_KEY = 'cronograma_table_width';

export default function ScheduleTab({ projectId, projectName, onResourcesChanged }) {
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
      const tokens = dependencies
        .filter(d => d.task_id === t.id)
        .map(d => ({ num: displayNumberByTaskId[d.predecessor_id], lag: d.lag_days || 0 }))
        .filter(x => x.num)
        .sort((a, b) => a.num - b.num)
        .map(x => formatPredecessorToken(x.num, x.lag));
      map[t.id] = tokens.join(', ');
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

    const initialDelta = daysBetweenDates(oldEndDate, rootSelfChanges.end_date);
    if (initialDelta === 0) return updates;

    // 1. Descobre todas as tarefas alcançáveis a partir da raiz seguindo
    //    "quem depende de quem" — só essas são candidatas a mudar.
    const affected = new Set();
    {
      const queue = [rootTaskId];
      while (queue.length) {
        const currentId = queue.shift();
        dependencies
          .filter(d => d.predecessor_id === currentId)
          .forEach(d => {
            if (d.task_id !== rootTaskId && !affected.has(d.task_id)) {
              affected.add(d.task_id);
              queue.push(d.task_id);
            }
          });
      }
    }
    if (!affected.size) return updates;

    // 2. Pra cada tarefa afetada, guarda só as predecessoras que também
    //    mudaram nessa rodada (a raiz ou outra tarefa afetada) — as demais
    //    não contribuem porque não se moveram.
    const relevantPredsOf = new Map();
    affected.forEach(id => {
      const preds = dependencies
        .filter(d => d.task_id === id && (d.predecessor_id === rootTaskId || affected.has(d.predecessor_id)))
        .map(d => ({ id: d.predecessor_id, lag: d.lag_days || 0 }));
      relevantPredsOf.set(id, preds);
    });

    // 3. Ordena topologicamente o subconjunto afetado (Kahn), pra processar
    //    cada tarefa só depois de todas as predecessoras relevantes dela —
    //    isso é o que permite, no passo 4, olhar o resultado JÁ ATUALIZADO
    //    de cada predecessora quando ela também mudou nesta cascata.
    const inDegree = new Map();
    affected.forEach(id => {
      const preds = relevantPredsOf.get(id) || [];
      inDegree.set(id, preds.filter(p => affected.has(p.id)).length);
    });
    const ready = Array.from(affected).filter(id => inDegree.get(id) === 0);
    const order = [];
    const done = new Set();
    while (ready.length) {
      const id = ready.shift();
      if (done.has(id)) continue;
      done.add(id);
      order.push(id);
      dependencies
        .filter(d => d.predecessor_id === id && affected.has(d.task_id))
        .forEach(d => {
          const remaining = inDegree.get(d.task_id) - 1;
          inDegree.set(d.task_id, remaining);
          if (remaining === 0) ready.push(d.task_id);
        });
    }
    // Se sobrar algo (só aconteceria com um ciclo, já bloqueado ao salvar
    // predecessoras), fica de fora com segurança — não trava nada.

    // 4. Processa em ordem: pra cada tarefa, calcula o início exigido por
    //    CADA predecessora relevante (fim dela + atraso configurado) e usa
    //    o maior entre eles. Só empurra pra frente — nunca antecipa uma
    //    tarefa que já começava com folga (folga "por acaso" pode encolher;
    //    atraso configurado explicitamente sempre é respeitado).
    order.forEach(id => {
      const succTask = taskById.get(id);
      if (!succTask) return;
      const base = updates.get(id) || succTask;
      const preds = relevantPredsOf.get(id) || [];

      let latestRequiredStart = null;
      preds.forEach(p => {
        const predTask = taskById.get(p.id);
        const predState = p.id === rootTaskId ? rootSelfChanges : (updates.get(p.id) || predTask);
        const predEnd = predState?.end_date;
        if (!predEnd) return;
        const required = addDaysToDate(predEnd, p.lag);
        if (latestRequiredStart === null || required > latestRequiredStart) latestRequiredStart = required;
      });
      if (latestRequiredStart === null || latestRequiredStart <= base.start_date) return;

      const shiftedStart = snapToNextBusinessDay(latestRequiredStart, calendar);
      const shiftedEnd = computeEndDateWithCalendar(shiftedStart, succTask.duration_value, succTask.duration_unit, calendar);
      if (shiftedStart === base.start_date && shiftedEnd === base.end_date) return;
      updates.set(id, { start_date: shiftedStart, end_date: shiftedEnd });
    });

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
    const finalValue = resolveBusinessDayChoice(value, calendar);
    const newEnd = computeEndDateWithCalendar(finalValue, task.duration_value, task.duration_unit, calendar);
    commitTaskDatesWithCascade(task.id, { start_date: finalValue, end_date: newEnd }, task.end_date);
  }

  function handleColorChange(task, color) {
    updateLocalTask(task.id, { color });
    persistTask(task.id, { color });
  }

  function handleProgressChange(task, value) {
    const clamped = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    updateLocalTask(task.id, { progress_percent: clamped });
    persistTask(task.id, { progress_percent: clamped });
  }

  function handleActualStartChange(task, value) {
    const newValue = value || null;
    if (newValue && task.actual_end_date && newValue > task.actual_end_date) {
      alert('A data real de início (' + formatDate(newValue) + ') não pode ser depois da data real de término já registrada (' + formatDate(task.actual_end_date) + ').');
      return;
    }
    updateLocalTask(task.id, { actual_start_date: newValue });
    persistTask(task.id, { actual_start_date: newValue });
  }
  function handleActualEndChange(task, value) {
    const newValue = value || null;
    if (newValue && task.actual_start_date && newValue < task.actual_start_date) {
      alert('A data real de término (' + formatDate(newValue) + ') não pode ser antes da data real de início já registrada (' + formatDate(task.actual_start_date) + ').');
      return;
    }
    updateLocalTask(task.id, { actual_end_date: newValue });
    persistTask(task.id, { actual_end_date: newValue });
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
    const { parsed, invalid } = parsePredecessorTokens(text);
    const validEntries = [];
    parsed.forEach(({ displayNumber, lag }) => {
      const id = taskIdByDisplayNumber[displayNumber];
      if (id && id !== task.id) validEntries.push({ id, lag });
      else invalid.push(String(displayNumber));
    });
    if (invalid.length) {
      alert('Predecessora(s) inválida(s): ' + invalid.join(', ') + '. Use o ID mostrado na primeira coluna, com atraso opcional (ex: 3+2 ou 3-1).');
    }

    const validIds = validEntries.map(e => e.id);

    // Item 3 (5 tópicos anteriores) — não deixa criar dependência circular.
    if (hasCircularDependency(task.id, validIds, dependencies)) {
      alert('Essa combinação criaria uma dependência circular (uma tarefa não pode depender, direta ou indiretamente, dela mesma). Nenhuma predecessora foi salva — ajuste os números e tente de novo.');
      setPredecessorDrafts(prev => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
      return;
    }

    // Item 2 (5 tópicos anteriores) — agora considerando o atraso/antecedência
    // configurado em cada predecessora, não só o término dela.
    const violating = validEntries
      .map(e => ({ pred: tasks.find(t => t.id === e.id), lag: e.lag }))
      .filter(v => v.pred)
      .map(v => ({ ...v, requiredStart: addDaysToDate(v.pred.end_date, v.lag) }))
      .filter(v => v.requiredStart > task.start_date);

    if (violating.length) {
      const latestRequired = violating.reduce((max, v) => (v.requiredStart > max ? v.requiredStart : max), violating[0].requiredStart);
      const proceed = confirm(
        `"${task.name}" começa em ${formatDate(task.start_date)}, antes do que ${violating.length > 1 ? 'exigem as predecessoras' : 'exige a predecessora'} que você está vinculando, considerando o atraso configurado (a mais tardia exige início em ${formatDate(latestRequired)}).\n\n` +
        `Mover o início de "${task.name}" para ${formatDate(latestRequired)}?`
      );
      if (proceed) {
        const newEnd = computeEndDateWithCalendar(latestRequired, task.duration_value, task.duration_unit, calendar);
        await commitTaskDatesWithCascade(task.id, { start_date: latestRequired, end_date: newEnd }, task.end_date);
      }
    }

    await supabase.from('schedule_dependencies').delete().eq('task_id', task.id);
    if (validEntries.length) {
      const rows = validEntries.map(e => ({ task_id: task.id, predecessor_id: e.id, lag_days: e.lag }));
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

  function handleExportPdf() {
    exportSchedulePdf(projectName, tasks, displayNumberByTaskId, predecessorsTextByTaskId);
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
          <button type="button" className="secondary small" onClick={handleExportPdf}>📄 Exportar PDF</button>
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
              onProgressChange={handleProgressChange}
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
          onSaved={() => { refreshCalendar(); load(); }}
        />
      )}
    </div>
  );
}