import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from './Toast';
import Spinner from './Spinner';

const ENTITY_CONFIG = [
  { key: 'activities', table: 'activities', label: 'Atividades', titleField: 'title', fallbackField: 'description', extraField: 'person_name' },
  { key: 'versions', table: 'versions', label: 'Tarefas (Kanban)', titleField: 'title', fallbackField: null, extraField: 'requester_name' },
  { key: 'panel_items', table: 'panel_items', label: 'Painel', titleField: 'title', fallbackField: null, extraField: null },
  { key: 'schedule_tasks', table: 'schedule_tasks', label: 'Cronograma', titleField: 'name', fallbackField: null, extraField: null },
  { key: 'kanban_columns', table: 'kanban_columns', label: 'Colunas do Quadro', titleField: 'name', fallbackField: null, extraField: null },
  { key: 'folders', table: 'folders', label: 'Pastas', titleField: 'name', fallbackField: null, extraField: null },
];

export default function TrashModal({ onClose, onRestored }) {
  const showToast = useToast();
  const [loading, setLoading] = useState(true);
  const [itemsByEntity, setItemsByEntity] = useState({});
  const [projectNameById, setProjectNameById] = useState({});
  const [confirmingPurgeId, setConfirmingPurgeId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.all(
      ENTITY_CONFIG.map(cfg =>
        supabase.from(cfg.table).select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false })
      )
    );
    const map = {};
    results.forEach((res, idx) => {
      if (res.error) { console.error(res.error); map[ENTITY_CONFIG[idx].key] = []; return; }
      map[ENTITY_CONFIG[idx].key] = res.data;
    });
    setItemsByEntity(map);

    const { data: projects } = await supabase.from('projects').select('id, name');
    const names = {};
    (projects || []).forEach(p => { names[p.id] = p.name; });
    setProjectNameById(names);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function restore(cfg, item) {
    const { error } = await supabase.from(cfg.table).update({ deleted_at: null }).eq('id', item.id);
    if (error) { alert('Erro ao restaurar: ' + error.message); return; }
    showToast('Item restaurado');
    load();
    onRestored?.();
  }

  async function purge(cfg, item) {
    const { error } = await supabase.from(cfg.table).delete().eq('id', item.id);
    setConfirmingPurgeId(null);
    if (error) { alert('Erro ao excluir definitivamente: ' + error.message); return; }
    showToast('Excluído definitivamente');
    load();
  }

  function itemLabel(cfg, item) {
    const main = item[cfg.titleField] || (cfg.fallbackField ? item[cfg.fallbackField] : null);
    return main ? (main.length > 60 ? main.slice(0, 60) + '…' : main) : '(sem título)';
  }

  const totalCount = ENTITY_CONFIG.reduce((sum, cfg) => sum + (itemsByEntity[cfg.key]?.length || 0), 0);

  return (
    <div className="overlay">
      <div className="modal wide">
        <h3>Lixeira</h3>
        {loading ? (
          <Spinner />
        ) : totalCount === 0 ? (
          <p className="empty-state">A lixeira está vazia.</p>
        ) : (
          <div className="trash-list">
            {ENTITY_CONFIG.map(cfg => {
              const items = itemsByEntity[cfg.key] || [];
              if (!items.length) return null;
              return (
                <div key={cfg.key} className="trash-group">
                  <h4>{cfg.label}</h4>
                  {items.map(item => (
                    <div key={item.id} className="trash-row">
                      <div className="trash-row-info">
                        <strong>{itemLabel(cfg, item)}</strong>
                        {cfg.extraField && item[cfg.extraField] && <small> · {item[cfg.extraField]}</small>}
                        {item.project_id && projectNameById[item.project_id] && (
                          <small className="trash-project-tag"> · {projectNameById[item.project_id]}</small>
                        )}
                      </div>
                      <div className="trash-row-actions">
                        {confirmingPurgeId === item.id ? (
                          <>
                            <button className="secondary small" onClick={() => setConfirmingPurgeId(null)}>Cancelar</button>
                            <button className="danger small" onClick={() => purge(cfg, item)}>Confirmar exclusão</button>
                          </>
                        ) : (
                          <>
                            <button className="secondary small" onClick={() => restore(cfg, item)}>Restaurar</button>
                            <button className="danger small" onClick={() => setConfirmingPurgeId(item.id)}>Excluir definitivamente</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
        <div className="actions">
          <button className="secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}