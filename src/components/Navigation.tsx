import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LocalDb } from '../lib/db';
import { useToast } from '../hooks/useToast';
import { 
  LayoutDashboard, 
  ClipboardCheck,
  BatteryCharging,
  FilePlus2, 
  ClipboardList, 
  LogOut, 
  Download, 
  RefreshCw, 
  Smartphone,
  Users,
  Lock,
  ChevronDown
} from 'lucide-react';
import BrandMark from './BrandMark';
import ChangePassword from './ChangePassword';

interface NavigationProps {
  currentTab: 'dashboard' | 'new-record' | 'preventive-checklist' | 'battery-recharge' | 'history' | 'team-management' | 'manage-users';
  setTab: (tab: 'dashboard' | 'new-record' | 'preventive-checklist' | 'battery-recharge' | 'history' | 'team-management' | 'manage-users') => void;
  children: React.ReactNode;
}

export default function Navigation({ currentTab, setTab, children }: NavigationProps) {
  const { user, logout } = useAuth();
  const [syncCount, setSyncCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const { toast, showToast } = useToast();

  // Poll for offline sync cache count
  useEffect(() => {
    const updateSyncStatus = () => {
      setSyncCount(LocalDb.getSyncQueueLength());
    };

    updateSyncStatus();
    const interval = setInterval(updateSyncStatus, 5000);
    return () => clearInterval(interval);
  }, [currentTab]);

  // Handle PWA installation banner prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Check if already dismissed
      const dismissed = sessionStorage.getItem('pwa_banner_dismissed');
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome !== 'accepted') {
      sessionStorage.setItem('pwa_banner_dismissed', 'true');
    }
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const handleDismissBanner = () => {
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
    setShowInstallBanner(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    await LocalDb.processSyncQueue();
    setSyncCount(LocalDb.getSyncQueueLength());
    setSyncing(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-[#0f172a] font-sans">

      {/* Top clean header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/85 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark compact />
            <div>
              <h1 className="text-sm font-semibold leading-tight text-[#0f172a] select-none">TKF LogiCheck</h1>
              <p className="text-[10px] uppercase font-semibold text-[#2563eb] tracking-[0.14em]">Enterprise Operations</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {syncCount > 0 && (
              <button
                onClick={handleSync}
                disabled={syncing}
                title="Sincronizar dados pendentes com o Supabase"
                className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncCount} pendentes</span>
              </button>
            )}

            {user && (
              <div className="relative flex items-center gap-2 border-l border-slate-200 pl-3">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <div className="text-right">
                    <p className="max-w-[120px] truncate text-xs font-semibold text-[#0f172a]">{user.name}</p>
                    <p className="text-[9px] font-semibold leading-none text-slate-500">
                      {user.role === 'gerente' || user.role === 'master' ? 'Gestão' : 'Operação'}
                    </p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
                </button>

                {showProfileMenu && (
                  <div className="absolute top-full right-0 mt-2 w-48 rounded-lg border border-slate-200 bg-white shadow-lg z-50">
                    <button
                      onClick={() => {
                        setShowChangePassword(true);
                        setShowProfileMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-100 font-medium"
                    >
                      <Lock className="w-4 h-4" /> Alterar Senha
                    </button>
                    <button
                      onClick={() => {
                        logout();
                        setShowProfileMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-700 hover:bg-red-50 font-medium"
                    >
                      <LogOut className="w-4 h-4" /> Sair
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* PWA Mobile App Installation Prompt Banner */}
      {showInstallBanner && deferredPrompt && (
        <div className="relative z-30 flex items-center justify-between gap-3 border-b border-[#1e3a8a]/30 bg-[#0f172a] px-4 py-3 text-xs text-white">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-[#93C5FD] shrink-0" />
            <div>
              <p className="font-bold">Instalar TKF LogiCheck</p>
              <p className="text-[#94A3B8] text-[10px]">Acesso rápido, offline e melhor uso em campo.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDismissBanner}
              className="px-2.5 py-1 text-white opacity-70 hover:opacity-100 font-semibold"
            >
              Agora Não
            </button>
            <button
              onClick={handleInstallClick}
              className="bg-[#1e3a8a] hover:bg-[#152e72] text-white px-3 py-1.5 rounded font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instalar</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Scroll Canvas */}
      <main className="flex-grow pb-20 overflow-y-auto">
        {children}
      </main>

      {/* Primary Mobile Touchbar: Fixed to screen bottom, minimal, large tap points of 48px */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex h-full items-center overflow-x-auto px-1">
        {(user?.role === 'gerente' || user?.role === 'master') && (
          <button
            onClick={() => setTab('dashboard')}
            className={`min-w-[70px] h-full flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${currentTab === 'dashboard'
                ? 'text-[#1E3A8A] font-semibold'
                : 'text-[#6C797B] hover:text-[#1E3A8A]'
              }`}
          >
            <div className={`p-1 rounded-md transition-colors ${currentTab === 'dashboard' ? 'bg-[#EBF5FF]' : ''}`}>
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-wide">Dashboard</span>
          </button>
        )}

        <button
          onClick={() => setTab('preventive-checklist')}
          className={`min-w-[76px] h-full flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${currentTab === 'preventive-checklist'
              ? 'text-[#1E3A8A] font-semibold'
              : 'text-[#6C797B] hover:text-[#1E3A8A]'
            }`}
        >
          <div className={`p-1 rounded-md transition-colors ${currentTab === 'preventive-checklist' ? 'bg-[#EBF5FF]' : ''}`}>
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-wide">Preventivo</span>
        </button>

        <button
          onClick={() => setTab('new-record')}
          className={`min-w-[76px] h-full flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${currentTab === 'new-record'
              ? 'text-[#1E3A8A] font-semibold'
              : 'text-[#6C797B] hover:text-[#1E3A8A]'
            }`}
        >
          <div className={`p-1 rounded-md transition-colors ${currentTab === 'new-record' ? 'bg-[#EBF5FF]' : ''}`}>
            <FilePlus2 className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-wide">Novo Checklist</span>
        </button>

        <button
          onClick={() => setTab('battery-recharge')}
          className={`min-w-[76px] h-full flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${currentTab === 'battery-recharge'
              ? 'text-[#1E3A8A] font-semibold'
              : 'text-[#6C797B] hover:text-[#1E3A8A]'
            }`}
        >
          <div className={`p-1 rounded-md transition-colors ${currentTab === 'battery-recharge' ? 'bg-[#EBF5FF]' : ''}`}>
            <BatteryCharging className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-wide">Bateria</span>
        </button>

        <button
          onClick={() => setTab('history')}
          className={`min-w-[70px] h-full flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${currentTab === 'history'
              ? 'text-[#1E3A8A] font-semibold'
              : 'text-[#6C797B] hover:text-[#1E3A8A]'
            }`}
        >
          <div className={`p-1 rounded-md transition-colors ${currentTab === 'history' ? 'bg-[#EBF5FF]' : ''}`}>
            <ClipboardList className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-wide">Histórico</span>
        </button>

        {(user?.role === 'gerente' || user?.role === 'master') && (
          <button
            onClick={() => setTab('manage-users')}
            className={`min-w-[76px] h-full flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${currentTab === 'manage-users'
                ? 'text-[#1E3A8A] font-semibold'
                : 'text-[#6C797B] hover:text-[#1E3A8A]'
              }`}
          >
            <div className={`p-1 rounded-md transition-colors ${currentTab === 'manage-users' ? 'bg-[#EBF5FF]' : ''}`}>
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-wide font-medium">Operadores</span>
          </button>
        )}

        {(user?.role === 'gerente' || user?.role === 'master') && (
          <button
            onClick={() => setTab('team-management')}
            className={`min-w-[70px] h-full flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${currentTab === 'team-management'
                ? 'text-[#1E3A8A] font-semibold'
                : 'text-[#6C797B] hover:text-[#1E3A8A]'
              }`}
          >
            <div className={`p-1 rounded-md transition-colors ${currentTab === 'team-management' ? 'bg-[#EBF5FF]' : ''}`}>
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-wide font-medium">Equipe</span>
          </button>
        )}
        </div>
      </nav>

      <ChangePassword 
        isOpen={showChangePassword} 
        onClose={() => setShowChangePassword(false)} 
        showToast={showToast}
      />

    </div>
  );
}
