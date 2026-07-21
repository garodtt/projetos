import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from './Toast';

export default function ProjectModal({ mode, project, initialFolderId, currentUserRole, currentUserId, onClose, onSaved, onDeleted }) {
  const showToast = useToast();
  const [folders, setFolders] = useState([]);
  const [availableAreas, setAvailableAreas] = useState([]);
  const [form, setForm] = useState({
    name: project?.name || '',
    description: project?.description || '',
    objectives: project?.objectives || '',
    scope: project?.scope || '',
    folder_id: project?.folder_id || initialFolderId || '',
    area_id: project?.area_id || '',
    is_archived: project?.is_archived || false,
  });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [stampEmails, setStampEmails] = useState({});

  useEffect(() => {
    if (mode !== 'edit' || !project) return;
    const ids = [project.created_by, project.updated_by].filter(Boolean);
    if (!ids.length) return;
    supabase.from('user_profiles').select('id, email').in('id', ids).then(({ data }) => {
      const map = {};
      (data || []).forEach(p => { map[p.id] = p.email; });
      setStampEmails(map);
    });
  }, [mode, project]);

  useEffect(() => {
    supabase.from('folders').select('*').is('deleted_at', null).order('name', { ascending: true }).then(({ data, error }) => {
      if (error) { console.error(error); return; }
      setFolders(data);
    });
  }, []);

  useEffect(() => {
    async function loadAreas() {
      const { data: allAreas, error } = await supabase.from('areas').select('*').order('name', { ascending: true });
      if (error) { console.error(error); return; }

      if (currentUserRole === 'admin') {
        setAvailableAreas(allAreas);
      } else {
        const { data: myAreas } = await supabase.from('user_areas').select('area_id').eq('user_id', currentUserId);
        const myAreaIds = new Set((myAreas || []).map(ua => ua.area_id));
        const mine = allAreas.filter(a => myAreaIds.has(a.id));
        setAvailableAreas(mine);
      }
    }
    loadAreas();
  }, [currentUserRole, currentUserId]);

  // Assim que as áreas disponíveis chegam, se ainda não tem uma escolhida
  // (projeto novo), pré-seleciona a primeira — evita esquecer o campo em
  // branco e cair numa área que a própria pessoa não enxerga depois.
  useEffect(() => {
    if (mode !== 'edit' && !form.area_id && availableAreas.length) {
      setForm(f => ({ ...f, area_id: f.area_id || availableAreas[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableAreas]);

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
      area_id: form.area_id || null,
      is_archived: form.is_archived,
    };
    if (!payload.name) { alert('Informe o nome do projeto'); return; }
    if (!payload.area_id) { alert('Escolha uma área — sem área, o projeto fica visível só pra administradores.'); return; }

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
        {mode === 'edit' && (project.created_by || project.updated_by) && (
          <p className="stamp-info">
            {project.created_by && <>Criado por {stampEmails[project.created_by] || '—'}. </>}
            {project.updated_by && <>Última alteração por {stampEmails[project.updated_by] || '—'}.</>}
          </p>
        )}
        <label>Nome do Projeto</label>
        <input value={form.name} onChange={e => update('name', e.target.value)} />
        <label>Pasta (opcional)</label>
        <select value={form.folder_id} onChange={e => update('folder_id', e.target.value)}>
          <option value="">Nenhuma (projeto avulso)</option>
          {folders.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <label>Área</label>
        <select value={form.area_id} onChange={e => update('area_id', e.target.value)}>
          <option value="">Selecione uma área</option>
          {availableAreas.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        {!availableAreas.length && (
          <p className="version-column-hint">
            Você ainda não tem nenhuma área atribuída — peça pra um administrador te atribuir uma em ⚙️ Administração antes de criar um projeto.
          </p>
        )}
        <label>Descrição</label>
        <textarea rows={2} value={form.description} onChange={e => update('description', e.target.value)} />
        <label>Objetivos</label>
        <textarea rows={2} value={form.objectives} onChange={e => update('objectives', e.target.value)} />
        <label>Escopo</label>
        <textarea rows={2} value={form.scope} onChange={e => update('scope', e.target.value)} />

        {mode === 'edit' && (
          <label className="checkbox-row">
            <input type="checkbox" checked={form.is_archived} onChange={e => update('is_archived', e.target.checked)} />
            Arquivar projeto (some da lista principal, continua acessível em "Arquivados")
          </label>
        )}

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