import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, Team } from '@shared/types.js';
import { fetchApi } from '../../lib/api.js';
import { formatHumanTime } from '../../lib/dateUtils.js';
import { ConfirmDialog } from '../ui/Modal.js';
import { Sun, Moon, LogOut } from 'lucide-react';

interface NavbarProps {
  user: User;
  team: Team | null;
  cutoff?: string;
  orgTimezone?: string;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, team, cutoff, orgTimezone, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });
  const [countdown, setCountdown] = useState<string>('');
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
  };

  useEffect(() => {
    const updateCountdown = () => {
      const targetTime = cutoff || team?.digest_time || '20:00';
      const [targetH, targetM] = targetTime.split(':').map(Number);
      const tz = orgTimezone || 'Asia/Kolkata';

      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(now);
      const curHRaw = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
      const curH = curHRaw === 24 ? 0 : curHRaw;
      const curM = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

      const nowMinutes = curH * 60 + curM;
      const targetMinutes = targetH * 60 + targetM;
      const diffMinutes = targetMinutes - nowMinutes;
      const human = formatHumanTime(targetTime, tz);

      if (diffMinutes <= 0) {
        setCountdown(`Digest locked · was ${human}`);
      } else {
        const hours = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;
        setCountdown(`${hours > 0 ? `${hours}h ` : ''}${mins}m until digest locks (${human})`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 15000);
    return () => clearInterval(interval);
  }, [cutoff, orgTimezone, team]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await fetchApi('/api/auth/logout', { method: 'POST' });
    } catch {
      /* still clear local session */
    }
    setSigningOut(false);
    setConfirmSignOut(false);
    onLogout();
    navigate('/signin');
  };

  const navItems = [
    { label: 'Today', path: '/today' },
    { label: 'Team', path: '/team' },
    { label: 'Recap', path: '/recap' },
    { label: 'Leave', path: '/leave' },
    ...(user.role === 'admin' ? [{ label: 'Admin', path: '/admin' }] : [])
  ];

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'var(--surface-1)',
        borderBottom: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-sticky)',
        minHeight: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexWrap: 'wrap',
        gap: '8px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Link to="/today" style={{ textDecoration: 'none', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/favicon.png" alt="Dailies" width={32} height={32} style={{ display: 'block', width: 32, height: 32 }} />
          {team && (
            <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
              {team.name}
            </span>
          )}
        </Link>

        {countdown && (
          <div
            className="tabular-nums"
            style={{
              fontSize: '11.5px',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginLeft: '6px',
              paddingLeft: '10px',
              borderLeft: '1px solid var(--border-default)'
            }}
          >
            <span className="status-dot status-dot-warning" />
            <span>{countdown}</span>
          </div>
        )}
      </div>

      <nav style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto', maxWidth: '100%' }} aria-label="Main">
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`btn-compact ${isActive ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                textDecoration: 'none',
                height: '28px',
                padding: '0 10px',
                fontSize: '12.5px',
                whiteSpace: 'nowrap',
                border: isActive ? 'none' : '1px solid transparent',
                transition: 'background-color var(--motion), color var(--motion)'
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          onClick={toggleTheme}
          className="btn-secondary btn-compact"
          style={{ width: '28px', height: '28px', padding: 0 }}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 500 }}>{user.name}</span>
          <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
            {user.role === 'admin' ? 'Admin' : 'Member'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setConfirmSignOut(true)}
          className="btn-secondary btn-compact"
          style={{ width: '28px', height: '28px', padding: 0, marginLeft: '4px' }}
          aria-label="Sign out"
        >
          <LogOut size={13} />
        </button>
      </div>

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out?"
        message="You will need your email code to sign in again."
        confirmLabel="Sign out"
        danger
        busy={signingOut}
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={handleSignOut}
      />
    </header>
  );
};
