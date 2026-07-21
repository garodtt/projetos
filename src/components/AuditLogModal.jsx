import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import Spinner from './Spinner';

const PAGE_SIZE = 50;

const TABLE_LABELS = {
  projects: 'Projeto',
  activities: 'Atividade',
  versions: 'Card (Kanban)',
  panel_items: 'Painel',
  schedule_tasks: 'Tarefa (Cronograma)',
};

const ACTION_LABELS = {
  insert: 'criou',
  update: 'alterou',
  delete: 'excluiu',
};

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR');
}

function recordLabel(row) {
  const data = row.action === 'update' ? row.changed_fields?.after : row.changed_fields;
  if (!data) return '';
  return data.name || data.title || data.description || '(sem nome)';
}

function changedKeys(row) {
  if (row.action !== 'update') return [];
  const before = row.changed_fields?.before || {};
  const after = row.changed_fields?.after || {};
  const skip = new Set(['updated_at', 'updated_by']);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed = [];
  keys.forEach(k => {
    if (skip.has(k)) return;
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changed.push(k);
  });
  return changed;
}

export default function AuditLogModal({ onClose }) {
  const [entries, setEntries] = useState([]);
  const [tableFilter, setTableFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async (reset) => {
    if (reset) { setLoading(true); setEntries([]); setHasMore(true); }
    const offset = reset ? 0 : entries.length;
    let query = supabase.from('audit_log').select('*').order('created_at', { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
    if (tableFilter) query = query.eq('table_name', tableFilter);
    const { data, error } = await query;
    if (error) { alert('Erro ao carregar histórico: ' + error.message); setLoading(false); setLoadingMore(false); return; }
    setEntries(prev => (reset ? data : [...prev, ...data]));
    setHasMore((data || []).length === PAGE_SIZE);
    setLoading(false);
    setLoadingMore(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableFilter]);

  useEffect(() => { load(true); }, [tableFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleLoadMore() {
    setLoadingMore(true);
    load(false);
  }

  if (loading) {
    return <div className="overlay"><div className="modal"><Spinner /></div></div>;
  }

  return (
    <div className="overlay">
      <div className="modal wide">
        <h3>📜 Histórico de alterações</h3>

        <label>Filtrar por área do sistema</label>
        <select value={tableFilter} onChange={e => setTableFilter(e.target.value)}>
          <option value="">Todas</option>
          {Object.entries(TABLE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        {!entries.length ? (
          <p className="version-column-hint">Nenhum registro ainda.</p>
        ) : (
          <div className="audit-log-list">
            {entries.map(row => {
              const keys = changedKeys(row);
              const isOpen = expandedId === row.id;
              return (
                <div key={row.id} className="audit-log-row">
                  <div className="audit-log-row-main">
                    <span className="audit-log-when">{formatDateTime(row.created_at)}</span>
                    <span className="audit-log-who">{row.user_email || '(usuário removido)'}</span>
                    <span className="audit-log-what">
                      {ACTION_LABELS[row.action] || row.action} {TABLE_LABELS[row.table_name] || row.table_name}
                      {' '}<strong>{recordLabel(row)}</strong>
                      {row.action === 'update' && keys.length > 0 && (
                        <> — campos: {keys.join(', ')}</>
                      )}
                    </span>
                    <button type="button" className="secondary small" onClick={() => setExpandedId(isOpen ? null : row.id)}>
                      {isOpen ? 'Ocultar' : 'Detalhes'}
                    </button>
                  </div>
                  {isOpen && (
                    <pre className="audit-log-detail">{JSON.stringify(row.changed_fields, null, 2)}</pre>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {hasMore && entries.length > 0 && (
          <div className="actions" style={{ justifyContent: 'center' }}>
            <button type="button" className="secondary" onClick={handleLoadMore} disabled={loadingMore}>
              {loadingMore ? 'Carregando…' : 'Carregar mais'}
            </button>
          </div>
        )}

        <div className="actions">
          <button className="secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}