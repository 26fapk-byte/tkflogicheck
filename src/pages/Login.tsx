import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import BrandMark from '../components/BrandMark';

export default function Login() {
  const { login } = useAuth();
  const { resetPassword } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [reqError, setReqError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      email: '',
      password: ''
    },
    mode: 'onChange'
  });

  const emailValue = watch('email') || '';
  const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  const isEmailValid = emailValue.length > 0 && emailRegex.test(emailValue);

  const onSubmit = async (data: any) => {
    setReqError(null);
    setSubmitting(true);
    try {
      const res = await login(data.email, data.password);
      if (!res.success) {
        setReqError(res.error || 'Falha na autenticação corporativa.');
      }
    } catch (e: any) {
      setReqError('Conectividade interrompida. Verifique sua rede e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const [forgotStatus, setForgotStatus] = useState<string | null>(null);
  const handleForgot = async () => {
    setReqError(null);
    setForgotStatus(null);
    const email = emailValue;
    if (!email || !emailRegex.test(email)) {
      setReqError('Informe um e-mail válido para recuperação.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await resetPassword(email);
      if (!res.success) {
        setReqError(res.error || 'Falha ao solicitar recuperação de senha.');
      } else {
        setForgotStatus('Solicitação enviada — verifique sua caixa de entrada para o link de redefinição.');
      }
    } catch (e: any) {
      setReqError('Erro ao comunicar com o servidor. Tente novamente mais tarde.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#1e3a8a33,transparent_45%),radial-gradient(circle_at_bottom_right,#2563eb1f,transparent_42%)]" />
      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-5">
        <div className="grid w-full items-center gap-10 rounded-[32px] border border-white/10 bg-[#0b1222]/85 p-6 shadow-[0_30px_80px_rgba(2,6,23,0.55)] backdrop-blur md:grid-cols-2 md:p-10">
          <section className="space-y-5">
            <BrandMark />
            <h2 className="max-w-md text-2xl md:text-3xl font-bold tracking-tight leading-tight text-white">
              Inspeção inteligente para operações logísticas de alta criticidade.
            </h2>
            <p className="max-w-md text-xs md:text-sm text-slate-400 font-light leading-relaxed">
              Plataforma SaaS corporativa para checklist operacional de empilhadeiras e equipamentos com rastreabilidade, auditoria e resposta em tempo real.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              Ambiente seguro com autenticação corporativa
            </div>
          </section>

          <div className="rounded-3xl border border-white/20 bg-[#0f172a]/90 p-6 shadow-[0_20px_40px_rgba(15,23,42,0.35)]">
            <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Acesso Operacional</p>
            {reqError && (
              <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{reqError}</span>
              </div>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-200" htmlFor="email">
                  E-mail corporativo
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    placeholder="nome@empresa.com"
                    autoComplete="email"
                    className={`h-11 w-full rounded-xl border bg-[#131a2c] pl-10 pr-4 text-sm text-white outline-none transition ${
                      isEmailValid ? 'border-emerald-400/70' : 'border-white/25 focus:border-[#2563eb]'
                    }`}
                    {...register('email', {
                      required: 'O e-mail corporativo é obrigatório',
                      pattern: { value: emailRegex, message: 'Informe um e-mail válido' }
                    })}
                  />
                </div>
                {errors.email && <p className="text-[11px] text-red-300">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-200" htmlFor="password">
                    Senha de acesso
                  </label>
                  <button type="button" onClick={handleForgot} className="text-[11px] font-semibold text-slate-300 hover:text-white underline underline-offset-2">
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="h-11 w-full rounded-xl border border-white/25 bg-[#131a2c] pl-10 pr-11 text-sm text-white outline-none transition focus:border-[#2563eb]"
                    {...register('password', {
                      required: 'A senha é necessária',
                      minLength: { value: 6, message: 'Senha deve conter no mínimo 6 caracteres' }
                    })}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-[11px] text-red-300">{errors.password.message}</p>}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] text-base font-bold text-white transition hover:bg-[#1e40af] active:scale-[0.98] disabled:opacity-70 shadow-[0_4px_16px_rgba(37,99,235,0.4)]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Autenticando...
                  </>
                ) : 'Entrar no Sistema'}
              </button>
              {forgotStatus && (
                <p className="mt-3 text-sm text-emerald-300">{forgotStatus}</p>
              )}
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
