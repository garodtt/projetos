import DiagramsSection from './DiagramsSection';
import KanbanBoard from './KanbanBoard';

export default function TasksTab({ projectId, onDataChanged }) {
  return (
    <div>
      <DiagramsSection projectId={projectId} />
      <KanbanBoard projectId={projectId} onDataChanged={onDataChanged} />
    </div>
  );
}