import { supabase, isSupabaseConfigured } from './supabase';
import { generateUUID } from './db';

export async function uploadFotoNok(
  file: File,
  pasta: 'carregador' | 'inspecao' | 'preventivo'
): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${pasta}/${generateUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('fotos-nok')
    .upload(path, file, { contentType: file.type });
  if (error) return null;
  const { data } = supabase.storage.from('fotos-nok').getPublicUrl(path);
  return data?.publicUrl || null;
}
