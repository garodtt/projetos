import KanbanBoard from './KanbanBoard';
import PanelSection from './PanelSection';

export default function TasksTab({ projectId, onDataChanged }) {
  return (
    <div>
      <KanbanBoard projectId={projectId} onDataChanged={onDataChanged} />
      <PanelSection projectId={projectId} />
    </div>
  );
}