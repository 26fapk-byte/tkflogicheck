import React, { createContext, useContext, useState, useEffect } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

// Role detection helper based on email string (produces Portuguese role labels)
const getRoleFromEmail = (email: string): 'master' | 'gerente' | 'operador' => {
  const normalized = email.toLowerCase().trim();
  if (normalized === 'flavio.frire@ativa.com' || normalized === 'flavio.freire@tkf.com' || normalized === 'flavio@tkf.com') return 'master';
  if (normalized.endsWith('@ativa.com') || normalized.endsWith('@tkf.com')) return 'gerente';
  return 'operador';
};

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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleAuthChange = async () => {
      if (isSupabaseConfigured && supabase) {
        // Clean session check
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          const email = session.user.email || '';
          const userId = session.user.id;
          let role: 'master' | 'gerente' | 'operador' = getRoleFromEmail(email);

          try {
            const { data: profile } = await supabase
              .from('perfis_usuarios')
              .select('nivel_acesso')
              .eq('id', userId)
              .maybeSingle();
            if (profile && profile.nivel_acesso) {
              if (profile.nivel_acesso === 'master') role = 'master';
              else if (profile.nivel_acesso === 'gerente') role = 'gerente';
              else role = 'operador';
            }
          } catch {}

          setUser({
            email,
            name: email.split('@')[0].replace('.', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Colaborador LogiCheck',
            role,
            id: userId
          });
        }

        // Listen to changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session && session.user) {
            const email = session.user.email || '';
            const userId = session.user.id;
            let role: 'master' | 'gerente' | 'operador' = getRoleFromEmail(email);

            try {
              const { data: profile } = await supabase
                .from('perfis_usuarios')
                .select('nivel_acesso')
                .eq('id', userId)
                .maybeSingle();
              if (profile && profile.nivel_acesso) {
                if (profile.nivel_acesso === 'master') role = 'master';
                else if (profile.nivel_acesso === 'gerente') role = 'gerente';
                else role = 'operador';
              }
            } catch {}

            setUser({
              email,
              name: email.split('@')[0].replace('.', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Colaborador LogiCheck',
              role,
              id: userId
            });
          } else {
            setUser(null);
          }
        });

        setLoading(false);
        return () => subscription.unsubscribe();
      } else {
        setLoading(false);
      }
    };

    handleAuthChange();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setLoading(false);
          // Customize typical Supabase error messages into clean Portuguese
          let friendlyError = error.message;
          if (error.message.includes('Invalid login credentials')) {
            friendlyError = 'E-mail corporativo ou senha inválidos. Por favor, tente novamente.';
          } else if (error.message.includes('Email not confirmed')) {
            friendlyError = 'E-mail cadastrado, mas ainda não confirmado. Verifique sua caixa de entrada.';
          }
          return { success: false, error: friendlyError };
        }
        if (data.user) {
          const userEmail = data.user.email || '';
          const userId = data.user.id;
          let role: 'master' | 'gerente' | 'operador' = getRoleFromEmail(userEmail);

          try {
            const { data: profile } = await supabase
              .from('perfis_usuarios')
              .select('nivel_acesso')
              .eq('id', userId)
              .maybeSingle();
            if (profile && profile.nivel_acesso) {
              if (profile.nivel_acesso === 'master') role = 'master';
              else if (profile.nivel_acesso === 'gerente') role = 'gerente';
              else role = 'operador';
            }
          } catch {}

          setUser({
            email: userEmail,
            name: userEmail.split('@')[0].replace('.', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Colaborador LogiCheck',
            role,
            id: userId
          });
          setLoading(false);
          return { success: true };
        }
        setLoading(false);
        return { success: false, error: 'Erro inesperado. Usuário inválido.' };
      } catch (err: any) {
        setLoading(false);
        return { success: false, error: 'Ocorreu um erro de rede ou comunicação com o servidor.' };
      }
    } else {
      setLoading(false);
      return {
        success: false,
        error: 'Supabase não está devidamente configurado em seu arquivo .env. Certifique-se de configurar as chaves de acesso de produção.'
      };
    }
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
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
