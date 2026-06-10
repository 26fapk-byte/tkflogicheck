import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

// True if Supabase is properly configured with custom, non-default credentials
export const isSupabaseConfigured = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your_project') &&
  supabaseUrl !== 'https://your_project.supabase.co'
);

// Graceful fallback helper if Supabase is partially setup or default is active
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Expose connection globally on window for external buttons/console access
if (typeof window !== 'undefined' && supabase) {
  (window as any).supabase = supabase;
}

// Global helper to save checklist records directly to Supabase history
export async function salvarNoHistorico(nomeOperador: string, nomeEquipamento: string): Promise<boolean> {
  if (!supabase) {
    console.error('Erro: Supabase não está configurado.');
    return false;
  }
  
  const agora = new Date();
  
  // Formata a data para YYYY-MM-DD
  const dataAtual = agora.toISOString().split('T')[0]; 
  
  // Formata a hora para HH:MM:SS
  const horaAtual = agora.toTimeString().split(' ')[0]; 

  // Insere no banco com campos padrão necessários para satisfazer constraints NOT NULL
  const { error } = await supabase
    .from('registros_checklist')
    .insert([
      { 
        data: dataAtual, 
        hora: horaAtual, 
        operador: nomeOperador, 
        equipamento: nomeEquipamento,
        item: 'Geral', // Valor padrão obrigatório (NOT NULL)
        status: 'OK'   // Valor padrão obrigatório (NOT NULL)
      },
    ]);

  if (error) {
    console.error('Erro ao salvar no histórico:', error.message);
    return false;
  }

  console.log('Registro salvo com sucesso no histórico!');
  return true;
}

// Expose globally on window
if (typeof window !== 'undefined') {
  (window as any).salvarNoHistorico = salvarNoHistorico;
}

