import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { Mail, Lock, UserPlus, AlertCircle, Loader2 } from 'lucide-react';

const MANAGERS = ['tgomes@tkf.com', 'ffrire@tkf.com', 'kayan@tkf.com', 'guilherme@tkf.com'];

export default function ManageUsers() {
  const { user } = useAuth();
  const { toast, showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: {
      email: '',
      password: ''
    },
    mode: 'onChange'
  });

  const emailValue = watch('email') || '';
  const passwordValue = watch('password') || '';

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      if (!data.email.endsWith('@tkf.com')) {
        return showToast('E-mail deve ser corporativo (@tkf.com).', 'error');
      }

      // 1. Criar usuário no Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            role: 'operador'
          }
        }
      });

      if (signUpError || !authData.user) {
        return showToast(`Erro ao cadastrar: ${signUpError?.message || 'Falha desconhecida'}`, 'error');
      }

      // 2. Inserir no perfis_usuarios com nivel_acesso: operador
      const { error: profileError } = await supabase
        .from('perfis_usuarios')
        .insert([
          {
            id: authData.user.id,
            email: data.email,
            nivel_acesso: 'operador',
            criado_em: new Date().toISOString()
          }
        ]);

      if (profileError) {
        return showToast(`Erro ao criar perfil: ${profileError.message}`, 'error');
      }

      showToast(`Operador ${data.email} cadastrado com sucesso!`);
      reset();
    } catch (error: any) {
      showToast(`Erro inesperado: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Verificar permissão
  if (!user || !MANAGERS.includes(user.email.toLowerCase())) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 text-white">
        <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-3" />
          <h2 className="text-lg font-semibold text-red-300 mb-2">Acesso Negado</h2>
          <p className="text-sm text-red-200">Apenas gestores autorizados podem acessar esta área.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-5 pb-24 text-white">
      {toast.visible && (
        <div className={`tkf-toast flex items-center justify-center text-center ${toast.type === 'success' ? 'border-emerald-500 bg-[#0e131f] text-emerald-300' : 'border-red-500 bg-[#0e131f] text-red-300'}`}>
          {toast.message}
        </div>
      )}

      <header className="rounded-3xl border border-white/10 bg-[#0e131f] p-5 shadow-[0_20px_45px_rgba(14,19,31,0.5)]">
        <div className="flex items-start gap-3">
          <UserPlus className="mt-1 h-5 w-5 text-[#4364f7]" />
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Gestão de Operadores</h2>
            <p className="mt-1 text-xs text-slate-400">Cadastre novos operadores no sistema TKF LogiCheck.</p>
          </div>
        </div>
      </header>

      <section className="tkf-card p-6 space-y-5">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="tkf-label mb-2 flex items-center gap-2">
              <Mail className="h-4 w-4" /> E-mail Corporativo
            </label>
            <input
              type="email"
              placeholder="operador@tkf.com"
              className="tkf-input w-full"
              {...register('email', {
                required: 'E-mail obrigatório',
                validate: (value) => value.endsWith('@tkf.com') || 'Deve ser um e-mail @tkf.com'
              })}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label className="tkf-label mb-2 flex items-center gap-2">
              <Lock className="h-4 w-4" /> Senha
            </label>
            <input
              type="password"
              placeholder="••••••••"
              className="tkf-input w-full"
              {...register('password', {
                required: 'Senha obrigatória',
                minLength: { value: 6, message: 'Mínimo 6 caracteres' }
              })}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.password.message}
              </p>
            )}
            {passwordValue && passwordValue.length < 6 && !errors.password && (
              <p className="mt-1 text-xs text-amber-400">
                Força: {passwordValue.length}/6 caracteres
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !emailValue || !passwordValue}
            className="tkf-btn-primary w-full py-3 font-bold tracking-wide flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Cadastrando...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" /> Cadastrar Operador
              </>
            )}
          </button>
        </form>

        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-xs text-blue-200 space-y-2">
          <p className="font-semibold text-blue-300">ℹ️ Informações</p>
          <ul className="list-disc list-inside space-y-1">
            <li>E-mail deve ser corporativo (@tkf.com)</li>
            <li>A senha deve ter no mínimo 6 caracteres</li>
            <li>O operador poderá fazer login imediatamente após criação</li>
            <li>Atribuição de acesso: nível operador (padrão)</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
