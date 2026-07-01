import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ACTIVITY_LABELS, ACTIVITY_TAG_LABEL, UNASSIGNED_COLUMN_NAME } from '../../constants';
import { useToast } from '../Toast';

export default function ActivityModal({ projectId, activity, onClose, onSaved, onDataChanged }) {
  const showToast = useToast();
  const isEditing = Boolean(activity);
  const [type, setType] = useState(activity?.type || 'reuniao');
  const [personName, setPersonName] = useState(activity?.person_name || '');
  const [date, setDate] = useState(activity?.activity_date || '');
  const [description, setDescription] = useState(activity?.description || '');
  const [status, setStatus] = useState(activity?.status || 'pendente');

  async function getOrCreateUnassignedColumnId() {
    const { data: existing, error: fetchError } = await supabase
      .from('kanban_columns').select('*').eq('project_id', projectId);
    if (fetchError) { alert('Erro ao buscar colunas: ' + fetchError.message); return null; }

    const found = existing.find(c => c.name.trim().toLowerCase() === UNASSIGNED_COLUMN_NAME.toLowerCase());
    if (found) return found.id;

    const minPos = existing.length ? Math.min(...existing.map(c => c.position)) : 0;
    const { data, error } = await supabase
      .from('kanban_columns')
      .insert({ project_id: projectId, name: UNASSIGNED_COLUMN_NAME, position: minPos - 1 })
      .select().single();
    if (error) { alert('Erro ao criar coluna "Não atribuídos": ' + error.message); return null; }
    return data.id;
  }

  async function createTaskFromActivity(payloadActivity) {
    const columnId = await getOrCreateUnassignedColumnId();
    if (!columnId) return;

    const { data: existingCards } = await supabase
      .from('versions').select('position').eq('column_id', columnId)
      .order('position', { ascending: false }).limit(1);
    const nextPosition = existingCards && existingCards.length ? (existingCards[0].position ?? -1) + 1 : 0;

    const { error } = await supabase.from('versions').insert({
      project_id: projectId,
      column_id: columnId,
      version_label: ACTIVITY_TAG_LABEL[payloadActivity.type],
      requester_name: payloadActivity.person_name,
      change_date: payloadActivity.activity_date,
      description: payloadActivity.description,
      position: nextPosition,
      priority: payloadActivity.type === 'correcao' ? 'urgente' : 'normal',
    });
    if (error) { alert('Erro ao criar tarefa a partir da solicitação: ' + error.message); return; }
    onDataChanged?.();
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
      result = await supabase.from('activities').insert({ ...payload, project_id: projectId });
    }
    if (result.error) { alert('Erro ao salvar atividade: ' + result.error.message); return; }

    const shouldGoToTasks = !isEditing && type !== 'reuniao';
    if (shouldGoToTasks) {
      await createTaskFromActivity(payload);
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
        <div className="actions">
          <button className="secondary" onClick={onClose}>Cancelar</button>
          {isEditing && <button className="danger push-left" onClick={handleDelete}>Excluir</button>}
          <button className="primary" onClick={handleSave}>Salvar</button>
        </div>
      </div>
    </div>
  );
}