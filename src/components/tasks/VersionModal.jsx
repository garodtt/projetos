import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function VersionModal({ projectId, columnId, version, onClose, onSaved }) {
  const isEditing = Boolean(version);
  const [label, setLabel] = useState(version?.version_label || '');
  const [requester, setRequester] = useState(version?.requester_name || '');
  const [date, setDate] = useState(version?.change_date || '');
  const [description, setDescription] = useState(version?.description || '');

  async function handleSave() {
    const version_label = label.trim();
    const requester_name = requester.trim();
    const change_date = date || new Date().toISOString().slice(0, 10);
    const desc = description.trim();
    if (!version_label || !requester_name) { alert('Preencha a versão e quem solicitou.'); return; }

    const payload = { version_label, requester_name, change_date, description: desc };
    let result;
    if (isEditing) {
      result = await supabase.from('versions').update(payload).eq('id', version.id);
    } else {
      result = await supabase.from('versions').insert({ ...payload, project_id: projectId, column_id: columnId });
    }
    if (result.error) { alert('Erro ao salvar item: ' + result.error.message); return; }
    onSaved();
  }

  async function handleDelete() {
    if (!isEditing) return;
    if (!confirm('Excluir este item?')) return;
    const { error } = await supabase.from('versions').delete().eq('id', version.id);
    if (error) { alert('Erro ao excluir item: ' + error.message); return; }
    onSaved();
  }

  return (
    <div className="overlay">
      <div className="modal">
        <h3>{isEditing ? 'Editar item' : 'Novo item'}</h3>
        <label>Versão</label>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: v1.2.0" />
        <label>Quem solicitou</label>
        <input value={requester} onChange={e => setRequester(e.target.value)} placeholder="Nome" />
        <label>Data da alteração</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        <label>Descrição</label>
        <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="O que foi alterado..." />
        <div className="actions">
          <button className="secondary" onClick={onClose}>Cancelar</button>
          {isEditing && <button className="danger push-left" onClick={handleDelete}>Excluir</button>}
          <button className="primary" onClick={handleSave}>Salvar</button>
        </div>
      </div>
    </div>
  );
}