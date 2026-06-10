import React, { useState } from 'react';
import { Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ChangePasswordProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export default function ChangePassword({ isOpen, onClose, showToast }: ChangePasswordProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (newPassword.length < 6) {
        return showToast('Senha deve ter no mínimo 6 caracteres.', 'error');
      }

      if (newPassword !== confirmPassword) {
        return showToast('As senhas não correspondem.', 'error');
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        return showToast(`Erro: ${error.message}`, 'error');
      }

      showToast('Senha alterada com sucesso! 🎉', 'success');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => onClose(), 1500);
    } catch (error: any) {
      showToast(`Erro inesperado: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0e131f] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5 text-[#4364f7]" />
            <h3 className="text-lg font-semibold text-white">Alterar Senha</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="tkf-label mb-2">Nova Senha</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="tkf-input w-full pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {newPassword && newPassword.length < 6 && (
              <p className="mt-1 text-xs text-amber-400">Mínimo 6 caracteres</p>
            )}
          </div>

          <div>
            <label className="tkf-label mb-2">Confirmar Senha</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="tkf-input w-full pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && newPassword === confirmPassword && (
              <p className="mt-1 text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Senhas correspondem
              </p>
            )}
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Senhas não correspondem
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-xl border border-white/10 bg-[#131a2c] text-white font-semibold py-2.5 transition-colors hover:bg-[#1a2438] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
              className="flex-1 tkf-btn-primary font-semibold py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Alterando...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" /> Alterar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
