import { supabase, isSupabaseConfigured } from './supabase';
import { generateUUID } from './db';

export async function uploadFotoNok(
  file: File,
  pasta: 'carregador' | 'inspecao' | 'preventivo'
): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  if (!file || file.size === 0) return null;
  // Limit 8MB to avoid Supabase/storage timeout on slow networks
  if (file.size > 8 * 1024 * 1024) {
    console.warn(`Foto ${file.name} excede 8MB, ignorando upload.`);
    return null;
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${pasta}/${generateUUID()}.${ext}`;
  try {
    const uploadPromise = supabase.storage
      .from('fotos-nok')
      .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false, cacheControl: '3600' });
    const { error } = await Promise.race([
      uploadPromise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('upload timeout')), 15000))
    ]) as any;
    if (error) {
      console.warn('Falha no upload de foto NOK:', error.message);
      return null;
    }
    const { data } = supabase.storage.from('fotos-nok').getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e) {
    console.warn('Timeout/erro no upload de foto NOK', e);
    return null;
  }
}

export async function uploadFotosNokParalelo(
  files: Array<{ key: string; file: File }>,
  pasta: 'carregador' | 'inspecao' | 'preventivo',
  concurrency = 3
): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};
  // Process in chunks to limit concurrency and avoid thrashing slow networks
  for (let i = 0; i < files.length; i += concurrency) {
    const chunk = files.slice(i, i + concurrency);
    const uploads = await Promise.all(
      chunk.map(async ({ key, file }) => {
        const url = await uploadFotoNok(file, pasta);
        return { key, url };
      })
    );
    uploads.forEach(({ key, url }) => { result[key] = url; });
  }
  return result;
}
