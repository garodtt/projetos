import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { DRAWIO_EMBED_URL, BLANK_DIAGRAM_XML } from '../../constants';
import { useToast } from '../Toast';

export default function DiagramModal({ projectId, diagram, posX = 40, posY = 40, onClose, onSaved }) {
  const showToast = useToast();
  const [mode, setMode] = useState(diagram ? 'view' : 'edit');
  const [title, setTitle] = useState(diagram?.title || '');
  const [currentId, setCurrentId] = useState(diagram?.id || null);
  const [previewSvg, setPreviewSvg] = useState(diagram?.diagram_svg || '');
  const [pendingXml, setPendingXml] = useState(diagram?.diagram_xml || '');
  const [zoom, setZoom] = useState(1);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (mode !== 'edit') return;

    function handleMessage(evt) {
      if (!iframeRef.current || evt.source !== iframeRef.current.contentWindow) return;
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }

      if (msg.event === 'init') {
        postToDrawio({ action: 'load', xml: pendingXml || BLANK_DIAGRAM_XML, autosave: 1 });
      } else if (msg.event === 'export') {
        handleExport(msg);
      } else if (msg.event === 'exit') {
        handleCancel();
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [mode, pendingXml]);

  function postToDrawio(msg) {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify(msg), '*');
  }

  async function handleExport(msg) {
    const wasNew = !currentId;
    const finalTitle = title.trim() || 'Sem título';
    const payload = { title: finalTitle, diagram_xml: msg.xml || '', diagram_svg: msg.data || '' };

    let result;
    if (currentId) {
      payload.updated_at = new Date().toISOString();
      result = await supabase.from('panel_items').update(payload).eq('id', currentId).select().single();
    } else {
      result = await supabase.from('panel_items').insert({
        ...payload, project_id: projectId, type: 'diagrama', pos_x: posX, pos_y: posY,
      }).select().single();
    }
    if (result.error) { alert('Erro ao salvar diagrama: ' + result.error.message); return; }

    setCurrentId(result.data.id);
    setPreviewSvg(result.data.diagram_svg);
    setPendingXml(result.data.diagram_xml);
    setMode('view');
    showToast(wasNew ? 'Diagrama salvo' : 'Diagrama atualizado');
    onSaved();
  }

  function handleCancel() {
    if (mode === 'edit' && currentId) { setMode('view'); return; }
    onClose();
  }

  async function handleDelete() {
    if (!currentId) return;
    if (!confirm('Excluir este diagrama?')) return;
    const { error } = await supabase.from('panel_items').delete().eq('id', currentId);
    if (error) { alert('Erro ao excluir diagrama: ' + error.message); return; }
    showToast('Diagrama excluído');
    onSaved();
    onClose();
  }

  return (
    <div className="overlay">
      <div className="modal wide">
        {mode === 'view' ? (
          <h3 style={{ margin: '0 0 10px' }}>{title || 'Sem título'}</h3>
        ) : (
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título do diagrama" />
        )}

        {mode === 'view' && (
          <div className="diagram-zoom-toolbar">
            <button type="button" className="secondary small" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}>−</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" className="secondary small" onClick={() => setZoom(z => Math.min(2.5, +(z + 0.25).toFixed(2)))}>+</button>
            <button type="button" className="secondary small" onClick={() => setZoom(1)}>Ajustar</button>
          </div>
        )}

        <div className={'diagram-canvas-wrap' + (mode === 'edit' ? ' is-editing' : '')}>
          {mode === 'edit' ? (
            <iframe ref={iframeRef} className="drawio-frame" src={DRAWIO_EMBED_URL} title="Editor de diagrama" />
          ) : previewSvg ? (
            <img className="diagram-canvas" style={{ transform: `scale(${zoom})` }} src={previewSvg} alt="" />
          ) : (
            <p className="empty-state">Diagrama vazio.</p>
          )}
        </div>

        <div className="actions">
          <button className="secondary" onClick={handleCancel}>{mode === 'edit' ? 'Cancelar' : 'Fechar'}</button>
          {mode === 'view' && currentId && <button className="danger push-left" onClick={handleDelete}>Excluir</button>}
          {mode === 'view' && currentId && <button className="secondary" onClick={() => setMode('edit')}>Editar</button>}
          {mode === 'edit' && <button className="primary" onClick={() => postToDrawio({ action: 'export', format: 'xmlsvg', spin: 'Salvando...' })}>Salvar</button>}
        </div>
      </div>
    </div>
  );
}