import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../Toast';
import Spinner from '../Spinner';
import DiagramModal from './DiagramModal';

export default function PanelSection({ projectId }) {
  const showToast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [diagramModalOpen, setDiagramModalOpen] = useState(false);
  const [activeDiagram, setActiveDiagram] = useState(null);
  const [pendingPos, setPendingPos] = useState({ x: 40, y: 40 });
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('panel_items').select('*').eq('project_id', projectId).order('created_at', { ascending: true });
    if (error) { alert('Erro ao carregar o painel: ' + error.message); setLoading(false); return; }
    setItems(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  function nextDefaultPosition() {
    const idx = items.length;
    return { x: 40 + (idx % 4) * 340, y: 40 + Math.floor(idx / 4) * 280 };
  }

  function handleCreateDiagram() {
    setMenuOpen(false);
    setPendingPos(nextDefaultPosition());
    setActiveDiagram(null);
    setDiagramModalOpen(true);
  }

  function openExistingDiagram(item) {
    setActiveDiagram(item);
    setDiagramModalOpen(true);
  }

  async function handleCreateNote() {
    setMenuOpen(false);
    const pos = nextDefaultPosition();
    const { error } = await supabase.from('panel_items').insert({
      project_id: projectId, type: 'nota', note_text: '', note_color: '#fef08a', pos_x: pos.x, pos_y: pos.y,
    });
    if (error) { alert('Erro ao criar nota: ' + error.message); return; }
    showToast('Nota criada');
    load();
  }

  function triggerImagePicker() {
    setMenuOpen(false);
    fileInputRef.current?.click();
  }

  async function handleImageFileSelected(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const pos = nextDefaultPosition();
    const ext = file.name.split('.').pop();
    const path = `panel/${projectId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('attachments').upload(path, file);
    if (uploadError) { alert('Erro ao enviar imagem: ' + uploadError.message); return; }
    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
    const { error } = await supabase.from('panel_items').insert({
      project_id: projectId, type: 'imagem', image_url: urlData.publicUrl, pos_x: pos.x, pos_y: pos.y,
    });
    if (error) { alert('Erro ao criar item: ' + error.message); return; }
    showToast('Imagem adicionada');
    load();
  }

  async function deleteItem(item) {
    if (!confirm('Excluir este item do painel?')) return;
    const { error } = await supabase.from('panel_items').delete().eq('id', item.id);
    if (error) { alert('Erro ao excluir: ' + error.message); return; }
    setItems(prev => prev.filter(i => i.id !== item.id));
    showToast('Item removido do painel');
  }

  function updateLocalPosition(id, x, y) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, pos_x: x, pos_y: y } : i));
  }

  async function persistPosition(id, x, y) {
    const { error } = await supabase.from('panel_items').update({ pos_x: x, pos_y: y }).eq('id', id);
    if (error) console.error(error);
  }

  function handleHandlePointerDown(e, item) {
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const originX = item.pos_x;
    const originY = item.pos_y;

    function onMove(moveEvt) {
      const dx = moveEvt.clientX - startX;
      const dy = moveEvt.clientY - startY;
      updateLocalPosition(item.id, Math.max(0, originX + dx), Math.max(0, originY + dy));
    }
    function onUp(upEvt) {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      const dx = upEvt.clientX - startX;
      const dy = upEvt.clientY - startY;
      persistPosition(item.id, Math.max(0, originX + dx), Math.max(0, originY + dy));
    }
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  }

  function updateLocalNote(id, text) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, note_text: text } : i));
  }

  async function persistNoteText(item) {
    const { error } = await supabase.from('panel_items').update({ note_text: item.note_text }).eq('id', item.id);
    if (error) alert('Erro ao salvar nota: ' + error.message);
  }

  return (
    <div>
      <div className="section-header">
        <h3>Painel</h3>
        <div className="create-menu-wrap">
          <button className="primary small" onClick={() => setMenuOpen(o => !o)}>+ Criar anotação</button>
          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="create-menu">
                <button onClick={handleCreateDiagram}>Diagrama</button>
                <button onClick={handleCreateNote}>Nota</button>
                <button onClick={triggerImagePicker}>Imagem</button>
              </div>
            </>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFileSelected} />
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="panel-canvas-wrap">
          <div className="panel-canvas">
            {items.length === 0 && <p className="empty-state panel-empty">Painel vazio. Clique em + Criar anotação.</p>}
            {items.map(item => (
              <div
                key={item.id}
                className={'panel-item panel-item-' + item.type}
                style={{
                  left: item.pos_x,
                  top: item.pos_y,
                  background: item.type === 'nota' ? (item.note_color || '#fef08a') : undefined,
                }}
              >
                <div className="panel-item-handle" onPointerDown={e => handleHandlePointerDown(e, item)}>
                  <span className="drag-dots">⠿</span>
                  <button className="icon-btn" onClick={() => deleteItem(item)} aria-label="Excluir item">✕</button>
                </div>

                {item.type === 'diagrama' && (
                  <div className="panel-item-body" onClick={() => openExistingDiagram(item)}>
                    <strong>{item.title || 'Diagrama'}</strong>
                    <div className="panel-diagram-thumb">
                      {item.diagram_svg && <img src={item.diagram_svg} alt="" />}
                    </div>
                  </div>
                )}

                {item.type === 'nota' && (
                  <textarea
                    className="panel-note-text"
                    value={item.note_text || ''}
                    onChange={e => updateLocalNote(item.id, e.target.value)}
                    onBlur={() => persistNoteText(item)}
                    placeholder="Escreva sua anotação..."
                  />
                )}

                {item.type === 'imagem' && (
                  <div className="panel-item-body no-pad">
                    <img className="panel-image" src={item.image_url} alt="" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {diagramModalOpen && (
        <DiagramModal
          projectId={projectId}
          diagram={activeDiagram}
          posX={pendingPos.x}
          posY={pendingPos.y}
          onClose={() => setDiagramModalOpen(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}