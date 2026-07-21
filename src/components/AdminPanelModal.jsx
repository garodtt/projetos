import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from './Toast';
import Spinner from './Spinner';

export default function AdminPanelModal({ onClose }) {
  const showToast = useToast();
  const [profiles, setProfiles] = useState([]);
  const [areas, setAreas] = useState([]);
  const [userAreas, setUserAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newAreaName, setNewAreaName] = useState('');
  const [areaPopupForId, setAreaPopupForId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [profilesRes, areasRes, userAreasRes] = await Promise.all([
      supabase.from('user_profiles').select('*').order('email', { ascending: true }),
      supabase.from('areas').select('*').order('name', { ascending: true }),
      supabase.from('user_areas').select('*'),
    ]);
    if (profilesRes.error) { alert('Erro ao carregar usuários: ' + profilesRes.error.message); setLoading(false); return; }
    if (areasRes.error) { alert('Erro ao carregar áreas: ' + areasRes.error.message); setLoading(false); return; }
    setProfiles(profilesRes.data || []);
    setAreas(areasRes.data || []);
    setUserAreas(userAreasRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const areaIdsByUser = useMemo(() => {
    const map = {};
    userAreas.forEach(ua => {
      if (!map[ua.user_id]) map[ua.user_id] = new Set();
      map[ua.user_id].add(ua.area_id);
    });
    return map;
  }, [userAreas]);

  function summarizeAreas(profile) {
    const ids = areaIdsByUser[profile.id];
    if (!ids || ids.size === 0) return 'Nenhuma área';
    const names = areas.filter(a => ids.has(a.id)).map(a => a.name);
    if (names.length <= 2) return names.join(', ');
    return names.slice(0, 2).join(', ') + ' +' + (names.length - 2);
  }

  async function handleRoleChange(profile, newRole) {
    if (profile.role === 'admin' && newRole === 'usuario') {
      const remainingAdmins = profiles.filter(p => p.role === 'admin' && p.id !== profile.id).length;
      if (remainingAdmins === 0) {
        alert('Não dá pra rebaixar — precisa sobrar pelo menos 1 admin no sistema.');
        return;
      }
    }
    const { error } = await supabase.from('user_profiles').update({ role: newRole }).eq('id', profile.id);
    if (error) { alert('Erro ao mudar papel: ' + error.message); return; }
    setProfiles(prev => prev.map(p => (p.id === profile.id ? { ...p, role: newRole } : p)));
    showToast('Papel de ' + profile.email + ' atualizado');
  }

  async function handleToggleArea(profile, area, checked) {
    if (checked) {
      const { error } = await supabase.from('user_areas').insert({ user_id: profile.id, area_id: area.id });
      if (error) { alert('Erro ao atribuir área: ' + error.message); return; }
      setUserAreas(prev => [...prev, { user_id: profile.id, area_id: area.id }]);
    } else {
      const { error } = await supabase.from('user_areas').delete().eq('user_id', profile.id).eq('area_id', area.id);
      if (error) { alert('Erro ao remover área: ' + error.message); return; }
      setUserAreas(prev => prev.filter(ua => !(ua.user_id === profile.id && ua.area_id === area.id)));
    }
  }

  async function handleAddArea() {
    const name = newAreaName.trim();
    if (!name) return;
    const { data, error } = await supabase.from('areas').insert({ name }).select().single();
    if (error) { alert('Erro ao criar área: ' + error.message); return; }
    setAreas(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewAreaName('');
  }

  async function handleRenameArea(area) {
    const newName = prompt('Novo nome da área:', area.name);
    if (!newName || !newName.trim() || newName.trim() === area.name) return;
    const { error } = await supabase.from('areas').update({ name: newName.trim() }).eq('id', area.id);
    if (error) { alert('Erro ao renomear: ' + error.message); return; }
    setAreas(prev => prev.map(a => (a.id === area.id ? { ...a, name: newName.trim() } : a)).sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function handleDeleteArea(area) {
    if (area.name === 'Geral') { alert('A área "Geral" não pode ser excluída — é o destino padrão de projeto sem área.'); return; }

    const { count } = await supabase.from('projects').select('id', { count: 'exact', head: true }).eq('area_id', area.id);
    if (count > 0) {
      const proceed = confirm(`${count} projeto(s) está(ão) na área "${area.name}". Excluir vai mover esse(s) projeto(s) pra "Geral". Continuar?`);
      if (!proceed) return;
      const geral = areas.find(a => a.name === 'Geral');
      const { error: moveError } = await supabase.from('projects').update({ area_id: geral.id }).eq('area_id', area.id);
      if (moveError) { alert('Erro ao mover projetos: ' + moveError.message); return; }
    }

    const { error } = await supabase.from('areas').delete().eq('id', area.id);
    if (error) { alert('Erro ao excluir área: ' + error.message); return; }
    load();
  }

  if (loading) {
    return <div className="overlay"><div className="modal"><Spinner /></div></div>;
  }

  return (
    <div className="overlay">
      <div className="modal wide">
        <h3>⚙️ Administração</h3>

        <h4 className="admin-section-title">Áreas</h4>
        <div className="admin-areas-list">
          {areas.map(area => (
            <span key={area.id} className="admin-area-chip">
              {area.name}
              {area.name !== 'Geral' && (
                <>
                  <button type="button" onClick={() => handleRenameArea(area)} title="Renomear área">✎</button>
                  <button type="button" onClick={() => handleDeleteArea(area)} title="Excluir área">×</button>
                </>
              )}
            </span>
          ))}
        </div>
        <div className="admin-add-area-row">
          <input
            type="text"
            placeholder="Nome da área nova (ex: TI, Comercial)"
            value={newAreaName}
            onChange={e => setNewAreaName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddArea(); } }}
          />
          <button type="button" className="secondary small" onClick={handleAddArea}>+ Adicionar área</button>
        </div>

        <h4 className="admin-section-title">Usuários</h4>
        <p className="version-column-hint">
          Papel <strong>Admin</strong> enxerga todas as áreas automaticamente, então não tem seletor de área pra esse papel.
        </p>
        <div className="admin-users-table-wrap">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>E-mail</th>
                <th>Papel</th>
                <th>Áreas</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(profile => (
                <tr key={profile.id}>
                  <td>{profile.email}</td>
                  <td>
                    <select value={profile.role} onChange={e => handleRoleChange(profile, e.target.value)}>
                      <option value="usuario">Usuário</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    {profile.role === 'admin' ? (
                      <span className="admin-area-summary muted" title="Admin já vê todas as áreas automaticamente">Todas (admin)</span>
                    ) : (
                      <button
                        type="button"
                        className="secondary small"
                        onClick={() => setAreaPopupForId(profile.id)}
                      >
                        {summarizeAreas(profile)} ▾
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="actions">
          <button className="secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>

      {areaPopupForId && (
        <AreaAssignmentPopup
          profile={profiles.find(p => p.id === areaPopupForId)}
          areas={areas}
          assignedIds={areaIdsByUser[areaPopupForId] || new Set()}
          onToggle={(area, checked) => handleToggleArea(profiles.find(p => p.id === areaPopupForId), area, checked)}
          onClose={() => setAreaPopupForId(null)}
        />
      )}
    </div>
  );
}

function AreaAssignmentPopup({ profile, areas, assignedIds, onToggle, onClose }) {
  const [pickAvailable, setPickAvailable] = useState([]);
  const [pickAssigned, setPickAssigned] = useState([]);

  const available = areas.filter(a => !assignedIds.has(a.id));
  const assigned = areas.filter(a => assignedIds.has(a.id));

  function moveToAssigned() {
    pickAvailable.forEach(id => {
      const area = areas.find(a => a.id === id);
      if (area) onToggle(area, true);
    });
    setPickAvailable([]);
  }

  function moveToAvailable() {
    pickAssigned.forEach(id => {
      const area = areas.find(a => a.id === id);
      if (area) onToggle(area, false);
    });
    setPickAssigned([]);
  }

  return (
    <div className="overlay overlay-nested" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Áreas de {profile.email}</h3>

        <div className="dual-list">
          <div className="dual-list-col">
            <label>Áreas disponíveis</label>
            <select
              multiple
              size={8}
              value={pickAvailable}
              onChange={e => setPickAvailable(Array.from(e.target.selectedOptions, o => o.value))}
            >
              {available.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <div className="dual-list-buttons">
            <button type="button" className="secondary small" onClick={moveToAssigned} disabled={!pickAvailable.length}>
              Adicionar ▶
            </button>
            <button type="button" className="secondary small" onClick={moveToAvailable} disabled={!pickAssigned.length}>
              ◀ Remover
            </button>
          </div>

          <div className="dual-list-col">
            <label>Áreas atribuídas</label>
            <select
              multiple
              size={8}
              value={pickAssigned}
              onChange={e => setPickAssigned(Array.from(e.target.selectedOptions, o => o.value))}
            >
              {assigned.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>

        <div className="actions">
          <button className="secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}