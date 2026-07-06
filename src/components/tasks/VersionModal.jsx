import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../Toast';
import AttachmentsField from '../AttachmentsField';
import { COMPLEXITY_OPTIONS } from '../../constants';

export default function VersionModal({ projectId, columnId, version, nextPosition, onClose, onSaved }) {
  const showToast = useToast();
  const isEditing = Boolean(version);
  const [title, setTitle] = useState(version?.title || '');
  const [requester, setRequester] = useState(version?.requester_name || '');
  const [date, setDate] = useState(version?.change_date || '');
  const [description, setDescription] = useState(version?.description || '');
  const [priority, setPriority] = useState(version?.priority || 'normal');
  const [complexity, setComplexity] = useState(version?.complexity || 'media');
  const [attachments, setAttachments] = useState(version?.attachments || []);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  async function handleAddAttachment(file) {
    setUploadingAttachment(true);
    const ext = file.name.split('.').pop();
    const path = `tasks/${projectId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('attachments').upload(path, file);
    if (uploadError) { setUploadingAttachment(false); alert('Erro ao enviar arquivo: ' + uploadError.message); return; }
    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);

    if (isEditing) {
      const { data, error } = await supabase.from('attachments')
        .insert({ project_id: projectId, version_id: version.id, file_url: urlData.publicUrl, file_name: file.name })
        .select().single();
      setUploadingAttachment(false);
      if (error) { alert('Erro ao salvar anexo: ' + error.message); return; }
      setAttachments(prev => [...prev, data]);
    } else {
      setUploadingAttachment(false);
      setAttachments(prev => [...prev, {
        id: 'temp-' + Date.now() + '-' + Math.random().toString(36).slice(2),
        file_url: urlData.publicUrl,
        file_name: file.name,
      }]);
    }
  }

  async function handleRemoveAttachment(att) {
    if (isEditing) {
      const { error } = await supabase.from('attachments').delete().eq('id', att.id);
      if (error) { alert('Erro ao remover anexo: ' + error.message); return; }
    }
    setAttachments(prev => prev.filter(a => a.id !== att.id));
  }

  async function handleSave() {
    const finalTitle = title.trim();
    const requester_name = requester.trim();
    const change_date = date || new Date().toISOString().slice(0, 10);
    const desc = description.trim();
    if (!finalTitle || !requester_name) { alert('Preencha o título e quem solicitou.'); return; }

    const payload = { title: finalTitle, requester_name, change_date, description: desc, priority, complexity };
    let result;
    if (isEditing) {
      result = await supabase.from('versions').update(payload).eq('id', version.id);
    } else {
      result = await supabase.from('versions').insert({ ...payload, project_id: projectId, column_id: columnId, position: nextPosition ?? 0 }).select().single();
    }
    if (result.error) { alert('Erro ao salvar item: ' + result.error.message); return; }

    if (!isEditing && attachments.length) {
      const rows = attachments.map(a => ({ project_id: projectId, version_id: result.data.id, file_url: a.file_url, file_name: a.file_name }));
      const { error: attError } = await supabase.from('attachments').insert(rows);
      if (attError) alert('Item salvo, mas houve um erro ao salvar os anexos: ' + attError.message);
    }

    showToast(isEditing ? 'Item atualizado' : 'Item criado');
    onSaved();
  }

  async function handleDelete() {
    if (!isEditing) return;
    if (!confirm('Excluir este item?')) return;
    const { error } = await supabase.from('versions').delete().eq('id', version.id);
    if (error) { alert('Erro ao excluir item: ' + error.message); return; }
    showToast('Item excluído');
    onSaved();
  }

  return (
    <div className="overlay">
      <div className="modal">
        <h3>{isEditing ? 'Editar item' : 'Novo item'}</h3>
        <label>Título</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título da tarefa" />
        <label>Quem solicitou</label>
        <input value={requester} onChange={e => setRequester(e.target.value)} placeholder="Nome" />
        <div className="row">
          <div>
            <label>Data da alteração</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label>Complexidade</label>
            <select value={complexity} onChange={e => setComplexity(e.target.value)}>
              {COMPLEXITY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label>Prioridade</label>
            <select value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="normal">Normal</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
        </div>
        <label>Descrição</label>
        <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="O que foi alterado..." />

        <AttachmentsField
          attachments={attachments}
          uploading={uploadingAttachment}
          onAdd={handleAddAttachment}
          onRemove={handleRemoveAttachment}
        />

        <div className="actions">
          <button className="secondary" onClick={onClose}>Cancelar</button>
          {isEditing && <button className="danger push-left" onClick={handleDelete}>Excluir</button>}
          <button className="primary" onClick={handleSave}>Salvar</button>
        </div>
      </div>
    </div>
  );
}