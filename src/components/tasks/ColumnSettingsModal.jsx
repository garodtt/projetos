import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../Toast';

const DEFAULT_COLOR = '#facc15';

export default function ColumnSettingsModal({ column, onClose, onSaved }) {
  const showToast = useToast();
  const [name, setName] = useState(column.name);
  const [isIndicator, setIsIndicator] = useState(column.is_indicator || false);
  const [isVersionColumn, setIsVersionColumn] = useState(column.is_version_column || false);
  const [useCustomColor, setUseCustomColor] = useState(Boolean(column.color));
  const [color, setColor] = useState(column.color || DEFAULT_COLOR);

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) { alert('Informe um nome para a coluna.'); return; }

    const payload = {
      name: trimmedName,
      is_indicator: isIndicator,
      is_version_column: isVersionColumn,
      color: useCustomColor ? color : null,
    };
    const { error } = await supabase.from('kanban_columns').update(payload).eq('id', column.id);
    if (error) { alert('Erro ao salvar configurações da coluna: ' + error.message); return; }

    if (isVersionColumn) {
      const { error: clearError } = await supabase
        .from('kanban_columns')
        .update({ is_version_column: false })
        .eq('project_id', column.project_id)
        .neq('id', column.id);
      if (clearError) console.error(clearError);
    }

    showToast('Coluna atualizada');
    onSaved();
  }

  return (
    <div className="overlay">
      <div className="modal">
        <h3>Configurar coluna</h3>
        <label>Nome</label>
        <input value={name} onChange={e => setName(e.target.value)} />

        <label className="checkbox-row">
          <input type="checkbox" checked={isIndicator} onChange={e => setIsIndicator(e.target.checked)} />
          Mostrar indicador na barra lateral quando houver itens aqui
        </label>

        <label className="checkbox-row">
          <input type="checkbox" checked={isVersionColumn} onChange={e => setIsVersionColumn(e.target.checked)} />
          Marcar como quadro de versão (itens que caírem aqui contam pro versionamento)
        </label>
        {isVersionColumn && (
          <p className="version-column-note">Só uma coluna pode ser o quadro de versão — marcar esta desmarca qualquer outra.</p>
        )}

        <label className="checkbox-row">
          <input type="checkbox" checked={useCustomColor} onChange={e => setUseCustomColor(e.target.checked)} />
          Usar cor personalizada para os cards desta coluna
        </label>
        {useCustomColor && (
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="color-input" />
        )}

        <div className="actions">
          <button className="secondary" onClick={onClose}>Cancelar</button>
          <button className="primary" onClick={handleSave}>Salvar</button>
        </div>
      </div>
    </div>
  );
}