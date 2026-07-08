import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from './Toast';
import Spinner from './Spinner';
import { formatDate } from '../utils/format';
import { fetchDefaultCapacitySuggestion } from '../utils/resources';

export default function ResourcesModal({ onClose }) {
  const showToast = useToast();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newHours, setNewHours] = useState(8);
  const [expandedId, setExpandedId] = useState(null);
  const [assignmentsByResource, setAssignmentsByResource] = useState({});

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('resources').select('*').is('deleted_at', null).order('name', { ascending: true });
    if (error) { alert('Erro ao carregar recursos: ' + error.message); setLoading(false); return; }
    setResources(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    fetchDefaultCapacitySuggestion().then(setNewHours);
  }, [load]);

  async function loadAssignments(resourceId) {
    const { data, error } = await supabase
      .from('schedule_task_resources')
      .select('hours_per_day, schedule_tasks(name, start_date, end_date, projects(name))')
      .eq('resource_id', resourceId);
    if (error) { alert('Erro ao carregar alocações: ' + error.message); return; }
    setAssignmentsByResource(prev => ({ ...prev, [resourceId]: data }));
  }

  function toggleExpand(resource) {
    setExpandedId(prev => (prev === resource.id ? null : resource.id));
    if (!assignmentsByResource[resource.id]) loadAssignments(resource.id);
  }

  async function addResource() {
    const name = newName.trim();
    if (!name) return;
    const { error } = await supabase.from('resources').insert({
      name, role: newRole.trim() || null, daily_capacity_hours: Number(newHours) || 8,
    });
    if (error) { alert('Erro ao criar recurso: ' + error.message); return; }
    setNewName(''); setNewRole('');
    showToast('Recurso criado');
    load();
  }

  async function deleteResource(resource) {
    if (!confirm('Excluir o recurso "' + resource.name + '"? Isso remove as alocações dele nas tarefas.')) return;
    const { error } = await supabase.from('resources').update({ deleted_at: new Date().toISOString() }).eq('id', resource.id);
    if (error) { alert('Erro ao excluir recurso: ' + error.message); return; }
    showToast('Recurso excluído');
    load();
  }

  return (
    <div className="overlay">
      <div className="modal wide">
        <h3>Recursos</h3>

        <div className="row">
          <div>
            <label>Nome</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome do recurso" />
          </div>
          <div>
            <label>Função (opcional)</label>
            <input value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="Ex: Desenvolvedor" />
          </div>
          <div>
            <label>Horas por dia</label>
            <input type="number" min="0.5" step="0.5" value={newHours} onChange={e => setNewHours(e.target.value)} />
          </div>
        </div>
        <button className="secondary small" onClick={addResource}>+ Adicionar recurso</button>

        <h4 className="version-history-title">Recursos cadastrados</h4>
        {loading ? <Spinner /> : resources.length === 0 ? (
          <p className="empty-state">Nenhum recurso cadastrado ainda.</p>
        ) : (
          <div className="version-history-list">
            {resources.map(r => (
              <div key={r.id} className="version-history-item">
                <div className="version-history-row" onClick={() => toggleExpand(r)}>
                  <span>{expandedId === r.id ? '▾' : '▸'}</span>
                  <strong>{r.name}</strong>
                  {r.role && <small>{r.role}</small>}
                  <small>{r.daily_capacity_hours}h/dia</small>
                  <button className="icon-btn delete-col push-left" onClick={e => { e.stopPropagation(); deleteResource(r); }}>✕</button>
                </div>
                {expandedId === r.id && (
                  <ul className="version-history-items-list">
                    {(assignmentsByResource[r.id] || []).length === 0 ? (
                      <li>Sem alocações no momento.</li>
                    ) : (
                      (assignmentsByResource[r.id] || []).map((a, idx) => (
                        <li key={idx}>
                          {a.schedule_tasks?.name} — {a.schedule_tasks?.projects?.name} · {formatDate(a.schedule_tasks?.start_date)} a {formatDate(a.schedule_tasks?.end_date)} · {a.hours_per_day}h/dia
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="actions">
          <button className="secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}