import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ProjectModal({ mode, project, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: project?.name || '',
    description: project?.description || '',
    objectives: project?.objectives || '',
    scope: project?.scope || '',
  });

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      objectives: form.objectives.trim(),
      scope: form.scope.trim(),
    };
    if (!payload.name) { alert('Informe o nome do projeto'); return; }

    let result;
    if (mode === 'edit') {
      payload.updated_at = new Date().toISOString();
      result = await supabase.from('projects').update(payload).eq('id', project.id).select().single();
    } else {
      result = await supabase.from('projects').insert(payload).select().single();
    }
    if (result.error) { alert('Erro ao salvar projeto: ' + result.error.message); return; }
    onSaved(result.data, mode !== 'edit');
  }

  return (
    <div className="overlay">
      <div className="modal">
        <h3>{mode === 'edit' ? 'Resumo do projeto' : 'Novo Projeto'}</h3>
        <label>Nome do Projeto</label>
        <input value={form.name} onChange={e => update('name', e.target.value)} />
        <label>Descrição</label>
        <textarea rows={2} value={form.description} onChange={e => update('description', e.target.value)} />
        <label>Objetivos</label>
        <textarea rows={2} value={form.objectives} onChange={e => update('objectives', e.target.value)} />
        <label>Escopo</label>
        <textarea rows={2} value={form.scope} onChange={e => update('scope', e.target.value)} />
        <div className="actions">
          <button className="secondary" onClick={onClose}>Cancelar</button>
          <button className="primary" onClick={handleSave}>Salvar</button>
        </div>
      </div>
    </div>
  );
}