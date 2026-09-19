import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchApi, ApiError } from '../lib/api.js';
import { User, Team } from '@shared/types.js';

interface SignInPageProps {
  onSignedIn: (user: User, team: Team | null) => void;
}

export const SignInPage: React.FC<SignInPageProps> = ({ onSignedIn }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/today';

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await fetchApi('/api/auth/request-code', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      setStep('code');
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
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
      navigate(redirect);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--canvas)'
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '380px',
          padding: '28px'
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.015em', marginBottom: '6px' }}>
            SyncPulse
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {step === 'email' ? 'Enter your company email to receive a login code.' : `Enter the 6-digit code sent to ${email}`}
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '8px 10px',
              border: '1px solid var(--semantic-danger)',
              borderRadius: 'var(--radius-control)',
              color: 'var(--semantic-danger)',
              fontSize: '12.5px',
              marginBottom: '16px'
            }}
          >
            {error}
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleRequestCode} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                Work email
              </label>
              <input
                type="email"
                required
                placeholder="name@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
                style={{ width: '100%' }}
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: '4px' }}>
              {loading ? 'Sending code…' : 'Continue with email'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                6-digit verification code
              </label>
              <input
                type="text"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                placeholder="123456"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
                className="tabular-nums"
                style={{
                  width: '100%',
                  textAlign: 'center',
                  fontSize: '18px',
                  letterSpacing: '6px',
                  fontWeight: 600
                }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Keep me signed in for 30 days
            </label>

            <button type="submit" className="btn-primary" disabled={loading || code.length !== 6} style={{ width: '100%' }}>
              {loading ? 'Verifying…' : 'Verify & Sign in'}
            </button>

            <button
              type="button"
              className="btn-secondary btn-compact"
              onClick={() => { setStep('email'); setCode(''); setError(null); }}
              style={{ width: '100%', marginTop: '2px' }}
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
