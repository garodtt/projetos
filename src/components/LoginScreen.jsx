import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function LoginScreen() {
  // 'login' | 'forgot' | 'forgot-sent'
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
      setLoading(false);
      return;
    }
    // Deu certo: o listener de sessão no App.jsx assume a partir daqui e troca
    // a tela sozinho — não precisa fazer nada além disso aqui.
  }

  async function handleForgotSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setMode('forgot-sent');
  }

  function goToMode(next) {
    setError('');
    setMode(next);
  }

  if (mode === 'forgot-sent') {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1 className="login-title">Verifique seu e-mail</h1>
          <p className="login-subtitle">
            Se <strong>{email.trim()}</strong> tiver uma conta no sistema, enviamos um link pra você criar uma senha nova.
          </p>
          <button type="button" className="secondary login-submit" onClick={() => goToMode('login')}>Voltar pro login</button>
        </div>
      </div>
    );
  }

  if (mode === 'forgot') {
    return (
      <div className="login-screen">
        <form className="login-card" onSubmit={handleForgotSubmit}>
          <h1 className="login-title">Redefinir senha</h1>
          <p className="login-subtitle">Digite seu e-mail. Enviamos um link pra você criar uma senha nova.</p>

          <label htmlFor="forgot-email">E-mail</label>
          <input
            id="forgot-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
            required
          />

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="primary login-submit" disabled={loading || !email}>
            {loading ? 'Enviando…' : 'Enviar link'}
          </button>
          <button type="button" className="login-link-btn" onClick={() => goToMode('login')}>Voltar pro login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1 className="login-title">Gestão de Projetos</h1>
        <p className="login-subtitle">Entre com sua conta pra continuar.</p>

        <label htmlFor="login-email">E-mail</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="username"
          autoFocus
          required
        />

        <label htmlFor="login-password">Senha</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        {error && <p className="login-error">{error}</p>}

        <button type="submit" className="primary login-submit" disabled={loading || !email || !password}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
        <button type="button" className="login-link-btn" onClick={() => goToMode('forgot')}>Esqueci minha senha</button>

        <p className="login-footnote">Não tem conta? Peça pra quem administra o sistema criar uma pra você.</p>
      </form>
    </div>
  );
}