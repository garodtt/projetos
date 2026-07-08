import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../Toast';
import ResourcePicker from '../ResourcePicker';
import { computeEndDateWithCalendar } from '../../utils/businessDays';
import { findConflictsForAssignment } from '../../utils/resources';

const DURATION_UNITS = [
  { value: 'horas', label: 'Horas' },
  { value: 'dias', label: 'Dias' },
  { value: 'semanas', label: 'Semanas' },
];

function buildConflictLines(allConflicts) {
  const grouped = {};
  allConflicts.forEach(c => {
    if (!grouped[c.resourceName]) grouped[c.resourceName] = { total: c.total, capacity: c.capacity, items: [] };
    grouped[c.resourceName].items.push(`${c.projectName} / ${c.taskName} (${c.existingHours}h)`);
  });
  return Object.entries(grouped).map(([name, g]) => `${name}: ${g.items.join(', ')} + esta nova = ${g.total}h de ${g.capacity}h`);
}

export default function NewScheduleTaskModal({ projectId, nextPosition, calendar, onClose, onCreated }) {
  const showToast = useToast();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [durationValue, setDurationValue] = useState(1);
  const [durationUnit, setDurationUnit] = useState('dias');
  const [assignments, setAssignments] = useState([]);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    const finalName = name.trim() || 'Nova tarefa';
    if (!assignments.length) { alert('Selecione ao menos um recurso.'); return; }

    setSaving(true);
    const endDate = computeEndDateWithCalendar(startDate, durationValue, durationUnit, calendar);
    const conflictChecks = await Promise.all(
      assignments.map(a => findConflictsForAssignment(a.resource_id, startDate, endDate, a.hours_per_day, null))
    );
    const allConflicts = conflictChecks.flat();
    if (allConflicts.length) {
      const lines = buildConflictLines(allConflicts);
      const proceed = confirm('Aviso de conflito de recurso:\n\n' + lines.join('\n') + '\n\nCriar tarefa mesmo assim?');
      if (!proceed) { setSaving(false); return; }
    }

    const { data: task, error } = await supabase.from('schedule_tasks').insert({
      project_id: projectId, name: finalName, level: 0, position: nextPosition,
      duration_value: durationValue, duration_unit: durationUnit,
      start_date: startDate, end_date: endDate,
    }).select().single();
    if (error) { setSaving(false); alert('Erro ao criar tarefa: ' + error.message); return; }

    const rows = assignments.map(a => ({ task_id: task.id, resource_id: a.resource_id, hours_per_day: a.hours_per_day }));
    const { error: resError } = await supabase.from('schedule_task_resources').insert(rows);
    if (resError) { setSaving(false); alert('Tarefa criada, mas houve um erro ao salvar os recursos: ' + resError.message); }

    setSaving(false);
    showToast('Tarefa criada');
    onCreated();
  }

  return (
    <div className="overlay">
      <div className="modal">
        <h3>Nova tarefa</h3>
        <label>Nome da tarefa</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da tarefa" />
        <div className="row">
          <div>
            <label>Início</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label>Duração</label>
            <div className="schedule-duration-cell">
              <input type="number" min="0" step="0.5" value={durationValue} onChange={e => setDurationValue(e.target.value)} />
              <select value={durationUnit} onChange={e => setDurationUnit(e.target.value)}>
                {DURATION_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          </div>
        </div>
        <label>Recursos (obrigatório)</label>
        <ResourcePicker
          assignments={assignments}
          onChange={setAssignments}
          minRequired={0}
          taskDurationUnit={durationUnit}
          taskDurationValue={durationValue}
        />

        <div className="actions">
          <button className="secondary" onClick={onClose}>Cancelar</button>
          <button className="primary" disabled={saving} onClick={handleCreate}>{saving ? 'Criando...' : 'Criar tarefa'}</button>
        </div>
      </div>
    </div>
  );
}