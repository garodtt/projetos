import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { formatDate } from '../../utils/format';
import { isImageFile, fileIcon } from '../../utils/files';
import { COMPLEXITY_LABEL } from '../../constants';
import { registerVersionColumnArrival, fetchVersionProgress } from '../../utils/versioning';
import VersionModal from './VersionModal';
import ColumnSettingsModal from './ColumnSettingsModal';
import TextPromptModal from '../TextPromptModal';
import Spinner from '../Spinner';
import { useToast } from '../Toast';

function renderAttachmentsPreview(attachments) {
  if (!attachments || attachments.length === 0) return null;
  if (attachments.length === 1) {
    const att = attachments[0];
    return isImageFile(att.file_name) ? (
      <img className="kanban-card-thumb" src={att.file_url} alt="" />
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

function versionProgressTooltip(progress) {
  if (!progress) return 'Coluna de versão';
  return `Grande ${progress.counts.grande}/${progress.thresholds.grande} · Média ${progress.counts.media}/${progress.thresholds.media} · Mínima ${progress.counts.minima}/${progress.thresholds.minima}`;
}

export default function KanbanBoard({ projectId, onDataChanged, refreshTick, onVersionChanged, onOpenVersionModal }) {
  const showToast = useToast();
  const [columns, setColumns] = useState([]);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverInfo, setDragOverInfo] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalColumnId, setModalColumnId] = useState(null);
  const [modalColumnIsVersionColumn, setModalColumnIsVersionColumn] = useState(false);
  const [modalVersion, setModalVersion] = useState(null);
  const [modalNextPosition, setModalNextPosition] = useState(0);
  const [settingsColumn, setSettingsColumn] = useState(null);
  const [textPromptConfig, setTextPromptConfig] = useState(null);
  const [versionProgress, setVersionProgress] = useState(null);

  const load = useCallback(async () => {
    const [colsRes, versionsRes] = await Promise.all([
      supabase.from('kanban_columns').select('*').eq('project_id', projectId).is('deleted_at', null).order('position', { ascending: true }),
      supabase.from('versions').select('*, attachments!version_id(*)').eq('project_id', projectId).is('deleted_at', null).order('position', { ascending: true }),
    ]);
    if (colsRes.error) { alert('Erro ao carregar colunas: ' + colsRes.error.message); setLoading(false); return; }
    if (versionsRes.error) { alert('Erro ao carregar tarefas: ' + versionsRes.error.message); setLoading(false); return; }
    setColumns(colsRes.data);
    setVersions(versionsRes.data);
    setLoading(false);
    onDataChanged?.();

    const versionCol = colsRes.data.find(c => c.is_version_column);
    if (versionCol) {
      const progress = await fetchVersionProgress(projectId);
      setVersionProgress(progress);
    } else {
      setVersionProgress(null);
    }
  }, [projectId, onDataChanged]);

  useEffect(() => { load(); }, [load, refreshTick]);

  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

  function cardsInColumn(columnId) {
    return versions.filter(v => v.column_id === columnId).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  function openAddColumnPrompt() {
    setTextPromptConfig({
      title: 'Nova coluna',
      label: 'Nome da coluna',
      initialValue: '',
      confirmLabel: 'Criar',
      onConfirm: async (value) => {
        setTextPromptConfig(null);
        const position = columns.length ? Math.max(...columns.map(c => c.position)) + 1 : 0;
        const { error } = await supabase.from('kanban_columns').insert({ project_id: projectId, name: value, position });
        if (error) { alert('Erro ao criar coluna: ' + error.message); return; }
        showToast('Coluna criada');
        load();
      },
    });
  }

  async function deleteColumn(col) {
    if (versions.some(v => v.column_id === col.id)) { alert('Mova ou exclua os itens dessa coluna antes de excluí-la.'); return; }
    const { error } = await supabase.from('kanban_columns').update({ deleted_at: new Date().toISOString() }).eq('id', col.id);
    if (error) { alert('Erro ao excluir coluna: ' + error.message); return; }
    showToast('Coluna excluída', {
      actionLabel: 'Desfazer',
      onAction: async () => {
        await supabase.from('kanban_columns').update({ deleted_at: null }).eq('id', col.id);
        load();
      },
    });
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
    const previousColumnId = draggedCard.column_id;

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

    if (previousColumnId !== targetColumnId) {
      const targetColumn = columns.find(c => c.id === targetColumnId);
      if (targetColumn?.is_version_column && draggedCard.complexity) {
        await registerVersionColumnArrival(projectId, draggedCard.complexity, draggedCard.id, draggedCard.title);
      }
    }

    load();
    onVersionChanged?.();
  }

  function openNewCard(columnId) {
    const items = cardsInColumn(columnId);
    const nextPosition = items.length ? Math.max(...items.map(v => v.position ?? 0)) + 1 : 0;
    const column = columns.find(c => c.id === columnId);
    setModalColumnId(columnId);
    setModalColumnIsVersionColumn(Boolean(column?.is_version_column));
    setModalVersion(null);
    setModalNextPosition(nextPosition);
    setModalOpen(true);
  }
  function openEditCard(version) {
    setModalColumnId(version.column_id);
    setModalColumnIsVersionColumn(false);
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
        <button className="primary small" onClick={openAddColumnPrompt}>+ Nova Coluna</button>
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
                    <span className="col-name" onClick={() => setSettingsColumn(col)} title="Clique para configurar esta coluna">
                      {col.color && <span className="col-color-dot" style={{ background: col.color }} />}
                      {col.is_version_column && (
                        <button
                          type="button"
                          className="icon-btn version-column-badge-btn"
                          title={versionProgressTooltip(versionProgress)}
                          onClick={e => { e.stopPropagation(); onOpenVersionModal?.(); }}
                        >🔢</button>
                      )}
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
                  {items.map(v => {
                    const borderColor = col.color || (v.priority === 'urgente' ? '#dc2626' : null);
                    return (
                      <div
                        key={v.id}
                        className={
                          'kanban-card' +
                          (draggedId === v.id ? ' dragging' : '') +
                          (dragOverInfo?.cardId === v.id ? ' drag-over-' + dragOverInfo.position : '')
                        }
                        style={borderColor ? { borderLeft: '3px solid ' + borderColor, paddingLeft: '7px' } : undefined}
                        draggable
                        onDragStart={() => setDraggedId(v.id)}
                        onDragEnd={() => { setDraggedId(null); setDragOverInfo(null); }}
                        onDragOver={e => handleCardDragOver(e, v)}
                        onDrop={e => handleDropOnCard(e, v)}
                        onClick={() => openEditCard(v)}
                      >
                        {v.priority === 'urgente' && <span className="priority-tag">Urgente</span>}
                        {v.complexity && <span className={'complexity-tag ' + v.complexity}>{COMPLEXITY_LABEL[v.complexity]}</span>}
                        {renderAttachmentsPreview(v.attachments)}
                        <strong>{v.title}</strong>
                        <small>{formatDate(v.change_date)} · {v.requester_name}</small>
                        {v.assignee_name && <small className="assignee-line">👤 {v.assignee_name}</small>}
                        <p>{v.description || ''}</p>
                      </div>
                    );
                  })}
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
          isVersionColumn={modalColumnIsVersionColumn}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load(); onVersionChanged?.(); }}
        />
      )}

      {settingsColumn && (
        <ColumnSettingsModal
          column={settingsColumn}
          onClose={() => setSettingsColumn(null)}
          onSaved={() => { setSettingsColumn(null); load(); }}
        />
      )}

      {textPromptConfig && (
        <TextPromptModal
          title={textPromptConfig.title}
          label={textPromptConfig.label}
          initialValue={textPromptConfig.initialValue}
          confirmLabel={textPromptConfig.confirmLabel}
          onConfirm={textPromptConfig.onConfirm}
          onClose={() => setTextPromptConfig(null)}
        />
      )}
    </div>
  );
}