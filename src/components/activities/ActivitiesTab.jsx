import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ACTIVITY_TAG_LABEL } from '../../constants';
import { formatDate } from '../../utils/format';
import { isImageFile, fileIcon } from '../../utils/files';
import ActivityModal from './ActivityModal';
import Spinner from '../Spinner';

function renderAttachmentsPreview(attachments) {
  if (!attachments || attachments.length === 0) return null;
  if (attachments.length === 1) {
    const att = attachments[0];
    return isImageFile(att.file_name) ? (
      <img className="activity-card-thumb" src={att.file_url} alt="" />
    ) : (
      <a
        className="attachment-chip"
        href={att.file_url}
        target="_blank"
        rel="noreferrer"
        onClick={e => e.stopPropagation()}
      >
        {fileIcon(att.file_name)} {att.file_name}
      </a>
    );
  }
  return <span className="attachment-chip attachment-chip-count">📎 {attachments.length} anexos</span>;
}

export default function ActivitiesTab({ projectId, onActivityConvertedToTask, onDataChanged, onTaskCreatedElsewhere }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('activities')
      .select('*, attachments!activity_id(*)')
      .eq('project_id', projectId)
      .order('activity_date', { ascending: false });
    if (error) { alert('Erro ao carregar atividades: ' + error.message); setLoading(false); return; }
    setActivities(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const visible = filter === 'all' ? activities : activities.filter(a => a.type === filter);

  function openNew() { setEditingActivity(null); setModalOpen(true); }
  function openEdit(activity) { setEditingActivity(activity); setModalOpen(true); }

  async function handleSaved(isNewMelhoriaOuCorrecao) {
    setModalOpen(false);
    await load();
    if (isNewMelhoriaOuCorrecao) onActivityConvertedToTask();
  }

  return (
    <div>
      <div className="section-header">
        <div className="filter-chips">
          {['all', 'reuniao', 'melhoria', 'correcao'].map(f => (
            <button key={f} className={'chip' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Todos' : f === 'reuniao' ? 'Reuniões' : f === 'melhoria' ? 'Melhorias' : 'Correções'}
            </button>
          ))}
        </div>
        <button className="primary small" onClick={openNew}>+ Nova Atividade</button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div>
          {visible.length === 0 && <p className="empty-state">Nada registrado ainda. Clique em + Nova Atividade.</p>}
          {visible.map(a => (
            <div key={a.id} className="card" onClick={() => openEdit(a)}>
              <span className={'tag ' + a.type}>{ACTIVITY_TAG_LABEL[a.type]}</span>
              <small> · {a.person_name} · {formatDate(a.activity_date)}{a.status ? ' · status: ' + a.status : ''}</small>
              {renderAttachmentsPreview(a.attachments)}
              <p>{a.description}</p>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <ActivityModal
          projectId={projectId}
          activity={editingActivity}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
          onDataChanged={onDataChanged}
          onTaskCreatedElsewhere={onTaskCreatedElsewhere}
        />
      )}
    </div>
  );
}