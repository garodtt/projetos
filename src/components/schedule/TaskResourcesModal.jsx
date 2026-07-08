import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../Toast';
import ResourcePicker from '../ResourcePicker';
import { findConflictsForAssignment } from '../../utils/resources';

function buildConflictLines(allConflicts) {
  const grouped = {};
  allConflicts.forEach(c => {
    if (!grouped[c.resourceName]) grouped[c.resourceName] = { total: c.total, capacity: c.capacity, items: [] };
    grouped[c.resourceName].items.push(`${c.projectName} / ${c.taskName} (${c.existingHours}h)`);
  });
  return Object.entries(grouped).map(([name, g]) => `${name}: ${g.items.join(', ')} + esta = ${g.total}h de ${g.capacity}h`);
}

export default function TaskResourcesModal({ task, onClose, onSaved }) {
  const showToast = useToast();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('schedule_task_resources').select('*, resources(name)').eq('task_id', task.id).then(({ data, error }) => {
      if (error) { alert('Erro ao carregar recursos: ' + error.message); setLoading(false); return; }
      setAssignments(data.map(r => ({ resource_id: r.resource_id, resource_name: r.resources?.name || '(recurso)', hours_per_day: r.hours_per_day })));
      setLoading(false);
    });
  }, [task.id]);

  async function handleSave() {
    if (!assignments.length) { alert('Mantenha ao menos um recurso.'); return; }
    setSaving(true);

    const conflictChecks = await Promise.all(
      assignments.map(a => findConflictsForAssignment(a.resource_id, task.start_date, task.end_date, a.hours_per_day, task.id))
    );
    const allConflicts = conflictChecks.flat();
    if (allConflicts.length) {
      const lines = buildConflictLines(allConflicts);
      const proceed = confirm('Aviso de conflito de recurso:\n\n' + lines.join('\n') + '\n\nSalvar mesmo assim?');
      if (!proceed) { setSaving(false); return; }
    }

    await supabase.from('schedule_task_resources').delete().eq('task_id', task.id);
    const rows = assignments.map(a => ({ task_id: task.id, resource_id: a.resource_id, hours_per_day: a.hours_per_day }));
    const { error } = await supabase.from('schedule_task_resources').insert(rows);
    setSaving(false);
    if (error) { alert('Erro ao salvar recursos: ' + error.message); return; }
    showToast('Recursos atualizados');
    onSaved();
  }

  return (
    <div className="overlay">
      <div className="modal">
        <h3>Recursos — {task.name}</h3>
        {loading ? <p>Carregando...</p> : (
          <ResourcePicker
            assignments={assignments}
            onChange={setAssignments}
            minRequired={1}
            taskDurationUnit={task.duration_unit}
            taskDurationValue={task.duration_value}
          />
        )}
        <div className="actions">
          <button className="secondary" onClick={onClose}>Cancelar</button>
          <button className="primary" disabled={saving || loading} onClick={handleSave}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  );
}