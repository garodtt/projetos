import { supabase } from '../lib/supabaseClient';
import { useToast } from './Toast';

export default function ArchivedProjectsModal({ projects, onClose, onUnarchived }) {
  const showToast = useToast();
  const archived = projects.filter(p => p.is_archived);

  async function unarchive(project) {
    const { error } = await supabase.from('projects').update({ is_archived: false }).eq('id', project.id);
    if (error) { alert('Erro ao desarquivar: ' + error.message); return; }
    showToast('Projeto desarquivado');
    onUnarchived();
  }

  return (
    <div className="overlay">
      <div className="modal">
        <h3>Projetos arquivados</h3>
        {archived.length === 0 ? (
          <p className="empty-state">Nenhum projeto arquivado.</p>
        ) : (
          <div className="archived-list">
            {archived.map(p => (
              <div key={p.id} className="archived-row">
                <span>{p.name}</span>
                <button className="secondary small" onClick={() => unarchive(p)}>Desarquivar</button>
              </div>
            ))}
          </div>
        )}
        <div className="actions">
          <button className="secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}