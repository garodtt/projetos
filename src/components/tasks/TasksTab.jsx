import KanbanBoard from './KanbanBoard';
import PanelSection from './PanelSection';

export default function TasksTab({ projectId, onDataChanged, refreshTick, onVersionChanged, onOpenVersionModal }) {
  return (
    <div>
      <KanbanBoard
        projectId={projectId}
        onDataChanged={onDataChanged}
        refreshTick={refreshTick}
        onVersionChanged={onVersionChanged}
        onOpenVersionModal={onOpenVersionModal}
      />
      <PanelSection projectId={projectId} />
    </div>
  );
}