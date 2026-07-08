import { formatDate } from '../../utils/format';

const DURATION_UNITS = [
  { value: 'horas', label: 'Horas' },
  { value: 'dias', label: 'Dias' },
  { value: 'semanas', label: 'Semanas' },
];

export default function ScheduleTaskTable({
  tasks,
  displayNumberByTaskId,
  hasChildrenByTaskId,
  collapsedIds,
  onToggleCollapse,
  predecessorDrafts,
  predecessorsTextByTaskId,
  resourceSummaryByTaskId,
  showActual,
  onNameChange,
  onNameBlur,
  onDurationValueChange,
  onDurationValueBlur,
  onDurationUnitChange,
  onStartDateChange,
  onColorChange,
  onEditResources,
  onActualStartChange,
  onActualEndChange,
  onIndent,
  onOutdent,
  onMoveUp,
  onMoveDown,
  onDelete,
  onPredecessorsInputChange,
  onPredecessorsBlur,
}) {
  return (
    <table className="schedule-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Nome da Tarefa</th>
          <th>Duração</th>
          <th>Início</th>
          <th>Término</th>
          {showActual && <th>Início Real</th>}
          {showActual && <th>Término Real</th>}
          <th>Predecessoras</th>
          <th>Recursos</th>
          <th>Cor</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task, idx) => {
          const hasChildren = hasChildrenByTaskId[task.id];
          const isCollapsed = collapsedIds.has(task.id);
          return (
            <tr key={task.id}>
              <td className="schedule-id-cell">{displayNumberByTaskId[task.id]}</td>
              <td className="schedule-name-cell">
                <div className="schedule-name-inner" style={{ paddingLeft: (task.level || 0) * 20 }}>
                  {hasChildren ? (
                    <button
                      className="icon-btn schedule-collapse-btn"
                      title={isCollapsed ? 'Expandir' : 'Recolher'}
                      onClick={() => onToggleCollapse(task.id)}
                    >
                      {isCollapsed ? '▸' : '▾'}
                    </button>
                  ) : (
                    <span className="schedule-collapse-spacer" />
                  )}
                  <button className="icon-btn" title="Recuar" onClick={() => onOutdent(task)} disabled={task.level === 0}>←</button>
                  <button className="icon-btn" title="Indentar (criar subtarefa)" onClick={() => onIndent(task)}>→</button>
                  <input
                    value={task.name}
                    onChange={e => onNameChange(task, e.target.value)}
                    onBlur={() => onNameBlur(task)}
                  />
                </div>
              </td>
              <td>
                <div className="schedule-duration-cell">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={task.duration_value}
                    onChange={e => onDurationValueChange(task, e.target.value)}
                    onBlur={() => onDurationValueBlur(task)}
                  />
                  <select value={task.duration_unit} onChange={e => onDurationUnitChange(task, e.target.value)}>
                    {DURATION_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
              </td>
              <td>
                <input type="date" value={task.start_date} onChange={e => onStartDateChange(task, e.target.value)} />
              </td>
              <td className="schedule-end-cell">{formatDate(task.end_date)}</td>
              {showActual && (
                <td>
                  <input type="date" value={task.actual_start_date || ''} onChange={e => onActualStartChange(task, e.target.value)} />
                </td>
              )}
              {showActual && (
                <td>
                  <input type="date" value={task.actual_end_date || ''} onChange={e => onActualEndChange(task, e.target.value)} />
                </td>
              )}
              <td>
                <input
                  className="schedule-predecessors-input"
                  placeholder="ex: 1, 3"
                  value={predecessorDrafts[task.id] !== undefined ? predecessorDrafts[task.id] : predecessorsTextByTaskId[task.id]}
                  onChange={e => onPredecessorsInputChange(task.id, e.target.value)}
                  onBlur={() => onPredecessorsBlur(task)}
                />
              </td>
              <td>
                <button type="button" className="secondary small schedule-resources-btn" onClick={() => onEditResources(task)}>
                  {resourceSummaryByTaskId[task.id] || 'Definir'}
                </button>
              </td>
              <td className="schedule-color-cell">
                <input
                  type="color"
                  value={task.color || '#93c5fd'}
                  onChange={e => onColorChange(task, e.target.value)}
                  title="Cor da barra"
                />
                {task.color && (
                  <button className="icon-btn" title="Remover cor personalizada" onClick={() => onColorChange(task, null)}>✕</button>
                )}
              </td>
              <td className="schedule-row-actions">
                <button className="icon-btn" title="Mover para cima" onClick={() => onMoveUp(task)} disabled={idx === 0}>↑</button>
                <button className="icon-btn" title="Mover para baixo" onClick={() => onMoveDown(task)} disabled={idx === tasks.length - 1}>↓</button>
                <button className="icon-btn delete-col" title="Excluir" onClick={() => onDelete(task)}>✕</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}