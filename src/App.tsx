import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navigation from './components/Navigation';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewRecord from './pages/NewRecord';
import PreventiveChecklist from './pages/PreventiveChecklist';
import BatteryRecharge from './pages/BatteryRecharge';
import History from './pages/History';
import TeamManagement from './pages/TeamManagement';
import ManageUsers from './pages/ManageUsers';

function AppContent() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<
    'dashboard' | 'new-record' | 'preventive-checklist' | 'battery-recharge' | 'history' | 'team-management' | 'manage-users'
  >('preventive-checklist');

  // Automatically select default screen based on authorization role
  React.useEffect(() => {
    if (user) {
      if (user.role === 'gerente' || user.role === 'master') {
        setTab('dashboard');
      } else {
        setTab('preventive-checklist');
      }
    }
  }, [user]);

  // Loading indicator for active auth check
  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#f8fafc]">
        <div className="w-10 h-10 border-4 border-[#1e3a8a] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-[#1e3a8a] uppercase tracking-widest mt-4">Carregando TKF LogiCheck...</p>
      </div>
    );
  }

  // Not authenticated? Render secure sign-in page
  if (!user) {
    return <Login />;
  }

  // Render main screen according to active tab coordinates
  return (
    <Navigation currentTab={tab} setTab={setTab}>
      {tab === 'dashboard' && <Dashboard />}
      {tab === 'new-record' && <NewRecord />}
      {tab === 'preventive-checklist' && <PreventiveChecklist />}
      {tab === 'battery-recharge' && <BatteryRecharge />}
      {tab === 'history' && <History />}
      {tab === 'team-management' && <TeamManagement />}
      {tab === 'manage-users' && <ManageUsers />}
    </Navigation>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
