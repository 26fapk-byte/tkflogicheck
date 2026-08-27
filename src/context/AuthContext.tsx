import React, { createContext, useContext, useState, useEffect } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { DEV_USERS } from '../dev/dev_users';

// Role detection helper based on email string (produces Portuguese role labels)
const getRoleFromEmail = (email: string): 'master' | 'gerente' | 'operador' => {
  const normalized = email.toLowerCase().trim();
  if (normalized === 'flavio.freire@ativa.com' || normalized === 'flavio.frire@ativa.com' || normalized === 'flavio.freire@tkf.com' || normalized === 'flavio@tkf.com') return 'master';
  if (normalized.endsWith('@ativa.com') || normalized.endsWith('@tkf.com')) return 'gerente';
  return 'operador';
};

function formatUserName(email: string): string {
  const local = email.split('@')[0] || '';
  return local.replace(/[._-]+/g, ' ').split(' ').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'Colaborador LogiCheck';
}

async function fetchProfileRole(supabase: any, userId: string, fallbackEmail: string): Promise<'master' | 'gerente' | 'operador'> {
  let role: 'master' | 'gerente' | 'operador' = getRoleFromEmail(fallbackEmail);
  try {
    const timeoutMs = 4000;
    const profilePromise = supabase.from('perfis_usuarios').select('nivel_acesso').eq('id', userId).maybeSingle();
    const { data: profile } = await Promise.race([
      profilePromise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
    ]) as any;
    if (profile && profile.nivel_acesso) {
      if (profile.nivel_acesso === 'master') role = 'master';
      else if (profile.nivel_acesso === 'gerente') role = 'gerente';
      else role = 'operador';
    }
  } catch {}
  return role;
}

interface UserSession {
  email: string;
  role: 'master' | 'gerente' | 'operador';
  name: string;
  id: string;
}

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const devAuth = (import.meta as any).env.VITE_DEV_AUTH === 'true';

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    const initAuth = async () => {
      if (devAuth) {
        if (!cancelled) setLoading(false);
        return;
      }
      if (!isSupabaseConfigured || !supabase) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const sessionResult: any = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('getSession timeout')), 7000))
        ]);
        const { data: { session }, error: sessionError } = sessionResult;
        if (cancelled) return;
        if (sessionError) {
          console.warn('Sessão Supabase inválida; limpando sessão local.', sessionError.message);
          await supabase.auth.signOut({ scope: 'local' });
        } else if (session && session.user) {
          const email = session.user.email || '';
          const userId = session.user.id;
          const role = await fetchProfileRole(supabase, userId, email);
          if (!cancelled) {
            setUser({ email, name: formatUserName(email), role, id: userId });
          }
        }
      } catch (e) {
        console.warn('Falha ao verificar sessão Supabase (timeout/rede). Continuando sem sessão.', e);
      }

      try {
        const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(async (_event, session) => {
          if (cancelled) return;
          if (session && session.user) {
            const email = session.user.email || '';
            const userId = session.user.id;
            const role = await fetchProfileRole(supabase, userId, email);
            setUser({ email, name: formatUserName(email), role, id: userId });
          } else {
            setUser(null);
          }
        });
        subscription = sub;
      } catch (e) {
        console.warn('Falha ao registrar onAuthStateChange', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initAuth();

    return () => {
      cancelled = true;
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    if (!normalizedEmail || !trimmedPassword) {
      return { success: false, error: 'Preencha e-mail e senha.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return { success: false, error: 'Informe um e-mail válido.' };
    }
    setLoading(true);
    try {
      if ((import.meta as any).env.VITE_DEV_AUTH === 'true') {
        const found = DEV_USERS.find(u => u.email.toLowerCase() === normalizedEmail);
        if (found && (found.password === trimmedPassword || found.password === '' || trimmedPassword === found.password)) {
          setUser({ email: found.email, role: (found.role as any), name: found.name || found.email, id: found.id });
          return { success: true };
        }
        return { success: false, error: 'E-mail corporativo ou senha inválidos. Por favor, tente novamente.' };
      }
      if (!isSupabaseConfigured || !supabase) {
        return {
          success: false,
          error: 'Serviço de autenticação indisponível. Contate o administrador (variáveis VITE_SUPABASE_URL/ANON_KEY não configuradas).'
        };
      }
      try {
        const signInPromise = supabase.auth.signInWithPassword({ email: normalizedEmail, password: trimmedPassword });
        const { data, error } = await Promise.race([
          signInPromise,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
        ]) as any;

        if (error) {
          console.error('Supabase login error detail:', error);
          let friendlyError = error.message || 'Falha na autenticação.';
          const errorCode = (data as any)?.error?.error_code || (data as any)?.error_code || (error as any)?.code || (error as any)?.name || '';

          if (typeof friendlyError === 'string') {
            const msg = friendlyError.toLowerCase();
            if (msg.includes('invalid login credentials') || errorCode === 'invalid_credentials' || msg.includes('invalid_credentials') || msg.includes('invalid login')) {
              friendlyError = 'E-mail corporativo ou senha inválidos. Por favor, tente novamente.';
            } else if (msg.includes('email not confirmed') || errorCode === 'email_not_confirmed' || msg.includes('email not confirmed')) {
              friendlyError = 'E-mail ainda não confirmado. Verifique sua caixa de entrada ou solicite novo link.';
            } else if (msg.includes('too many requests') || errorCode === 'too_many_requests' || msg.includes('rate limit')) {
              friendlyError = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
            } else if (msg.includes('unauthorized') || errorCode === 'unauthorized') {
              friendlyError = 'Requisição não autorizada. Verifique a configuração do Supabase.';
            } else if (msg.includes('user not found') || msg.includes('not found')) {
              friendlyError = 'Usuário não encontrado. Verifique o e-mail digitado.';
            } else if (msg.includes('timeout')) {
              friendlyError = 'Tempo de resposta excedido. Verifique sua conexão e tente novamente.';
            }
          }
          return { success: false, error: friendlyError };
        }
        if (data?.user) {
          const userEmail = data.user.email || normalizedEmail;
          const userId = data.user.id;
          const role = await fetchProfileRole(supabase, userId, userEmail);
          setUser({ email: userEmail, name: formatUserName(userEmail), role, id: userId });
          return { success: true };
        }
        return { success: false, error: 'Erro inesperado. Usuário inválido.' };
      } catch (err: any) {
        const msg = String(err?.message || '').toLowerCase();
        if (msg.includes('timeout')) {
          return { success: false, error: 'Servidor demorou a responder. Verifique sua conexão e tente novamente.' };
        }
        if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
          return { success: false, error: 'Falha de rede. Verifique sua internet e tente novamente.' };
        }
        return { success: false, error: 'Ocorreu um erro de rede ou comunicação com o servidor.' };
      }
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return { success: false, error: 'Informe um e-mail válido para recuperação.' };
    }
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Serviço de autenticação indisponível. Contate o administrador.' };
    }
    try {
      const resetPromise = supabase.auth.resetPasswordForEmail(normalized, {
        redirectTo: (typeof window !== 'undefined' && window.location.origin) ? `${window.location.origin}/` : undefined,
      } as any);
      const { data, error } = await Promise.race([
        resetPromise,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000))
      ]) as any;
      if (error) {
        console.error('Supabase reset password error detail:', error);
        let friendly = error.message || 'Falha ao solicitar recuperação de senha.';
        const code = (data as any)?.error_code || (error as any)?.code || (error as any)?.name || '';
        const lower = friendly.toLowerCase();
        if (code === 'invalid_request' || /not found/i.test(friendly) || lower.includes('user not found')) {
          friendly = 'E-mail não encontrado. Verifique o e-mail informado.';
        } else if (lower.includes('too many requests') || lower.includes('rate limit')) {
          friendly = 'Muitas solicitações. Aguarde alguns minutos e tente novamente.';
        } else if (lower.includes('timeout')) {
          friendly = 'Tempo excedido. Verifique sua conexão e tente novamente.';
        }
        return { success: false, error: friendly };
      }
      return { success: true };
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('timeout')) return { success: false, error: 'Tempo excedido. Verifique sua conexão e tente novamente.' };
      console.error('Reset password unexpected error', err);
      return { success: false, error: 'Erro ao solicitar recuperação de senha. Tente novamente.' };
    }
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
