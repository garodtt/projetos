import KanbanBoard from './KanbanBoard';
import PanelSection from './PanelSection';

export default function TasksTab({ projectId, onDataChanged, refreshTick }) {
  return (
    <div>
      <KanbanBoard projectId={projectId} onDataChanged={onDataChanged} refreshTick={refreshTick} />
      <PanelSection projectId={projectId} />
    </div>
  );
}