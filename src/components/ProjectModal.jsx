import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from './Toast';

export default function ProjectModal({ mode, project, initialFolderId, onClose, onSaved, onDeleted }) {
  const showToast = useToast();
  const [folders, setFolders] = useState([]);
  const [form, setForm] = useState({
    name: project?.name || '',
    description: project?.description || '',
    objectives: project?.objectives || '',
    scope: project?.scope || '',
    folder_id: project?.folder_id || initialFolderId || '',
  });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase.from('folders').select('*').order('name', { ascending: true }).then(({ data, error }) => {
      if (error) { console.error(error); return; }
      setFolders(data);
    });
  }, []);

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      objectives: form.objectives.trim(),
      scope: form.scope.trim(),
      folder_id: form.folder_id || null,
    };
    if (!payload.name) { alert('Informe o nome do projeto'); return; }

    let result;
    if (mode === 'edit') {
      payload.updated_at = new Date().toISOString();
      result = await supabase.from('projects').update(payload).eq('id', project.id).select().single();
    } else {
      result = await supabase.from('projects').insert(payload).select().single();
    }
    if (result.error) { alert('Erro ao salvar projeto: ' + result.error.message); return; }
    showToast(mode === 'edit' ? 'Projeto atualizado' : 'Projeto criado');
    onSaved(result.data, mode !== 'edit');
  }

  async function handleDeleteProject() {
    if (confirmText.trim() !== project.name) return;
    setDeleting(true);
    const { error } = await supabase.from('projects').delete().eq('id', project.id);
    setDeleting(false);
    if (error) { alert('Erro ao excluir projeto: ' + error.message); return; }
    showToast('Projeto excluído');
    onDeleted();
  }

  return (
    <div className="overlay">
      <div className="modal">
        <h3>{mode === 'edit' ? 'Resumo do projeto' : 'Novo Projeto'}</h3>
        <label>Nome do Projeto</label>
        <input value={form.name} onChange={e => update('name', e.target.value)} />
        <label>Pasta (opcional)</label>
        <select value={form.folder_id} onChange={e => update('folder_id', e.target.value)}>
          <option value="">Nenhuma (projeto avulso)</option>
          {folders.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <label>Descrição</label>
        <textarea rows={2} value={form.description} onChange={e => update('description', e.target.value)} />
        <label>Objetivos</label>
        <textarea rows={2} value={form.objectives} onChange={e => update('objectives', e.target.value)} />
        <label>Escopo</label>
        <textarea rows={2} value={form.scope} onChange={e => update('scope', e.target.value)} />
        <div className="actions">
          <button className="secondary" onClick={onClose}>Cancelar</button>
          <button className="primary" onClick={handleSave}>Salvar</button>
        </div>

        {mode === 'edit' && (
          <div className="danger-zone">
            {!confirmingDelete ? (
              <button type="button" className="danger-link" onClick={() => setConfirmingDelete(true)}>
                Excluir projeto
              </button>
            ) : (
              <div className="danger-zone-box">
                <p>
                  Isso apaga <strong>{project.name}</strong> e tudo dentro dele — atividades, tarefas, diagramas e anexos.
                  Não pode ser desfeito.
                </p>
                <label>Digite <strong>{project.name}</strong> para confirmar</label>
                <input
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder={project.name}
                />
                <div className="actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => { setConfirmingDelete(false); setConfirmText(''); }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="danger"
                    disabled={confirmText.trim() !== project.name || deleting}
                    onClick={handleDeleteProject}
                  >
                    {deleting ? 'Excluindo...' : 'Excluir definitivamente'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}