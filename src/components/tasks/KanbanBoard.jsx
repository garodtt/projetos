import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { formatDate } from '../../utils/format';
import VersionModal from './VersionModal';

export default function KanbanBoard({ projectId }) {
  const [columns, setColumns] = useState([]);
  const [versions, setVersions] = useState([]);
  const [draggedId, setDraggedId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalColumnId, setModalColumnId] = useState(null);
  const [modalVersion, setModalVersion] = useState(null);

  const load = useCallback(async () => {
    const [colsRes, versionsRes] = await Promise.all([
      supabase.from('kanban_columns').select('*').eq('project_id', projectId).order('position', { ascending: true }),
      supabase.from('versions').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
    ]);
    if (colsRes.error) { alert('Erro ao carregar colunas: ' + colsRes.error.message); return; }
    if (versionsRes.error) { alert('Erro ao carregar tarefas: ' + versionsRes.error.message); return; }
    setColumns(colsRes.data);
    setVersions(versionsRes.data);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

  async function addColumn() {
    const name = prompt('Nome da nova coluna:');
    if (!name) return;
    const position = columns.length ? Math.max(...columns.map(c => c.position)) + 1 : 0;
    const { error } = await supabase.from('kanban_columns').insert({ project_id: projectId, name, position });
    if (error) { alert('Erro ao criar coluna: ' + error.message); return; }
    load();
  }

  async function renameColumn(col) {
    const name = prompt('Novo nome da coluna:', col.name);
    if (!name || name === col.name) return;
    const { error } = await supabase.from('kanban_columns').update({ name }).eq('id', col.id);
    if (error) { alert('Erro ao renomear coluna: ' + error.message); return; }
    load();
  }

  async function deleteColumn(col) {
    if (versions.some(v => v.column_id === col.id)) { alert('Mova ou exclua os itens dessa coluna antes de excluí-la.'); return; }
    if (!confirm('Excluir esta coluna?')) return;
    const { error } = await supabase.from('kanban_columns').delete().eq('id', col.id);
    if (error) { alert('Erro ao excluir coluna: ' + error.message); return; }
    load();
  }

  async function moveColumn(col, direction) {
    const idx = sortedColumns.findIndex(c => c.id === col.id);
    const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sortedColumns.length) return;
    const other = sortedColumns[swapIdx];
    const [r1, r2] = await Promise.all([
      supabase.from('kanban_columns').update({ position: other.position }).eq('id', col.id),
      supabase.from('kanban_columns').update({ position: col.position }).eq('id', other.id),
    ]);
    if (r1.error || r2.error) { alert('Erro ao reordenar colunas: ' + (r1.error || r2.error).message); return; }
    load();
  }

  async function handleDrop(columnId) {
    if (!draggedId) return;
    const id = draggedId;
    setDraggedId(null);
    const { error } = await supabase.from('versions').update({ column_id: columnId }).eq('id', id);
    if (error) { alert('Erro ao mover item: ' + error.message); return; }
    load();
  }

  function openNewCard(columnId) { setModalColumnId(columnId); setModalVersion(null); setModalOpen(true); }
  function openEditCard(version) { setModalColumnId(version.column_id); setModalVersion(version); setModalOpen(true); }

  return (
    <div>
      <div className="section-header">
        <h3>Quadro</h3>
        <button className="primary small" onClick={addColumn}>+ Nova Coluna</button>
      </div>

      {columns.length === 0 ? (
        <p className="empty-state">Crie uma coluna para começar.</p>
      ) : (
        <div className="kanban-board">
          {sortedColumns.map((col, idx) => (
            <div key={col.id} className="kanban-column">
              <div className="kanban-column-header">
                <div className="col-header-main">
                  <button className="icon-btn" disabled={idx === 0} onClick={() => moveColumn(col, 'left')} aria-label="Mover coluna para a esquerda">←</button>
                  <span className="col-name" onClick={() => renameColumn(col)}>{col.name}</span>
                  <button className="icon-btn" disabled={idx === sortedColumns.length - 1} onClick={() => moveColumn(col, 'right')} aria-label="Mover coluna para a direita">→</button>
                </div>
                <button className="icon-btn delete-col" onClick={() => deleteColumn(col)} aria-label="Excluir coluna">✕</button>
              </div>

              <div
                className="kanban-column-body"
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(col.id)}
              >
                {versions.filter(v => v.column_id === col.id).map(v => (
                  <div
                    key={v.id}
                    className={'kanban-card' + (draggedId === v.id ? ' dragging' : '')}
                    draggable
                    onDragStart={() => setDraggedId(v.id)}
                    onDragEnd={() => setDraggedId(null)}
                    onClick={() => openEditCard(v)}
                  >
                    <strong>{v.version_label}</strong>
                    <small>{formatDate(v.change_date)} · {v.requester_name}</small>
                    <p>{v.description || ''}</p>
                  </div>
                ))}
              </div>

              <button className="kanban-add-card" onClick={() => openNewCard(col.id)}>+ Novo Item</button>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <VersionModal
          projectId={projectId}
          columnId={modalColumnId}
          version={modalVersion}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load(); }}
        />
      )}
    </div>
  );
}