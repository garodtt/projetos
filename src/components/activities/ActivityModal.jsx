import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ACTIVITY_LABELS, ACTIVITY_TAG_LABEL, UNASSIGNED_COLUMN_NAME } from '../../constants';
import { useToast } from '../Toast';
import AttachmentsField from '../AttachmentsField';

export default function ActivityModal({ projectId, activity, onClose, onSaved, onDataChanged, onTaskCreatedElsewhere }) {
  const showToast = useToast();
  const isEditing = Boolean(activity);
  const [type, setType] = useState(activity?.type || 'reuniao');
  const [personName, setPersonName] = useState(activity?.person_name || '');
  const [date, setDate] = useState(activity?.activity_date || '');
  const [description, setDescription] = useState(activity?.description || '');
  const [status, setStatus] = useState(activity?.status || 'pendente');
  const [attachments, setAttachments] = useState(activity?.attachments || []);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  async function handleAddAttachment(file) {
    setUploadingAttachment(true);
    const ext = file.name.split('.').pop();
    const path = `activities/${projectId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('attachments').upload(path, file);
    if (uploadError) { setUploadingAttachment(false); alert('Erro ao enviar arquivo: ' + uploadError.message); return; }
    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);

    if (isEditing) {
      const { data, error } = await supabase.from('attachments')
        .insert({ project_id: projectId, activity_id: activity.id, file_url: urlData.publicUrl, file_name: file.name })
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

  async function getOrCreateUnassignedColumnId() {
    const { data: existing, error: fetchError } = await supabase
      .from('kanban_columns').select('*').eq('project_id', projectId);
    if (fetchError) { alert('Erro ao buscar colunas: ' + fetchError.message); return null; }

    const found = existing.find(c => c.name.trim().toLowerCase() === UNASSIGNED_COLUMN_NAME.toLowerCase());
    if (found) return found.id;

    const minPos = existing.length ? Math.min(...existing.map(c => c.position)) : 0;
    const { data, error } = await supabase
      .from('kanban_columns')
      .insert({ project_id: projectId, name: UNASSIGNED_COLUMN_NAME, position: minPos - 1, is_indicator: true })
      .select().single();
    if (error) { alert('Erro ao criar coluna "Não atribuídos": ' + error.message); return null; }
    return data.id;
  }

  async function createTaskFromActivity(payloadActivity, attachmentsList) {
    const columnId = await getOrCreateUnassignedColumnId();
    if (!columnId) return;

    const { data: existingCards } = await supabase
      .from('versions').select('position').eq('column_id', columnId)
      .order('position', { ascending: false }).limit(1);
    const nextPosition = existingCards && existingCards.length ? (existingCards[0].position ?? -1) + 1 : 0;

    const { data: newVersion, error } = await supabase.from('versions').insert({
      project_id: projectId,
      column_id: columnId,
      version_label: ACTIVITY_TAG_LABEL[payloadActivity.type],
      requester_name: payloadActivity.person_name,
      change_date: payloadActivity.activity_date,
      description: payloadActivity.description,
      position: nextPosition,
      priority: payloadActivity.type === 'correcao' ? 'urgente' : 'normal',
    }).select().single();
    if (error) { alert('Erro ao criar tarefa a partir da solicitação: ' + error.message); return; }

    if (attachmentsList && attachmentsList.length) {
      const rows = attachmentsList.map(a => ({ project_id: projectId, version_id: newVersion.id, file_url: a.file_url, file_name: a.file_name }));
      const { error: attError } = await supabase.from('attachments').insert(rows);
      if (attError) alert('Tarefa criada, mas houve um erro ao copiar os anexos: ' + attError.message);
    }

    onDataChanged?.();
    onTaskCreatedElsewhere?.();
  }

  async function handleSave() {
    const person_name = personName.trim();
    const activity_date = date || new Date().toISOString().slice(0, 10);
    const desc = description.trim();
    if (!person_name || !desc) { alert('Preencha o nome e a descrição.'); return; }

    const payload = {
      type,
      person_name,
      activity_date,
      description: desc,
      status: type === 'reuniao' ? null : status,
    };

    let result;
    if (isEditing) {
      result = await supabase.from('activities').update(payload).eq('id', activity.id);
    } else {
      result = await supabase.from('activities').insert({ ...payload, project_id: projectId }).select().single();
    }
    if (result.error) { alert('Erro ao salvar atividade: ' + result.error.message); return; }

    if (!isEditing && attachments.length) {
      const rows = attachments.map(a => ({ project_id: projectId, activity_id: result.data.id, file_url: a.file_url, file_name: a.file_name }));
      const { error: attError } = await supabase.from('attachments').insert(rows);
      if (attError) alert('Atividade salva, mas houve um erro ao salvar os anexos: ' + attError.message);
    }

    const shouldGoToTasks = !isEditing && type !== 'reuniao';
    if (shouldGoToTasks) {
      await createTaskFromActivity(payload, attachments);
      showToast('Atividade salva e tarefa criada em "Não atribuídos"');
    } else {
      showToast(isEditing ? 'Atividade atualizada' : 'Atividade salva');
    }
    onSaved(shouldGoToTasks);
  }

  async function handleDelete() {
    if (!isEditing) return;
    if (!confirm('Excluir esta atividade?')) return;
    const { error } = await supabase.from('activities').delete().eq('id', activity.id);
    if (error) { alert('Erro ao excluir atividade: ' + error.message); return; }
    showToast('Atividade excluída');
    onSaved(false);
  }

  return (
    <div className="overlay">
      <div className="modal">
        <h3>{isEditing ? 'Editar atividade' : 'Nova atividade'}</h3>
        <div className="type-toggle">
          {['reuniao', 'melhoria', 'correcao'].map(t => (
            <button
              key={t}
              type="button"
              className={'type-btn' + (type === t ? ' active' : '')}
              onClick={() => setType(t)}
            >
              {t === 'reuniao' ? 'Reunião' : t === 'melhoria' ? 'Melhoria' : 'Correção'}
            </button>
          ))}
        </div>
        <div className="row">
          <div>
            <label>{ACTIVITY_LABELS[type].person}</label>
            <input value={personName} onChange={e => setPersonName(e.target.value)} placeholder="Nome" />
          </div>
          <div>
            <label>Data</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
        {type !== 'reuniao' && (
          <div>
            <label>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="pendente">Pendente</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluido">Concluído</option>
            </select>
          </div>
        )}
        <label>{ACTIVITY_LABELS[type].desc}</label>
        <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} />

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