import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, Team } from '@shared/types.js';
import { fetchApi } from '../../lib/api.js';
import { Sun, Moon, LogOut } from 'lucide-react';

interface NavbarProps {
  user: User;
  team: Team | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, team, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [countdown, setCountdown] = useState<string>('');

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null;
    const initial = saved || 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  // 20:00 cutoff countdown
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      // Target 20:00 today
      const target = new Date(now);
      target.setHours(20, 0, 0, 0);

      const diff = target.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdown('cutoff reached');
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setCountdown(`${hours}h ${mins}m to 20:00`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSignOut = async () => {
    try {
      await fetchApi('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    onLogout();
    navigate('/signin');
  };

  const navItems = [
    { label: 'Today', path: '/today' },
    { label: 'Team', path: '/team' },
    { label: 'Leave', path: '/leave' },
    { label: 'Recap', path: '/recap' },
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
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
        <Link to="/today" style={{ textDecoration: 'none', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600, fontSize: '15px', letterSpacing: '-0.02em' }}>SyncPulse</span>
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
              marginLeft: '8px',
              paddingLeft: '12px',
              borderLeft: '1px solid var(--border-default)'
            }}
          >
            <span className="status-dot status-dot-warning" />
            <span>{countdown}</span>
          </div>
        )}
      </div>

      {/* Center Nav Links */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                border: isActive ? 'none' : '1px solid transparent'
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={toggleTheme}
          className="btn-secondary btn-compact"
          style={{ width: '28px', height: '28px', padding: 0 }}
          title="Toggle color theme"
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 500 }}>{user.name}</span>
          <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
            {user.role}
          </span>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="btn-secondary btn-compact"
          style={{ width: '28px', height: '28px', padding: 0, marginLeft: '4px' }}
          title="Sign out"
        >
          <LogOut size={13} />
        </button>
      </div>
    </header>
  );
};
