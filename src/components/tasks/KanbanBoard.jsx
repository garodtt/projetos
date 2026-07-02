import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { formatDate } from '../../utils/format';
import VersionModal from './VersionModal';
import Spinner from '../Spinner';
import { useToast } from '../Toast';

export default function KanbanBoard({ projectId, onDataChanged }) {
  const showToast = useToast();
  const [columns, setColumns] = useState([]);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverInfo, setDragOverInfo] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalColumnId, setModalColumnId] = useState(null);
  const [modalVersion, setModalVersion] = useState(null);
  const [modalNextPosition, setModalNextPosition] = useState(0);

  const load = useCallback(async () => {
    const [colsRes, versionsRes] = await Promise.all([
      supabase.from('kanban_columns').select('*').eq('project_id', projectId).order('position', { ascending: true }),
      supabase.from('versions').select('*').eq('project_id', projectId).order('position', { ascending: true }),
    ]);
    if (colsRes.error) { alert('Erro ao carregar colunas: ' + colsRes.error.message); setLoading(false); return; }
    if (versionsRes.error) { alert('Erro ao carregar tarefas: ' + versionsRes.error.message); setLoading(false); return; }
    setColumns(colsRes.data);
    setVersions(versionsRes.data);
    setLoading(false);
    onDataChanged?.();
  }, [projectId, onDataChanged]);

  useEffect(() => { load(); }, [load]);

  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

  function cardsInColumn(columnId) {
    return versions.filter(v => v.column_id === columnId).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  async function addColumn() {
    const name = prompt('Nome da nova coluna:');
    if (!name) return;
    const position = columns.length ? Math.max(...columns.map(c => c.position)) + 1 : 0;
    const { error } = await supabase.from('kanban_columns').insert({ project_id: projectId, name, position });
    if (error) { alert('Erro ao criar coluna: ' + error.message); return; }
    showToast('Coluna criada');
    load();
  }

  async function renameColumn(col) {
    const name = prompt('Novo nome da coluna:', col.name);
    if (!name || name === col.name) return;
    const { error } = await supabase.from('kanban_columns').update({ name }).eq('id', col.id);
    if (error) { alert('Erro ao renomear coluna: ' + error.message); return; }
    showToast('Coluna renomeada');
    load();
  }

  async function deleteColumn(col) {
    if (versions.some(v => v.column_id === col.id)) { alert('Mova ou exclua os itens dessa coluna antes de excluí-la.'); return; }
    if (!confirm('Excluir esta coluna?')) return;
    const { error } = await supabase.from('kanban_columns').delete().eq('id', col.id);
    if (error) { alert('Erro ao excluir coluna: ' + error.message); return; }
    showToast('Coluna excluída');
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

  function handleCardDragOver(e, overCard) {
    e.preventDefault();
    e.stopPropagation();
    if (draggedId === overCard.id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position = e.clientY < midpoint ? 'before' : 'after';
    setDragOverInfo({ cardId: overCard.id, position });
  }

  async function handleDropOnCard(e, targetCard) {
    e.preventDefault();
    e.stopPropagation();
    const info = dragOverInfo;
    const id = draggedId;
    setDraggedId(null);
    setDragOverInfo(null);
    if (!id || id === targetCard.id) return;
    await reorderCard(id, targetCard.column_id, targetCard.id, info?.position || 'before');
  }

  async function handleDropOnColumnBody(columnId) {
    const id = draggedId;
    setDraggedId(null);
    setDragOverInfo(null);
    if (!id) return;
    await reorderCard(id, columnId, null, 'after');
  }

  async function reorderCard(draggedCardId, targetColumnId, targetCardId, position) {
    const draggedCard = versions.find(v => v.id === draggedCardId);
    if (!draggedCard) return;

    let columnItems = cardsInColumn(targetColumnId).filter(v => v.id !== draggedCardId);

    let insertIndex = columnItems.length;
    if (targetCardId) {
      const idx = columnItems.findIndex(v => v.id === targetCardId);
      insertIndex = position === 'before' ? idx : idx + 1;
    }
    columnItems.splice(insertIndex, 0, draggedCard);

    const updates = columnItems.map((v, idx) => ({ id: v.id, position: idx }));

    const results = await Promise.all(updates.map(u =>
      supabase.from('versions').update({ position: u.position, column_id: targetColumnId }).eq('id', u.id)
    ));
    const failed = results.find(r => r.error);
    if (failed) { alert('Erro ao mover item: ' + failed.error.message); return; }
    load();
  }

  function openNewCard(columnId) {
    const items = cardsInColumn(columnId);
    const nextPosition = items.length ? Math.max(...items.map(v => v.position ?? 0)) + 1 : 0;
    setModalColumnId(columnId);
    setModalVersion(null);
    setModalNextPosition(nextPosition);
    setModalOpen(true);
  }
  function openEditCard(version) {
    setModalColumnId(version.column_id);
    setModalVersion(version);
    setModalOpen(true);
  }

  if (loading) {
    return (
      <div>
        <div className="section-header"><h3>Quadro</h3></div>
        <Spinner />
      </div>
    );
  }

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
          {sortedColumns.map((col, idx) => {
            const items = cardsInColumn(col.id);
            return (
              <div key={col.id} className="kanban-column">
                <div className="kanban-column-header">
                  <div className="col-header-main">
                    <button className="icon-btn" disabled={idx === 0} onClick={() => moveColumn(col, 'left')} aria-label="Mover coluna para a esquerda">←</button>
                    <span className="col-name" onClick={() => renameColumn(col)}>
                      {col.name} <span className="col-count">({items.length})</span>
                    </span>
                    <button className="icon-btn" disabled={idx === sortedColumns.length - 1} onClick={() => moveColumn(col, 'right')} aria-label="Mover coluna para a direita">→</button>
                  </div>
                  <button className="icon-btn delete-col" onClick={() => deleteColumn(col)} aria-label="Excluir coluna">✕</button>
                </div>

                <div
                  className="kanban-column-body"
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleDropOnColumnBody(col.id)}
                >
                  {items.map(v => (
                    <div
                      key={v.id}
                      className={
                        'kanban-card' +
                        (v.priority === 'urgente' ? ' priority-urgente' : '') +
                        (draggedId === v.id ? ' dragging' : '') +
                        (dragOverInfo?.cardId === v.id ? ' drag-over-' + dragOverInfo.position : '')
                      }
                      draggable
                      onDragStart={() => setDraggedId(v.id)}
                      onDragEnd={() => { setDraggedId(null); setDragOverInfo(null); }}
                      onDragOver={e => handleCardDragOver(e, v)}
                      onDrop={e => handleDropOnCard(e, v)}
                      onClick={() => openEditCard(v)}
                    >
                      {v.priority === 'urgente' && <span className="priority-tag">Urgente</span>}
                      {v.image_url && <img className="kanban-card-thumb" src={v.image_url} alt="" />}
                      <strong>{v.version_label}</strong>
                      <small>{formatDate(v.change_date)} · {v.requester_name}</small>
                      <p>{v.description || ''}</p>
                    </div>
                  ))}
                </div>

                <button className="kanban-add-card" onClick={() => openNewCard(col.id)}>+ Novo Item</button>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <VersionModal
          projectId={projectId}
          columnId={modalColumnId}
          version={modalVersion}
          nextPosition={modalNextPosition}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load(); }}
        />
      )}
    </div>
  );
}