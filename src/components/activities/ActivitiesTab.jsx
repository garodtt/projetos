import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ACTIVITY_TAG_LABEL } from '../../constants';
import { formatDate } from '../../utils/format';
import ActivityModal from './ActivityModal';
import Spinner from '../Spinner';

export default function ActivitiesTab({ projectId, onActivityConvertedToTask }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('activities').select('*').eq('project_id', projectId).order('activity_date', { ascending: false });
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
        />
      )}
    </div>
  );
}