import { useState, useRef, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { DRAWIO_EMBED_URL, BLANK_DIAGRAM_XML } from '../../constants';
import { invertSvgDataUri } from '../../utils/svgColor';
import { useToast } from '../Toast';

function safeFilename(name) {
  return (name || 'diagrama').trim().replace(/[\\/:*?"<>|]+/g, '-') || 'diagrama';
}

function downloadDataUri(dataUri, filename) {
  const a = document.createElement('a');
  a.href = dataUri;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function DiagramModal({ projectId, diagram, posX = 40, posY = 40, zIndex = 1, onClose, onSaved }) {
  const showToast = useToast();
  const [mode, setMode] = useState(diagram ? 'view' : 'edit');
  const [title, setTitle] = useState(diagram?.title || '');
  const [currentId, setCurrentId] = useState(diagram?.id || null);
  const [previewSvg, setPreviewSvg] = useState(diagram?.diagram_svg || '');
  const [pendingXml, setPendingXml] = useState(diagram?.diagram_xml || '');
  const [zoom, setZoom] = useState(1);
  const [invertColors, setInvertColors] = useState(false);
  const iframeRef = useRef(null);
  const titleInputRef = useRef(null);

  const displaySvg = useMemo(
    () => (invertColors && previewSvg ? invertSvgDataUri(previewSvg) : previewSvg),
    [previewSvg, invertColors]
  );

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

  function requestExport() {
    if (iframeRef.current) iframeRef.current.blur();
    setTimeout(() => {
      postToDrawio({ action: 'export', format: 'xmlsvg', spin: 'Salvando...' });
    }, 150);
  }

  async function handleExport(msg) {
    const wasNew = !currentId;
    const typedTitle = titleInputRef.current ? titleInputRef.current.value : title;
    const finalTitle = (typedTitle || '').trim() || 'Sem título';
    const payload = { title: finalTitle, diagram_xml: msg.xml || '', diagram_svg: msg.data || '' };

    let result;
    if (currentId) {
      payload.updated_at = new Date().toISOString();
      result = await supabase.from('panel_items').update(payload).eq('id', currentId).select().single();
    } else {
      result = await supabase.from('panel_items').insert({
        ...payload, project_id: projectId, type: 'diagrama', pos_x: posX, pos_y: posY, z_index: zIndex,
      }).select().single();
    }
    if (result.error) { alert('Erro ao salvar diagrama: ' + result.error.message); return; }

    setCurrentId(result.data.id);
    setTitle(result.data.title);
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
    const idToDelete = currentId;
    const { error } = await supabase.from('panel_items').update({ deleted_at: new Date().toISOString() }).eq('id', idToDelete);
    if (error) { alert('Erro ao excluir diagrama: ' + error.message); return; }
    showToast('Diagrama excluído', {
      actionLabel: 'Desfazer',
      onAction: async () => {
        await supabase.from('panel_items').update({ deleted_at: null }).eq('id', idToDelete);
        onSaved();
      },
    });
    onSaved();
    onClose();
  }

  function handleDownloadSvg() {
    if (!displaySvg) { alert('Não há diagrama pra exportar ainda.'); return; }
    downloadDataUri(displaySvg, safeFilename(title) + '.svg');
  }

  function handleDownloadPng() {
    if (!displaySvg) { alert('Não há diagrama pra exportar ainda.'); return; }
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      downloadDataUri(canvas.toDataURL('image/png'), safeFilename(title) + '.png');
    };
    img.onerror = () => alert('Erro ao gerar PNG. Tente exportar como SVG.');
    img.src = displaySvg;
  }

  return (
    <div className="overlay">
      <div className="modal wide">
        {mode === 'view' ? (
          <h3 style={{ margin: '0 0 10px' }}>{title || 'Sem título'}</h3>
        ) : (
          <input ref={titleInputRef} value={title} onChange={e => setTitle(e.target.value)} placeholder="Título do diagrama" />
        )}

        {mode === 'view' && (
          <div className="diagram-zoom-toolbar">
            <button type="button" className="secondary small" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}>−</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" className="secondary small" onClick={() => setZoom(z => Math.min(2.5, +(z + 0.25).toFixed(2)))}>+</button>
            <button type="button" className="secondary small" onClick={() => setZoom(1)}>Ajustar</button>
            <button
              type="button"
              className={'secondary small' + (invertColors ? ' active-toggle' : '')}
              onClick={() => setInvertColors(v => !v)}
            >
              🔁 Inverter cores
            </button>
            <span className="toolbar-divider" />
            <button type="button" className="secondary small" onClick={handleDownloadPng}>⬇ PNG</button>
            <button type="button" className="secondary small" onClick={handleDownloadSvg}>⬇ SVG</button>
          </div>
        )}

        <div className={'diagram-canvas-wrap' + (mode === 'edit' ? ' is-editing' : '')}>
          {mode === 'edit' ? (
            <iframe ref={iframeRef} className="drawio-frame" src={DRAWIO_EMBED_URL} title="Editor de diagrama" />
          ) : displaySvg ? (
            <img className="diagram-canvas" style={{ transform: `scale(${zoom})` }} src={displaySvg} alt="" />
          ) : (
            <p className="empty-state">Diagrama vazio.</p>
          )}
        </div>

        <div className="actions">
          <button className="secondary" onClick={handleCancel}>{mode === 'edit' ? 'Cancelar' : 'Fechar'}</button>
          {mode === 'view' && currentId && <button className="danger push-left" onClick={handleDelete}>Excluir</button>}
          {mode === 'view' && currentId && <button className="secondary" onClick={() => setMode('edit')}>Editar</button>}
          {mode === 'edit' && <button className="primary" onClick={requestExport}>Salvar</button>}
        </div>
      </div>
    </div>
  );
}