import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import Spinner from './Spinner';

export default function GlobalSearchModal({ onClose, onNavigate }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const runSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults(null); return; }
    setLoading(true);
    const like = '%' + q.trim() + '%';

    const [projectsRes, foldersRes, activitiesRes, versionsRes, scheduleRes, panelRes] = await Promise.all([
      supabase.from('projects').select('id, name').ilike('name', like).limit(10),
      supabase.from('folders').select('id, name').is('deleted_at', null).ilike('name', like).limit(10),
      supabase.from('activities').select('id, project_id, title, description, person_name').is('deleted_at', null)
        .or(`title.ilike.${like},description.ilike.${like},person_name.ilike.${like}`).limit(10),
      supabase.from('versions').select('id, project_id, column_id, title, description, requester_name').is('deleted_at', null)
        .or(`title.ilike.${like},description.ilike.${like},requester_name.ilike.${like}`).limit(10),
      supabase.from('schedule_tasks').select('id, project_id, name, resource_names').is('deleted_at', null)
        .or(`name.ilike.${like},resource_names.ilike.${like}`).limit(10),
      supabase.from('panel_items').select('id, project_id, type, title').is('deleted_at', null).eq('type', 'diagrama').ilike('title', like).limit(10),
    ]);

    const projectIds = new Set([
      ...(projectsRes.data || []).map(p => p.id),
      ...(activitiesRes.data || []).map(a => a.project_id),
      ...(versionsRes.data || []).map(v => v.project_id),
      ...(scheduleRes.data || []).map(s => s.project_id),
      ...(panelRes.data || []).map(p => p.project_id),
    ]);
    const { data: projectNames } = projectIds.size
      ? await supabase.from('projects').select('id, name').in('id', Array.from(projectIds))
      : { data: [] };
    const nameById = {};
    (projectNames || []).forEach(p => { nameById[p.id] = p.name; });

    setResults({
      projects: projectsRes.data || [],
      folders: foldersRes.data || [],
      activities: (activitiesRes.data || []).map(a => ({ ...a, projectName: nameById[a.project_id] })),
      versions: (versionsRes.data || []).map(v => ({ ...v, projectName: nameById[v.project_id] })),
      schedule: (scheduleRes.data || []).map(s => ({ ...s, projectName: nameById[s.project_id] })),
      panel: (panelRes.data || []).map(p => ({ ...p, projectName: nameById[p.project_id] })),
    });
    setLoading(false);
  }, []);

  function handleChange(value) {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 350);
  }

  const totalResults = results
    ? results.projects.length + results.folders.length + results.activities.length + results.versions.length + results.schedule.length + results.panel.length
    : 0;

  return (
    <div className="overlay">
      <div className="modal wide">
        <h3>Buscar</h3>
        <input
          ref={inputRef}
          value={query}
          onChange={e => handleChange(e.target.value)}
          placeholder="Digite pra buscar em projetos, atividades, tarefas, cronograma..."
        />

        {loading && <Spinner />}

        {!loading && results && totalResults === 0 && (
          <p className="empty-state">Nenhum resultado pra "{query}".</p>
        )}

        {!loading && results && totalResults > 0 && (
          <div className="search-results">
            {results.projects.length > 0 && (
              <div className="search-group">
                <h4>Projetos</h4>
                {results.projects.map(p => (
                  <div key={p.id} className="search-result-row" onClick={() => onNavigate({ type: 'project', projectId: p.id })}>
                    📁 {p.name}
                  </div>
                ))}
              </div>
            )}
            {results.folders.length > 0 && (
              <div className="search-group">
                <h4>Pastas</h4>
                {results.folders.map(f => (
                  <div key={f.id} className="search-result-row">🗂️ {f.name}</div>
                ))}
              </div>
            )}
            {results.activities.length > 0 && (
              <div className="search-group">
                <h4>Atividades</h4>
                {results.activities.map(a => (
                  <div key={a.id} className="search-result-row" onClick={() => onNavigate({ type: 'project', projectId: a.project_id, tab: 'activities' })}>
                    <strong>{a.title || a.description?.slice(0, 40) || '(sem título)'}</strong>
                    <small> · {a.projectName} · {a.person_name}</small>
                  </div>
                ))}
              </div>
            )}
            {results.versions.length > 0 && (
              <div className="search-group">
                <h4>Tarefas (Kanban)</h4>
                {results.versions.map(v => (
                  <div key={v.id} className="search-result-row" onClick={() => onNavigate({ type: 'project', projectId: v.project_id, tab: 'kanban' })}>
                    <strong>{v.title}</strong>
                    <small> · {v.projectName} · {v.requester_name}</small>
                  </div>
                ))}
              </div>
            )}
            {results.schedule.length > 0 && (
              <div className="search-group">
                <h4>Cronograma</h4>
                {results.schedule.map(s => (
                  <div key={s.id} className="search-result-row" onClick={() => onNavigate({ type: 'project', projectId: s.project_id, tab: 'schedule' })}>
                    <strong>{s.name}</strong>
                    <small> · {s.projectName}</small>
                  </div>
                ))}
              </div>
            )}
            {results.panel.length > 0 && (
              <div className="search-group">
                <h4>Diagramas</h4>
                {results.panel.map(p => (
                  <div key={p.id} className="search-result-row" onClick={() => onNavigate({ type: 'project', projectId: p.project_id, tab: 'kanban' })}>
                    <strong>{p.title}</strong>
                    <small> · {p.projectName}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="actions">
          <button className="secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}