import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from './Toast';
import Spinner from './Spinner';
import { buildVersionLabel } from '../utils/versioning';

const LEVEL_LABEL = { grande: 'Grande', media: 'Média', minima: 'Mínima' };

function inputWidthCh(value) {
  const len = String(value ?? '').length;
  return Math.max(2, len + 1) + 'ch';
}

export default function ProjectVersionModal({ projectId, onClose }) {
  const showToast = useToast();
  const [project, setProject] = useState(null);
  const [pendingCounts, setPendingCounts] = useState({ grande: 0, media: 0, minima: 0 });
  const [bumps, setBumps] = useState([]);
  const [bumpItemsByBumpId, setBumpItemsByBumpId] = useState({});
  const [expandedBumpId, setExpandedBumpId] = useState(null);
  const [versionColumnName, setVersionColumnName] = useState(null);
  const [thresholds, setThresholds] = useState({ grande: 1, media: 1, minima: 1 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [projRes, pendingRes, bumpsRes, colRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('version_pending_items').select('level').eq('project_id', projectId),
      supabase.from('version_bumps').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('kanban_columns').select('name').eq('project_id', projectId).eq('is_version_column', true).maybeSingle(),
    ]);
    if (projRes.error) { alert('Erro ao carregar versão: ' + projRes.error.message); setLoading(false); return; }

    setProject(projRes.data);
    setThresholds({
      grande: projRes.data.version_threshold_grande,
      media: projRes.data.version_threshold_media,
      minima: projRes.data.version_threshold_minima,
    });

    const counts = { grande: 0, media: 0, minima: 0 };
    (pendingRes.data || []).forEach(p => { counts[p.level] = (counts[p.level] || 0) + 1; });
    setPendingCounts(counts);

    setBumps(bumpsRes.data || []);
    setVersionColumnName(colRes.data?.name || null);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function loadBumpItems(bumpId) {
    if (bumpItemsByBumpId[bumpId]) return;
    const { data, error } = await supabase.from('version_bump_items').select('*').eq('version_bump_id', bumpId);
    if (error) { alert('Erro ao carregar itens da versão: ' + error.message); return; }
    setBumpItemsByBumpId(prev => ({ ...prev, [bumpId]: data }));
  }

  function toggleBump(bumpId) {
    setExpandedBumpId(prev => (prev === bumpId ? null : bumpId));
    loadBumpItems(bumpId);
  }

  async function saveThresholds() {
    const { error } = await supabase.from('projects').update({
      version_threshold_grande: Math.max(1, Number(thresholds.grande) || 1),
      version_threshold_media: Math.max(1, Number(thresholds.media) || 1),
      version_threshold_minima: Math.max(1, Number(thresholds.minima) || 1),
    }).eq('id', projectId);
    if (error) { alert('Erro ao salvar configuração: ' + error.message); return; }
    showToast('Configuração de versão salva');
    load();
  }

  if (loading || !project) {
    return (
      <div className="overlay">
        <div className="modal"><Spinner /></div>
      </div>
    );
  }

  return (
    <div className="overlay">
      <div className="modal wide">
        <h3>Versão do projeto</h3>

        <div className="version-current-display">v{buildVersionLabel(project)}</div>

        <p className="version-column-hint">
          {versionColumnName
            ? <>Coluna de versão no quadro: <strong>{versionColumnName}</strong></>
            : 'Nenhuma coluna marcada como "quadro de versão" ainda. Configure isso clicando no nome de uma coluna, em Tarefas.'}
        </p>

        <div className="version-levels-grid">
          {['grande', 'media', 'minima'].map(level => (
            <div key={level} className="version-level-box">
              <strong>{LEVEL_LABEL[level]}</strong>
              <div className="version-progress-row">
                <span>{pendingCounts[level]} /</span>
                <input
                  type="number"
                  min="1"
                  value={thresholds[level]}
                  onChange={e => setThresholds(t => ({ ...t, [level]: e.target.value }))}
                  style={{ width: inputWidthCh(thresholds[level]) }}
                />
              </div>
              <small>itens acumulados / necessários</small>
            </div>
          ))}
        </div>
        <button className="secondary small" onClick={saveThresholds}>Salvar configuração</button>

        <h4 className="version-history-title">Histórico de versões</h4>
        {bumps.length === 0 ? (
          <p className="empty-state">Nenhuma atualização de versão ainda.</p>
        ) : (
          <div className="version-history-list">
            {bumps.map(b => (
              <div key={b.id} className="version-history-item">
                <div className="version-history-row" onClick={() => toggleBump(b.id)}>
                  <span>{expandedBumpId === b.id ? '▾' : '▸'}</span>
                  <strong>v{b.version_label}</strong>
                  <span className={'complexity-tag ' + b.level}>{LEVEL_LABEL[b.level]}</span>
                  <small>{new Date(b.created_at).toLocaleDateString('pt-BR')}</small>
                </div>
                {expandedBumpId === b.id && (
                  <ul className="version-history-items-list">
                    {(bumpItemsByBumpId[b.id] || []).map(item => (
                      <li key={item.id}>{item.item_title}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="actions">
          <button className="secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}