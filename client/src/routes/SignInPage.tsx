import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchApi, ApiError } from '../lib/api.js';
import { User, Team } from '@shared/types.js';
import { friendlyError } from '../lib/labels.js';

interface SignInPageProps {
  onSignedIn: (user: User, team: Team | null) => void;
}

export const SignInPage: React.FC<SignInPageProps> = ({ onSignedIn }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');

  const safeRedirect = (role: string) => {
    const home = role === 'admin' ? '/admin' : '/today';
    if (!redirect || !redirect.startsWith('/') || redirect.startsWith('//') || redirect.startsWith('/signin')) {
      return home;
    }
    if (role !== 'admin' && redirect.startsWith('/admin')) return '/today';
    return redirect;
  };

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const wantsAdmin = Boolean(redirect?.startsWith('/admin'));
  const [bootstrapOpen, setBootstrapOpen] = useState(false);

  useEffect(() => {
    const t = document.documentElement.getAttribute('data-theme');
    setTheme(t === 'light' ? 'light' : 'dark');
  }, []);

  useEffect(() => {
    if (!wantsAdmin) return;
    fetchApi<{ open: boolean }>('/api/auth/bootstrap')
      .then(res => setBootstrapOpen(Boolean(res.open)))
      .catch(() => setBootstrapOpen(false));
  }, [wantsAdmin]);

  const sendCode = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await fetchApi('/api/auth/request-code', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          bootstrap: wantsAdmin && bootstrapOpen
        })
      });
      setStep('code');
      setInfo('Check your inbox (and spam). The code expires in about 10 minutes.');
    } catch (err) {
      setError(friendlyError(err instanceof ApiError ? err : err, 'Could not send the code. Try again in a minute.'));
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendCode();
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetchApi<{ user: User; team: Team | null }>('/api/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
          remember
        })
      });

      onSignedIn(res.user, res.team);
      navigate(safeRedirect(res.user.role));
    } catch (err) {
      setError(friendlyError(err instanceof ApiError ? err : err, 'That code is incorrect or expired. Request a new one.'));
    } finally {
      setLoading(false);
    }
  };

  const logoPlate = theme === 'dark'
    ? { background: '#ffffff', borderRadius: '12px', padding: '12px 16px', marginBottom: '14px' }
    : { background: 'var(--surface-1)', border: '1px solid var(--border-default)', borderRadius: '12px', padding: '12px 16px', marginBottom: '14px' };

  return (
    <div
      className="page-enter"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--canvas)'
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: '380px', padding: '28px' }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={logoPlate}>
            <img src="/logo.png" alt="Dailies. Small updates. A stronger team." style={{ display: 'block', width: '100%', height: 'auto' }} />
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {step === 'email'
              ? (wantsAdmin && bootstrapOpen
                ? 'Create the first admin account. After this, signup on this URL stays closed.'
                : wantsAdmin
                  ? 'Admin sign-in. Members are sent to their update page.'
                  : 'Enter your company email to receive a login code.')
              : `Enter the 6-digit code sent to ${email}`}
          </p>
        </div>

        {error && <div className="alert alert-err" style={{ marginBottom: 16 }}>{error}</div>}
        {info && !error && <div className="alert alert-ok" style={{ marginBottom: 16 }}>{info}</div>}

        {step === 'email' ? (
          <form onSubmit={handleRequestCode} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="field">
              <label className="field-label" htmlFor="signin-email">Work email</label>
              <input
                id="signin-email"
                type="email"
                required
                placeholder="name@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading || !email.trim()} style={{ width: '100%', marginTop: '4px' }}>
              {loading ? 'Sending code…' : wantsAdmin && bootstrapOpen ? 'Create admin account' : 'Continue with email'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="field">
              <label className="field-label" htmlFor="signin-code">6-digit verification code</label>
              <input
                id="signin-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                placeholder="123456"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
                className="tabular-nums"
                style={{
                  textAlign: 'center',
                  fontSize: '18px',
                  letterSpacing: '6px',
                  fontWeight: 600
                }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
              Keep me signed in for 30 days
            </label>

            <button type="submit" className="btn-primary" disabled={loading || code.length !== 6} style={{ width: '100%' }}>
              {loading ? 'Verifying…' : 'Verify & Sign in'}
            </button>

            <button
              type="button"
              className="btn-secondary btn-compact"
              disabled={loading}
              onClick={() => sendCode()}
              style={{ width: '100%' }}
            >
              Resend code
            </button>

            <button
              type="button"
              className="btn-secondary btn-compact"
              onClick={() => { setStep('email'); setCode(''); setError(null); setInfo(null); }}
              style={{ width: '100%' }}
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
