import { formatDate } from '../../utils/format';

const DURATION_UNITS = [
  { value: 'horas', label: 'Horas' },
  { value: 'dias', label: 'Dias' },
  { value: 'semanas', label: 'Semanas' },
];

export default function ScheduleTaskTable({
  tasks,
  predecessorDrafts,
  predecessorsTextByTaskId,
  onNameChange,
  onNameBlur,
  onDurationValueChange,
  onDurationValueBlur,
  onDurationUnitChange,
  onStartDateChange,
  onResourceChange,
  onResourceBlur,
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
          <th>Predecessoras</th>
          <th>Recursos</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task, idx) => (
          <tr key={task.id}>
            <td className="schedule-id-cell">{idx + 1}</td>
            <td className="schedule-name-cell">
              <div className="schedule-name-inner" style={{ paddingLeft: (task.level || 0) * 20 }}>
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
              <input
                placeholder="Nomes separados por vírgula"
                value={task.resource_names || ''}
                onChange={e => onResourceChange(task, e.target.value)}
                onBlur={() => onResourceBlur(task)}
              />
            </td>
            <td className="schedule-row-actions">
              <button className="icon-btn" title="Mover para cima" onClick={() => onMoveUp(task)} disabled={idx === 0}>↑</button>
              <button className="icon-btn" title="Mover para baixo" onClick={() => onMoveDown(task)} disabled={idx === tasks.length - 1}>↓</button>
              <button className="icon-btn delete-col" title="Excluir" onClick={() => onDelete(task)}>✕</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}