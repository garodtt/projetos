import KanbanBoard from './KanbanBoard';
import PanelSection from './PanelSection';

export default function TasksTab({ projectId, onDataChanged, refreshTick, onVersionChanged }) {
  return (
    <div>
      <KanbanBoard projectId={projectId} onDataChanged={onDataChanged} refreshTick={refreshTick} onVersionChanged={onVersionChanged} />
      <PanelSection projectId={projectId} />
    </div>
  );
}