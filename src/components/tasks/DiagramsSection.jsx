import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DiagramModal from './DiagramModal';

export default function DiagramsSection({ projectId }) {
  const [diagrams, setDiagrams] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeDiagram, setActiveDiagram] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('diagrams').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
    if (error) { alert('Erro ao carregar diagramas: ' + error.message); return; }
    setDiagrams(data);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  function openNew() { setActiveDiagram(null); setModalOpen(true); }
  function openExisting(d) { setActiveDiagram(d); setModalOpen(true); }

  return (
    <div>
      <div className="section-header">
        <h3>Diagramas</h3>
        <button className="primary small" onClick={openNew}>+ Novo Diagrama</button>
      </div>
      <div className="diagrams-grid">
        {diagrams.length === 0 && <p className="empty-state">Nenhum diagrama ainda.</p>}
        {diagrams.map(d => (
          <div key={d.id} className="diagram-card" onClick={() => openExisting(d)}>
            <strong>{d.title}</strong>
            <div className="diagram-thumb">
              {d.diagram_svg && <img src={d.diagram_svg} alt="" />}
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <DiagramModal
          projectId={projectId}
          diagram={activeDiagram}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}