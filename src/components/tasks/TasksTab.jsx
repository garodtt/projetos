import DiagramsSection from './DiagramsSection';
import KanbanBoard from './KanbanBoard';

export default function TasksTab({ projectId }) {
  return (
    <div>
      <DiagramsSection projectId={projectId} />
      <KanbanBoard projectId={projectId} />
    </div>
  );
}