import { useRef } from 'react';
import { isImageFile, fileIcon, ATTACHMENT_ACCEPT } from '../utils/files';

export default function AttachmentsField({ attachments, uploading, onAdd, onRemove }) {
  const fileInputRef = useRef(null);

  function handleFileSelected(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    onAdd(file);
  }

  return (
    <div className="attachments-field">
      <label>Anexos</label>

      {attachments.length > 0 && (
        <div className="attachments-list">
          {attachments.map(att => (
            <div key={att.id} className="attachment-row">
              {isImageFile(att.file_name) ? (
                <img className="attachment-row-thumb" src={att.file_url} alt="" />
              ) : (
                <span className="attachment-row-icon">{fileIcon(att.file_name)}</span>
              )}
              <a className="attachment-row-name" href={att.file_url} target="_blank" rel="noreferrer">
                {att.file_name}
              </a>
              <button type="button" className="icon-btn" onClick={() => onRemove(att)} aria-label="Remover anexo">✕</button>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="secondary small" onClick={() => fileInputRef.current.click()} disabled={uploading}>
        {uploading ? 'Enviando...' : '+ Adicionar arquivo'}
      </button>
      <input ref={fileInputRef} type="file" accept={ATTACHMENT_ACCEPT} className="hidden" onChange={handleFileSelected} />
    </div>
  );
}