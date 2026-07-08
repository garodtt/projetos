import { formatDate } from '../../utils/format';

const DURATION_LABELS = { horas: 'Horas', dias: 'Dias', semanas: 'Semanas' };

export default function CombinedScheduleTable({ tasks, projectColorById, projectNameById, onRowClick }) {
  return (
    <table className="schedule-table combined-schedule-table">
      <thead>
        <tr>
          <th>Projeto</th>
          <th>Nome da Tarefa</th>
          <th>Duração</th>
          <th>Início</th>
          <th>Término</th>
          <th>Progresso</th>
          <th>Predecessoras</th>
          <th>Recursos</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map(task => (
          <tr key={task.id} className="combined-schedule-row" onClick={() => onRowClick(task.project_id)}>
            <td>
              <span className="project-tag" style={{ background: projectColorById[task.project_id] }}>
                {projectNameById[task.project_id]}
              </span>
            </td>
            <td className="schedule-name-cell">
              <div className="schedule-name-inner" style={{ paddingLeft: (task.level || 0) * 20 }}>
                {task.name}
              </div>
            </td>
            <td>{task.duration_value} {DURATION_LABELS[task.duration_unit] || task.duration_unit}</td>
            <td>{formatDate(task.start_date)}</td>
            <td>{formatDate(task.end_date)}</td>
            <td>{task.progress_percent ?? 0}%</td>
            <td>{task.predecessorNames && task.predecessorNames.length ? task.predecessorNames.join(', ') : '—'}</td>
            <td>{task.resource_names || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}