import React, { useState, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navigation from './components/Navigation';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const NewRecord = lazy(() => import('./pages/NewRecord'));
const PreventiveChecklist = lazy(() => import('./pages/PreventiveChecklist'));
const BatteryRecharge = lazy(() => import('./pages/BatteryRecharge'));
const History = lazy(() => import('./pages/History'));
const TeamManagement = lazy(() => import('./pages/TeamManagement'));
const ManageUsers = lazy(() => import('./pages/ManageUsers'));

function AppContent() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<
    'dashboard' | 'new-record' | 'preventive-checklist' | 'battery-recharge' | 'history' | 'team-management' | 'manage-users'
  >('new-record');

  // All users land on the daily checklist after sign-in
  React.useEffect(() => {
    if (!loading && user) {
      setTab('new-record');
    }
  }, [user, loading]);

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
  const pageFallback = (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#f8fafc]">
      <div className="w-10 h-10 border-4 border-[#1e3a8a] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <Navigation currentTab={tab} setTab={setTab}>
      <Suspense fallback={pageFallback}>
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'new-record' && <NewRecord />}
        {tab === 'preventive-checklist' && <PreventiveChecklist />}
        {tab === 'battery-recharge' && <BatteryRecharge />}
        {tab === 'history' && <History />}
        {tab === 'team-management' && <TeamManagement />}
        {tab === 'manage-users' && <ManageUsers />}
      </Suspense>
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
