import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../Toast';
import Spinner from '../Spinner';

export default function HolidaySettingsModal({ onClose, onSaved }) {
  const showToast = useToast();
  const [settings, setSettings] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newDate, setNewDate] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const load = useCallback(async () => {
    const [settingsRes, holidaysRes] = await Promise.all([
      supabase.from('schedule_settings').select('*').eq('id', 1).single(),
      supabase.from('holidays').select('*').order('date', { ascending: true }),
    ]);
    if (settingsRes.error) { alert('Erro ao carregar configurações: ' + settingsRes.error.message); setLoading(false); return; }
    setSettings(settingsRes.data);
    setHolidays(holidaysRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveSettings() {
    const { error } = await supabase.from('schedule_settings').update({
      daily_working_hours: settings.daily_working_hours,
      saturday_is_business_day: settings.saturday_is_business_day,
      sunday_is_business_day: settings.sunday_is_business_day,
      use_national_holidays: settings.use_national_holidays,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    showToast('Configurações salvas');
    onSaved();
  }

  async function addHoliday() {
    if (!newDate || !newLabel.trim()) { alert('Preencha data e nome do feriado.'); return; }
    const { error } = await supabase.from('holidays').insert({ date: newDate, label: newLabel.trim() });
    if (error) { alert('Erro ao adicionar feriado: ' + error.message); return; }
    setNewDate(''); setNewLabel('');
    load();
    onSaved();
  }

  async function removeHoliday(holiday) {
    const { error } = await supabase.from('holidays').delete().eq('id', holiday.id);
    if (error) { alert('Erro ao remover feriado: ' + error.message); return; }
    load();
    onSaved();
  }

  if (loading || !settings) {
    return <div className="overlay"><div className="modal"><Spinner /></div></div>;
  }

  return (
    <div className="overlay">
      <div className="modal wide">
        <h3>Calendário e dias úteis</h3>
        <p className="version-column-hint">
          As três regras abaixo valem para <strong>todas</strong> as tarefas com duração em Dias ou Semanas.
        </p>

        <label className="checkbox-row">
          <input type="checkbox" checked={settings.saturday_is_business_day} onChange={e => setSettings(s => ({ ...s, saturday_is_business_day: e.target.checked }))} />
          Sábado conta como dia útil
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={settings.sunday_is_business_day} onChange={e => setSettings(s => ({ ...s, sunday_is_business_day: e.target.checked }))} />
          Domingo conta como dia útil
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={settings.use_national_holidays} onChange={e => setSettings(s => ({ ...s, use_national_holidays: e.target.checked }))} />
          Considerar feriados nacionais automaticamente (inclui Carnaval e Corpus Christi)
        </label>

        <label>Horas/dia sugeridas ao cadastrar um novo recurso</label>
        <input
          type="number" min="1" step="0.5"
          value={settings.daily_working_hours}
          onChange={e => setSettings(s => ({ ...s, daily_working_hours: Number(e.target.value) || 8 }))}
        />

        <button className="secondary small" onClick={saveSettings}>Salvar configurações</button>

        <h4 className="version-history-title">Feriados personalizados</h4>
        <div className="row">
          <div>
            <label>Data</label>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
          </div>
          <div>
            <label>Nome</label>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Ex: Aniversário da cidade" />
          </div>
        </div>
        <button className="secondary small" onClick={addHoliday}>+ Adicionar feriado</button>

        {holidays.length === 0 ? (
          <p className="empty-state">Nenhum feriado personalizado cadastrado.</p>
        ) : (
          <div className="version-history-list">
            {holidays.map(h => (
              <div key={h.id} className="trash-row">
                <div className="trash-row-info"><strong>{h.label}</strong><small>{h.date.split('-').reverse().join('/')}</small></div>
                <button className="icon-btn delete-col" onClick={() => removeHoliday(h)}>✕</button>
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