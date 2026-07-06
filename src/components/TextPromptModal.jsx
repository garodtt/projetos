import { useState, useRef, useEffect } from 'react';

export default function TextPromptModal({ title, label, initialValue, confirmLabel, onConfirm, onClose }) {
  const [value, setValue] = useState(initialValue || '');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function handleConfirm() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  }

  return (
    <div className="overlay">
      <div className="modal">
        <h3>{title}</h3>
        <label>{label}</label>
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleConfirm(); } }}
        />
        <div className="actions">
          <button className="secondary" onClick={onClose}>Cancelar</button>
          <button className="primary" onClick={handleConfirm}>{confirmLabel || 'Salvar'}</button>
        </div>
      </div>
    </div>
  );
}