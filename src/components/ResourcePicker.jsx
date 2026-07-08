import { useState, useEffect } from 'react';
import { fetchActiveResources, createResource, fetchDefaultCapacitySuggestion } from '../utils/resources';

export default function ResourcePicker({ assignments, onChange, minRequired = 1, taskDurationUnit, taskDurationValue }) {
  const [allResources, setAllResources] = useState([]);
  const [selectValue, setSelectValue] = useState('');
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newHours, setNewHours] = useState(8);

  useEffect(() => {
    fetchActiveResources().then(setAllResources);
    fetchDefaultCapacitySuggestion().then(setNewHours);
  }, []);

  const usedIds = new Set(assignments.map(a => a.resource_id));
  const available = allResources.filter(r => !usedIds.has(r.id));

  function defaultHoursFor(resource) {
    if (taskDurationUnit === 'horas') return Number(taskDurationValue) || resource.daily_capacity_hours || 8;
    return resource.daily_capacity_hours || 8;
  }

  function addAssignment(resource) {
    onChange([...assignments, { resource_id: resource.id, resource_name: resource.name, hours_per_day: defaultHoursFor(resource) }]);
  }

  function handleSelectChange(e) {
    const id = e.target.value;
    if (!id) return;
    const resource = allResources.find(r => r.id === id);
    if (resource) addAssignment(resource);
    setSelectValue('');
  }

  async function handleCreateNew() {
    const name = newName.trim();
    if (!name) return;
    const created = await createResource(name, '', newHours);
    if (!created) return;
    setAllResources(prev => [...prev, created]);
    addAssignment(created);
    setNewName('');
    setCreatingNew(false);
  }

  function updateHours(resourceId, hours) {
    onChange(assignments.map(a => a.resource_id === resourceId ? { ...a, hours_per_day: hours } : a));
  }

  function removeResource(resourceId) {
    if (assignments.length <= minRequired) return;
    onChange(assignments.filter(a => a.resource_id !== resourceId));
  }

  return (
    <div className="resource-picker">
      {assignments.length > 0 && (
        <div className="resource-chip-list">
          {assignments.map(a => (
            <span key={a.resource_id} className="resource-chip">
              {a.resource_name}
              <input
                type="number" min="0.5" step="0.5"
                value={a.hours_per_day}
                onChange={e => updateHours(a.resource_id, Number(e.target.value) || 0)}
              />
              <small>h/dia</small>
              <button type="button" onClick={() => removeResource(a.resource_id)} disabled={assignments.length <= minRequired} aria-label={'Remover ' + a.resource_name}>✕</button>
            </span>
          ))}
        </div>
      )}

      <div className="resource-picker-list-row">
        <select value={selectValue} onChange={handleSelectChange}>
          <option value="">Selecione um recurso...</option>
          {available.map(r => (
            <option key={r.id} value={r.id}>{r.name} ({r.daily_capacity_hours || 8}h/dia)</option>
          ))}
        </select>
        <button type="button" className="secondary small" onClick={() => setCreatingNew(v => !v)}>
          {creatingNew ? 'Cancelar' : '+ Novo recurso'}
        </button>
      </div>

      {creatingNew && (
        <div className="resource-picker-new-form">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome do recurso" />
          <div className="resource-picker-new-hours">
            <input type="number" min="0.5" step="0.5" value={newHours} onChange={e => setNewHours(e.target.value)} />
            <small>h/dia</small>
          </div>
          <button type="button" className="primary small" onClick={handleCreateNew}>Adicionar</button>
        </div>
      )}
    </div>
  );
}