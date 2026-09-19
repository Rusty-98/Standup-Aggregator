import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
  const [user, setUser] = useState<User | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      setLoading(true);
      const res = await fetchApi<MeResponse>('/api/me');
      setUser(res.user);
      setTeam(res.team);
    } catch (e) {
      setUser(null);
      setTeam(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '13px'
        }}
      >
        Authenticating SyncPulse session…
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--canvas)' }}>
      {user && (
        <Navbar
          user={user}
          team={team}
          onLogout={() => {
            setUser(null);
            setTeam(null);
          }}
        />
      )}

      <Routes>
        <Route
          path="/signin"
          element={
            user ? (
              <Navigate to="/today" replace />
            ) : (
              <SignInPage
                onSignedIn={(u, t) => {
                  setUser(u);
                  setTeam(t);
                }}
              />
            )
          }
        />

        <Route
          path="/today"
          element={user ? <TodayPage currentUser={user} /> : <Navigate to="/signin" replace />}
        />

        <Route
          path="/team"
          element={user ? <TeamPage currentUser={user} /> : <Navigate to="/signin" replace />}
        />

        <Route
          path="/leave"
          element={user ? <LeavePage currentUser={user} /> : <Navigate to="/signin" replace />}
        />

        <Route
          path="/recap"
          element={user ? <WeeklyRecapPage currentUser={user} /> : <Navigate to="/signin" replace />}
        />

        <Route
          path="/admin"
          element={
            user && user.role === 'admin' ? (
              <AdminPage />
            ) : user ? (
              <Navigate to="/today" replace />
            ) : (
              <Navigate to="/signin" replace />
            )
          }
        />

        <Route path="*" element={<Navigate to={user ? "/today" : "/signin"} replace />} />
      </Routes>
    </div>
  );
};
