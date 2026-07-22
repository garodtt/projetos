import { useEffect } from 'react';

// Esc fecha o modal; Ctrl+Enter (ou Cmd+Enter no Mac) salva. Cada modal só
// precisa chamar useModalShortcuts(onClose, handleSave) — se algum dos
// dois não fizer sentido pro modal (ex: um modal só de leitura sem
// "salvar"), pode passar null no lugar.
export function useModalShortcuts(onClose, onSave) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && onSave) {
        e.preventDefault();
        onSave();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onSave]);
}