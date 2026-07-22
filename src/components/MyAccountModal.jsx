import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from './Toast';
import Spinner from './Spinner';
import { useModalShortcuts } from '../hooks/useModalShortcuts';

export default function MyAccountModal({ session, currentUserRole, onClose }) {
  const showToast = useToast();
  const [loadingAreas, setLoadingAreas] = useState(true);
  const [myAreas, setMyAreas] = useState([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useModalShortcuts(onClose, newPassword && confirmPassword ? handleChangePassword : null);

  useEffect(() => {
    if (currentUserRole === 'admin') { setLoadingAreas(false); return; }
    supabase.from('user_areas').select('areas(name)').eq('user_id', session.user.id).then(({ data, error: err }) => {
      if (err) { console.error(err); setLoadingAreas(false); return; }
      setMyAreas((data || []).map(row => row.areas?.name).filter(Boolean).sort());
      setLoadingAreas(false);
    });
  }, [currentUserRole, session.user.id]);

  async function handleChangePassword(e) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) { setError('A senha precisa ter pelo menos 6 caracteres.'); return; }
    if (newPassword !== confirmPassword) { setError('As senhas não são iguais.'); return; }
    setSaving(true);
    const { error: updError } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (updError) { setError(updError.message); return; }
    setNewPassword('');
    setConfirmPassword('');
    showToast('Senha atualizada');
  }

  return (
    <div className="overlay">
      <div className="modal">
        <h3>👤 Minha conta</h3>

        <label>E-mail</label>
        <input value={session.user.email} disabled />

        <label>Papel</label>
        <input value={currentUserRole === 'admin' ? 'Admin' : 'Usuário'} disabled />

        <label>Áreas que você enxerga</label>
        {currentUserRole === 'admin' ? (
          <p className="version-column-hint">Todas — papel Admin enxerga todas as áreas automaticamente.</p>
        ) : loadingAreas ? (
          <Spinner />
        ) : myAreas.length ? (
          <p className="version-column-hint">{myAreas.join(', ')}</p>
        ) : (
          <p className="version-column-hint">Nenhuma área atribuída ainda — peça pra um administrador te atribuir uma.</p>
        )}

        <hr className="my-account-divider" />

        <form onSubmit={handleChangePassword}>
          <label>Nova senha</label>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <label>Confirmar nova senha</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          {error && <p className="login-error">{error}</p>}
          <div className="actions">
            <button type="button" className="secondary" onClick={onClose}>Fechar</button>
            <button type="submit" className="primary" disabled={saving || !newPassword || !confirmPassword}>
              {saving ? 'Salvando…' : 'Trocar senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}