import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { User, Team, MeResponse } from '@shared/types.js';
import { fetchApi } from './lib/api.js';
import { Navbar } from './components/layout/Navbar.js';
import { SignInPage } from './routes/SignInPage.js';
import { TodayPage } from './routes/TodayPage.js';
import { TeamPage } from './routes/TeamPage.js';
import { LeavePage } from './routes/LeavePage.js';
import { AdminPage } from './routes/AdminPage.js';
import { WeeklyRecapPage } from './routes/WeeklyRecapPage.js';

export const App: React.FC = () => {
  const location = useLocation();

  // Stale-while-revalidate: instant render from cached session if present
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem('dailies_cached_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [team, setTeam] = useState<Team | null>(() => {
    try {
      const cached = localStorage.getItem('dailies_cached_team');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [orgTimezone, setOrgTimezone] = useState<string>(() => localStorage.getItem('dailies_org_tz') || 'Asia/Kolkata');
  const [cutoff, setCutoff] = useState<string>(() => localStorage.getItem('dailies_cutoff') || '20:00');

  const isSignInPath = typeof window !== 'undefined' && window.location.pathname === '/signin';
  const [loading, setLoading] = useState<boolean>(() => !user && !isSignInPath);

  const checkAuth = async () => {
    try {
      const res = await fetchApi<MeResponse>('/api/me', { timeoutMs: 6000 }).catch(() => {
        return fetchApi<MeResponse>('/api/auth/me', { timeoutMs: 6000 });
      });

      setUser(res.user);
      setTeam(res.team);
      const tz = res.orgTimezone || 'Asia/Kolkata';
      const cut = res.cutoff || res.team?.digest_time || '20:00';
      setOrgTimezone(tz);
      setCutoff(cut);

      localStorage.setItem('dailies_cached_user', JSON.stringify(res.user));
      localStorage.setItem('dailies_org_tz', tz);
      localStorage.setItem('dailies_cutoff', cut);
      if (res.currentOrgDate) {
        localStorage.setItem('dailies_org_date', res.currentOrgDate);
      }
      if (res.team) {
        localStorage.setItem('dailies_cached_team', JSON.stringify(res.team));
      }
    } catch (e) {
      setUser(null);
      setTeam(null);
      localStorage.removeItem('dailies_cached_user');
      localStorage.removeItem('dailies_cached_team');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleSignedIn = (u: User, t: Team | null) => {
    setUser(u);
    setTeam(t);
    localStorage.setItem('dailies_cached_user', JSON.stringify(u));
    if (t) {
      localStorage.setItem('dailies_cached_team', JSON.stringify(t));
      if (t.digest_time) {
        setCutoff(t.digest_time);
        localStorage.setItem('dailies_cutoff', t.digest_time);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await fetchApi('/api/auth/logout', { method: 'POST', timeoutMs: 2000 });
    } catch {}
    setUser(null);
    setTeam(null);
    localStorage.removeItem('dailies_cached_user');
    localStorage.removeItem('dailies_cached_team');
    localStorage.removeItem('dailies_org_date');
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          background: 'var(--canvas)',
          color: 'var(--text-muted)',
          fontSize: '13px'
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            border: '2.5px solid var(--border-strong)',
            borderTopColor: 'var(--accent)',
            animation: 'spin 0.6s linear infinite'
          }}
        />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const signinRedirectUrl = `/signin?redirect=${encodeURIComponent(location.pathname + location.search)}`;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--canvas)' }}>
      {user && (
        <Navbar
          user={user}
          team={team}
          cutoff={cutoff}
          orgTimezone={orgTimezone}
          onLogout={handleLogout}
        />
      )}

      <Routes>
        <Route
          path="/signin"
          element={
            user ? (
              <Navigate to={user.role === 'admin' ? '/admin' : '/today'} replace />
            ) : (
              <SignInPage onSignedIn={handleSignedIn} />
            )
          }
        />

        <Route
          path="/today"
          element={user ? <TodayPage currentUser={user} /> : <Navigate to={signinRedirectUrl} replace />}
        />

        <Route
          path="/team"
          element={user ? <TeamPage currentUser={user} /> : <Navigate to={signinRedirectUrl} replace />}
        />

        <Route
          path="/leave"
          element={user ? <LeavePage currentUser={user} /> : <Navigate to={signinRedirectUrl} replace />}
        />

        <Route
          path="/recap"
          element={user ? <WeeklyRecapPage currentUser={user} /> : <Navigate to={signinRedirectUrl} replace />}
        />

        <Route
          path="/admin"
          element={
            user && user.role === 'admin' ? (
              <AdminPage />
            ) : user ? (
              <Navigate to="/today" replace />
            ) : (
              <Navigate to={signinRedirectUrl} replace />
            )
          }
        />

        <Route path="*" element={<Navigate to={user ? (user.role === 'admin' ? '/admin' : '/today') : signinRedirectUrl} replace />} />
      </Routes>
    </div>
  );
};
