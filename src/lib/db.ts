import { isSupabaseConfigured, supabase } from './supabase';
import {
  ChecklistRecord,
  Operator,
  Equipment,
  ChecklistItemMeta,
  InspectionStats,
  PreventiveChecklistSubmission,
  BatteryRechargeRecord,
  HistoricoInspecao
} from '../types';

// Safe UUID Generator for frontend PWA resilience
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback handled below
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Normalizadores para resgatar pendências gravadas por versões antigas do app.
// Colunas que hoje são NOT NULL no banco podem estar ausentes no localStorage.
function normalizeDate(d: unknown): string | undefined {
  if (d === undefined || d === null) return undefined;
  const s = String(d).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return undefined;
}

function normalizeHora(h: unknown): string | undefined {
  if (h === undefined || h === null) return undefined;
  const s = String(h).trim();
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) {
    const [hh, mm, ss] = s.split(':');
    return `${hh.padStart(2, '0')}:${mm}:${ss}`;
  }
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}:00`;
  return undefined;
}

function toNum(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeOkNok(status: unknown): 'OK' | 'NOK' {
  return String(status || 'OK').trim().toUpperCase() === 'NOK' ? 'NOK' : 'OK';
}

// The 17 operational checkpoint attributes from official PDF form.
export const CHECKLIST_ITEMS: ChecklistItemMeta[] = [
  { key: 'nivel_bateria', label: 'Nível da Bateria', categoria: 'Eletrico' },
  { key: 'travamento_bateria', label: 'Travamento da Bateria', categoria: 'Eletrico' },
  { key: 'rolamentos_bateria', label: 'Rolamentos da Bateria', categoria: 'Eletrico' },
  { key: 'roda_central', label: 'Roda Central', categoria: 'Mecanico' },
  { key: 'rodas_laterais', label: 'Rodas Laterais', categoria: 'Mecanico' },
  { key: 'corrente', label: 'Corrente', categoria: 'Mecanico' },
  { key: 'mangueira_hidraulica', label: 'Mangueira Hidráulica', categoria: 'Mecanico' },
  { key: 'lanca_elevacao', label: 'Lança de Elevação', categoria: 'Mecanico' },
  { key: 'comandos_tracao', label: 'Comandos de Tração', categoria: 'Seguranca' },
  { key: 'comandos_abas', label: 'Comandos das Abas', categoria: 'Seguranca' },
  { key: 'freio', label: 'Freio', categoria: 'Seguranca' },
  { key: 'buzina', label: 'Buzina', categoria: 'Seguranca' },
  { key: 'botao_antiesmagamento', label: 'Botão Antiesmagamento', categoria: 'Seguranca' },
  { key: 'botao_emergencia', label: 'Botão de Emergência', categoria: 'Seguranca' },
  { key: 'vazamentos', label: 'Vazamentos', categoria: 'Limpeza' },
  { key: 'sinais_luminosos', label: 'Sinais Luminosos', categoria: 'Eletrico' },
  { key: 'limpeza_empilhadeira', label: 'Limpeza da Empilhadeira', categoria: 'Limpeza' }
];

const DEFAULT_OPERATORS: Operator[] = [];
const DEFAULT_EQUIPMENTS: Equipment[] = [];


// Local storage namespaces (offline cache for submissions only — not fleet data)
const STORE_PREFIX = 'tkf_logicheck_v2_';
const KEY_RECORDS = `${STORE_PREFIX}records`;
const KEY_SYNC_QUEUE = `${STORE_PREFIX}sync_queue`;
const KEY_PREVENTIVE_CHECKLISTS = `${STORE_PREFIX}preventive_checklists`;
const KEY_BATTERY_RECHARGES = `${STORE_PREFIX}battery_recharges`;
const KEY_HISTORICO_INSPECOES = `${STORE_PREFIX}historico_inspecoes`;
const KEY_SYNC_DEAD = `${STORE_PREFIX}sync_dead`;

type EquipmentRow = {
  id: string;
  nome: string;
  patrimonio: string;
  tipo: string;
  ativo: boolean;
};

function mapEquipmentRow(row: EquipmentRow): Equipment {
  return {
    id: row.id,
    nome: row.nome,
    patrimonio: row.patrimonio,
    tipo: row.tipo,
    ativo: row.ativo
  };
}

export async function fetchEquipments(): Promise<Equipment[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  try {
    const query = supabase
      .from('equipamentos')
      .select('id, nome, patrimonio, tipo, ativo')
      .eq('ativo', true)
      .order('patrimonio', { ascending: true })
      .limit(200);
    const { data, error } = await withFetchTimeout(query as any, 8000) as any;
    if (error || !data) {
      if (error) console.warn('fetchEquipments error:', error.message);
      return [];
    }
    return data.map(mapEquipmentRow);
  } catch (e) {
    console.warn('fetchEquipments timeout/rede:', e);
    return [];
  }
}

export async function createEquipment(
  equipment: Omit<Equipment, 'id'> & { id?: string }
): Promise<{ success: boolean; error?: string; equipment?: Equipment }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Supabase não configurado. Verifique as variáveis de ambiente.' };
  }

  const payload = {
    id: equipment.id || generateUUID(),
    nome: equipment.nome,
    patrimonio: equipment.patrimonio,
    tipo: equipment.tipo,
    ativo: equipment.ativo ?? true
  };

  const { data, error } = await supabase
    .from('equipamentos')
    .insert(payload)
    .select('id, nome, patrimonio, tipo, ativo')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Já existe um equipamento com este patrimônio.' };
    }
    return { success: false, error: 'Não foi possível cadastrar o equipamento.' };
  }

  return { success: true, equipment: mapEquipmentRow(data as EquipmentRow) };
}

export async function removeEquipment(id: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    return false;
  }

  const { error } = await supabase
    .from('equipamentos')
    .update({ ativo: false })
    .eq('id', id);

  return !error;
}

type SyncQueueEntry = {
  table: 'registros_checklist' | 'checklist_preventivo' | 'abastecimento_recarga_bateria' | 'historico_inspecoes';
  payload: ChecklistRecord | PreventiveChecklistSubmission | BatteryRechargeRecord | HistoricoInspecao;
};

export class LocalDb {
  private static syncInProgress: Promise<boolean> | null = null;

  static init() {
    if (!localStorage.getItem(KEY_RECORDS)) {
      localStorage.setItem(KEY_RECORDS, JSON.stringify([]));
    }
    if (!localStorage.getItem(KEY_PREVENTIVE_CHECKLISTS)) {
      localStorage.setItem(KEY_PREVENTIVE_CHECKLISTS, JSON.stringify([]));
    }
    if (!localStorage.getItem(KEY_BATTERY_RECHARGES)) {
      localStorage.setItem(KEY_BATTERY_RECHARGES, JSON.stringify([]));
    }
    if (!localStorage.getItem(KEY_HISTORICO_INSPECOES)) {
      localStorage.setItem(KEY_HISTORICO_INSPECOES, JSON.stringify([]));
    }
  }

  static getRecords(): ChecklistRecord[] {
    this.init();
    try {
      const raw = localStorage.getItem(KEY_RECORDS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static getHistoricoInspecoes(): HistoricoInspecao[] {
    this.init();
    try {
      const raw = localStorage.getItem(KEY_HISTORICO_INSPECOES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static saveHistoricoInspecao(submission: HistoricoInspecao) {
    const current = this.getHistoricoInspecoes();
    localStorage.setItem(KEY_HISTORICO_INSPECOES, JSON.stringify([submission, ...current]));
    this.queueForSync('historico_inspecoes', [submission]);
    this.processSyncQueue();
  }

  static getOperators(): Operator[] {
    return DEFAULT_OPERATORS;
  }

  static getChecklistItems() {
    return CHECKLIST_ITEMS;
  }

  static getPreventiveChecklists(): PreventiveChecklistSubmission[] {
    this.init();
    try {
      const raw = localStorage.getItem(KEY_PREVENTIVE_CHECKLISTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static savePreventiveChecklist(submission: PreventiveChecklistSubmission) {
    const current = this.getPreventiveChecklists();
    localStorage.setItem(KEY_PREVENTIVE_CHECKLISTS, JSON.stringify([submission, ...current]));
    this.queueForSync('checklist_preventivo', [submission]);
    this.processSyncQueue();
  }

  static getBatteryRechargeRecords(): BatteryRechargeRecord[] {
    this.init();
    try {
      const raw = localStorage.getItem(KEY_BATTERY_RECHARGES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static saveBatteryRechargeRecord(record: BatteryRechargeRecord) {
    const current = this.getBatteryRechargeRecords();
    localStorage.setItem(KEY_BATTERY_RECHARGES, JSON.stringify([record, ...current]));
    this.queueForSync('abastecimento_recarga_bateria', [record]);
    this.processSyncQueue();
  }

  static async saveRecords(newRecords: ChecklistRecord[]): Promise<boolean> {
    const current = this.getRecords();
    const updated = [...newRecords, ...current];
    localStorage.setItem(KEY_RECORDS, JSON.stringify(updated));

    // Enqueue and trigger background sync (non-blocking for UX)
    this.queueForSync('registros_checklist', newRecords);
    // Fire-and-forget sync; UI shows "salvo localmente" imediatamente e sincroniza em background
    this.processSyncQueue().catch(() => {});
    return true;
  }

  private static queueForSync(
    table: SyncQueueEntry['table'],
    records: Array<ChecklistRecord | PreventiveChecklistSubmission | BatteryRechargeRecord | HistoricoInspecao>
  ) {
    try {
      const raw = localStorage.getItem(KEY_SYNC_QUEUE);
      const queue: SyncQueueEntry[] = raw ? JSON.parse(raw) : [];
      const entries: SyncQueueEntry[] = records.map((record) => ({ table, payload: record, _attempts: 0 } as any));
      localStorage.setItem(KEY_SYNC_QUEUE, JSON.stringify([...queue, ...entries]));
    } catch { }
  }

  static processSyncQueue(): Promise<boolean> {
    if (this.syncInProgress) return this.syncInProgress;

    const syncPromise = this.processSyncQueueInternal();
    this.syncInProgress = syncPromise.finally(() => {
      if (this.syncInProgress === syncPromise) {
        this.syncInProgress = null;
      }
    });
    return this.syncInProgress;
  }

  private static withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms))
    ]) as Promise<T>;
  }

  private static async processSyncQueueInternal(): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      return false;
    }

    try {
      const raw = localStorage.getItem(KEY_SYNC_QUEUE);
      if (!raw) return true;

      // Safe parse for sync queue
      let queue: (SyncQueueEntry & { _attempts?: number })[] = [];
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return true;
        queue = parsed.map((entry: any) => {
          if (entry && typeof entry === 'object' && 'table' in entry && 'payload' in entry) {
            return entry as SyncQueueEntry & { _attempts?: number };
          }
          return {
            table: 'registros_checklist',
            payload: entry as ChecklistRecord,
            _attempts: 0
          } as any;
        });
      } catch {
        // Clear corrupted queue to prevent infinite crashes
        localStorage.setItem(KEY_SYNC_QUEUE, JSON.stringify([]));
        return true;
      }

      if (queue.length === 0) return true;

      const syncedIds = new Set<string>();
      const failedIds = new Set<string>();
      const deadIds = new Set<string>();
      const entriesByTable: Record<string, { entry: SyncQueueEntry & { _attempts?: number }; row: any }[]> = {};

      const processedQueueKeys = new Set<string>();
      // Limit per invocation to avoid huge batches blocking UI (process 60 entries max per cycle)
      const queueSlice = queue.slice(0, 60);
      const remainingUnprocessed = queue.slice(60);

      queueSlice.forEach((entry) => {
        if (!entry.payload) return;
        const queueKey = `${entry.table}:${entry.payload.id}`;
        if (processedQueueKeys.has(queueKey)) return;
        processedQueueKeys.add(queueKey);
        let row: any = null;

        if (entry.table === 'registros_checklist') {
          const rec = entry.payload as ChecklistRecord;
          const hasValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rec.id);
          row = {
            id: hasValidUuid ? rec.id : generateUUID(),
            created_at: rec.created_at,
            data: normalizeDate(rec.data) || String(rec.data || ''),
            hora: normalizeHora(rec.hora) || '00:00:00',
            operador: rec.operador,
            equipamento: rec.equipamento,
            item: rec.item || 'Geral',
            status: normalizeOkNok(rec.status),
            observacao: rec.observacao || '',
            patrimonio: rec.patrimonio || '',
            horimetro: toNum(rec.horimetro),
            ligando: rec.ligando ? String(rec.ligando).slice(0, 10) : null,
            bateria_barras: toNum(rec.bateria_barras),
            vazamentos: rec.vazamentos || '',
            sinais_luminosos: rec.sinais_luminosos || '',
            limpeza: rec.limpeza || ''
          };
        } else if (entry.table === 'checklist_preventivo') {
          const rec = entry.payload as PreventiveChecklistSubmission;
          const itens = Array.isArray(rec.itens)
            ? rec.itens.map((it: any) => ({ ...it, status: normalizeOkNok(it.status) }))
            : [];
          row = {
            created_at: rec.created_at,
            data: normalizeDate(rec.data) || String(rec.data || ''),
            hora: normalizeHora(rec.hora) || '00:00:00',
            operador: rec.operador,
            equipamento: rec.equipamento,
            patrimonio: rec.patrimonio || '',
            horimetro: toNum(rec.horimetro) ?? 0,
            bateria_barras: toNum(rec.bateria_barras) ?? 0,
            observacoes_gerais: rec.observacoes_gerais || '',
            assinatura_nome: rec.assinatura_nome || '',
            assinatura_confirmada: !!rec.assinatura_confirmada,
            status_geral: normalizeOkNok((rec as any).status_geral),
            itens: JSON.stringify(itens)
          };
        } else if (entry.table === 'abastecimento_recarga_bateria') {
          const rec = entry.payload as BatteryRechargeRecord;
          row = {
            created_at: rec.created_at,
            data: normalizeDate(rec.data) || String(rec.data || ''),
            patrimonio: rec.patrimonio || '',
            horimetro: toNum(rec.horimetro) ?? 0,
            operador_inicio: rec.operador_inicio,
            operador_termino: rec.operador_termino,
            hora_inicio: normalizeHora(rec.hora_inicio) || '00:00:00',
            hora_termino: normalizeHora(rec.hora_termino) || '00:00:00',
            carregador_status: normalizeOkNok(rec.carregador_status),
            reposicao_agua: !!rec.reposicao_agua,
            responsavel_reposicao: rec.responsavel_reposicao || '',
            observacoes: rec.observacoes || '',
            assinatura_nome: rec.assinatura_nome || '',
            assinatura_confirmada: !!rec.assinatura_confirmada
          };
        } else if (entry.table === 'historico_inspecoes') {
          const rec = entry.payload as HistoricoInspecao;
          const normalizedItens = Array.isArray((rec as any).itens) ? (rec as any).itens.map((it: any) => ({
            ...it,
            status: normalizeOkNok(it.status)
          })) : [];
          row = {
            created_at: rec.created_at,
            data: normalizeDate(rec.data) || String(rec.data || ''),
            hora: normalizeHora((rec as any).hora) || '00:00:00',
            operador: rec.operador,
            equipamento: rec.equipamento,
            patrimonio: rec.patrimonio || '',
            horimetro: toNum(rec.horimetro) ?? 0,
            ligando: rec.ligando ? String(rec.ligando).slice(0, 10) : 'OK',
            bateria_barras: toNum(rec.bateria_barras) ?? 0,
            status_geral: normalizeOkNok((rec as any).status_geral),
            itens: JSON.stringify(normalizedItens),
            observacao_geral: (rec as any).observacao_geral || ''
          };
        }

        if (row) {
          if (!entriesByTable[entry.table]) {
            entriesByTable[entry.table] = [];
          }
          entriesByTable[entry.table].push({ entry, row });
        }
      });

      let allSuccess = true;

      const describeSyncError = (error: any) => ({
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint
      });

      const CHUNK_SIZE = 20;

      for (const [table, items] of Object.entries(entriesByTable)) {
        if (!items.length) continue;

        // Chunk large batches to reduce payload and Supabase timeout risk
        for (let i = 0; i < items.length; i += CHUNK_SIZE) {
          const chunk = items.slice(i, i + CHUNK_SIZE);
          const rows = chunk.map(x => x.row);
          try {
            const insertPromise = (supabase as any).from(table as any).insert(rows);
            const { error } = await this.withTimeout(insertPromise, 12000, `insert ${table} chunk`) as any;
            if (!error) {
              chunk.forEach(x => syncedIds.add(x.entry.payload.id));
              continue;
            }
            console.error(`Erro ao sincronizar lote na tabela ${table} chunk ${i / CHUNK_SIZE}:`, describeSyncError(error));
            allSuccess = false;

            // For duplicate batch, retry individually (handles already-synced rows)
            if (error.code === '23505') {
              for (const item of chunk) {
                try {
                  const singlePromise = (supabase as any).from(table as any).insert(item.row);
                  const { error: singleError } = await this.withTimeout(singlePromise, 8000, `insert single ${table}`) as any;
                  if (!singleError || singleError.code === '23505') {
                    syncedIds.add(item.entry.payload.id);
                  } else {
                    console.error(`Erro ao sincronizar item individual (${item.entry.payload.id}) na tabela ${table}:`, describeSyncError(singleError));
                    const attempts = ((item.entry as any)._attempts || 0) + 1;
                    (item.entry as any)._attempts = attempts;
                    if (attempts >= 5) {
                      console.warn(`Movendo item ${item.entry.payload.id} para a fila de erros após ${attempts} falhas.`);
                      deadIds.add(item.entry.payload.id);
                      this.addDeadLetter(item.entry, singleError);
                    } else {
                      failedIds.add(item.entry.payload.id);
                    }
                  }
                } catch (e) {
                  console.error(`Timeout/erro individual ${item.entry.payload.id}`, e);
                  const attempts = ((item.entry as any)._attempts || 0) + 1;
                  (item.entry as any)._attempts = attempts;
                  if (attempts < 5) failedIds.add(item.entry.payload.id);
                  else {
                    deadIds.add(item.entry.payload.id);
                    this.addDeadLetter(item.entry, e);
                  }
                }
              }
            } else if (error.code === 'PGRST204' || error.code === '42703' || /column.*does not exist/i.test(error.message || '')) {
              // Schema mismatch - do not retry infinitely, keep but warn; treat as non-blocking
              console.warn(`Schema mismatch em ${table}, mantendo fila mas não bloqueando:`, error.message);
              chunk.forEach(x => failedIds.add(x.entry.payload.id));
              // increment attempts so it eventually gets dead-lettered
              chunk.forEach(x => {
                const attempts = ((x.entry as any)._attempts || 0) + 1;
                (x.entry as any)._attempts = attempts;
                if (attempts >= 5) {
                  deadIds.add(x.entry.payload.id);
                  failedIds.delete(x.entry.payload.id);
                  this.addDeadLetter(x.entry, error);
                }
              });
            } else {
              // Outros erros (RLS, rede, etc): retry individual com backoff
              for (const item of chunk) {
                try {
                  const singlePromise = (supabase as any).from(table as any).insert(item.row);
                  const { error: singleError } = await this.withTimeout(singlePromise, 8000, `retry single ${table}`) as any;
                  if (!singleError || singleError.code === '23505') {
                    syncedIds.add(item.entry.payload.id);
                  } else {
                    console.error(`Retry individual falhou ${item.entry.payload.id}:`, describeSyncError(singleError));
                    const attempts = ((item.entry as any)._attempts || 0) + 1;
                    (item.entry as any)._attempts = attempts;
                    if (attempts >= 5) {
                      console.warn(`Movendo item ${item.entry.payload.id} para a fila de erros após ${attempts} falhas.`);
                      deadIds.add(item.entry.payload.id);
                      this.addDeadLetter(item.entry, singleError);
                    } else {
                      failedIds.add(item.entry.payload.id);
                    }
                  }
                } catch (e) {
                  console.warn(`Timeout no retry individual ${item.entry.payload.id}`, e);
                  const attempts = ((item.entry as any)._attempts || 0) + 1;
                  (item.entry as any)._attempts = attempts;
                  if (attempts < 5) failedIds.add(item.entry.payload.id);
                  else {
                    deadIds.add(item.entry.payload.id);
                    this.addDeadLetter(item.entry, e);
                  }
                }
              }
            }
          } catch (e) {
            console.error(`Erro/timeout no chunk ${table}:`, e);
            allSuccess = false;
            chunk.forEach(x => {
              const attempts = ((x.entry as any)._attempts || 0) + 1;
              (x.entry as any)._attempts = attempts;
              if (attempts < 5) failedIds.add(x.entry.payload.id);
              else {
                deadIds.add(x.entry.payload.id);
                this.addDeadLetter(x.entry, e);
              }
            });
          }
        }
      }

      // Rebuild queue: keep unprocessed slice + failed entries (with updated attempts) - synced
      const stillPending = queueSlice.filter(x => x.payload && !syncedIds.has(x.payload.id) && !deadIds.has(x.payload.id));
      const nextQueue = [...stillPending, ...remainingUnprocessed];
      localStorage.setItem(KEY_SYNC_QUEUE, JSON.stringify(nextQueue));

      // Background retry if still has items and failures were transient (network)
      if (nextQueue.length > 0 && nextQueue.length < queue.length) {
        // Some progress made; schedule next cycle shortly
        setTimeout(() => { LocalDb.processSyncQueue().catch(() => {}); }, 2500);
      }

      return allSuccess || nextQueue.length === 0;
    } catch (err) {
      console.error('Erro catastrófico no processSyncQueue:', err);
      return false;
    }
  }

  static getSyncQueueLength(): number {
    try {
      const raw = localStorage.getItem(KEY_SYNC_QUEUE);
      const queue = raw ? JSON.parse(raw) : [];
      return queue.length;
    } catch {
      return 0;
    }
  }

  static getDeadLetterCount(): number {
    try {
      const raw = localStorage.getItem(KEY_SYNC_DEAD);
      const dead = raw ? JSON.parse(raw) : [];
      return Array.isArray(dead) ? dead.length : 0;
    } catch {
      return 0;
    }
  }

  // Recoloca itens com erro na fila ativa para nova tentativa (dados preservados).
  static retryDeadLetter(): number {
    try {
      const raw = localStorage.getItem(KEY_SYNC_DEAD);
      const dead: any[] = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(dead) || dead.length === 0) return 0;
      localStorage.setItem(KEY_SYNC_DEAD, JSON.stringify([]));
      const queueRaw = localStorage.getItem(KEY_SYNC_QUEUE);
      const queue = queueRaw ? JSON.parse(queueRaw) : [];
      const restored = dead.map((d) => ({ table: d.table, payload: d.payload, _attempts: 0 }));
      localStorage.setItem(KEY_SYNC_QUEUE, JSON.stringify([...queue, ...restored]));
      this.processSyncQueue().catch(() => {});
      return restored.length;
    } catch {
      return 0;
    }
  }

  private static addDeadLetter(entry: any, error: any): void {
    try {
      const raw = localStorage.getItem(KEY_SYNC_DEAD);
      const dead: any[] = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(dead)) return;
      dead.push({
        table: entry.table,
        payload: entry.payload,
        movedAt: new Date().toISOString(),
        error: { code: error?.code, message: error?.message || String(error) }
      });
      localStorage.setItem(KEY_SYNC_DEAD, JSON.stringify(dead.slice(-200)));
    } catch { }
  }

  static deleteRecord(id: string): boolean {
    try {
      const current = this.getRecords();
      const filtered = current.filter(r => r.id !== id);
      localStorage.setItem(KEY_RECORDS, JSON.stringify(filtered));

      // Attempt remote deletion if available (best-effort, async, non-blocking)
      if (isSupabaseConfigured && supabase) {
        (async () => {
          try {
            const { error } = await supabase.from('registros_checklist').delete().eq('id', id);
            if (error) return;
          } catch { }
        })();
      }

      return true;
    } catch {
      return false;
    }
  }

  // Analytical indicators generator corresponding to Dashboard filters
  static generateStats(filters: { eq?: string; month?: string; status?: string }): InspectionStats {
    const records = this.getRecords();

    // Filter registrations
    let filtered = [...records];

    if (filters.eq && filters.eq !== 'Todos') {
      filtered = filtered.filter(r => r.equipamento.includes(filters.eq!));
    }

    // Month filter (format "YYYY-MM")
    if (filters.month && filters.month !== 'Todos') {
      filtered = filtered.filter(r => r.data.startsWith(filters.month!));
    }

    // Group items into logical inspections
    // An inspection is unique by date + time + operator + equipment
    const inspectionGroups: Record<string, {
      id: string;
      data: string;
      hora: string;
      operador: string;
      equipamento: string;
      items: { name: string; status: 'OK' | 'NOK'; obs: string }[];
    }> = {};

    filtered.forEach(r => {
      const key = `${r.data}_${r.hora}_${r.equipamento}`;
      if (!inspectionGroups[key]) {
        inspectionGroups[key] = {
          id: `${r.data}-${r.hora}-${r.equipamento}`,
          data: r.data,
          hora: r.hora,
          operador: r.operador,
          equipamento: r.equipamento,
          items: []
        };
      }
      inspectionGroups[key].items.push({
        name: r.item,
        status: r.status,
        obs: r.observacao || ''
      });
    });

    const groupsList = Object.values(inspectionGroups);

    // Filter groups by checklist status if set
    let finalGroups = groupsList;
    if (filters.status && filters.status !== 'Todos') {
      finalGroups = groupsList.filter(group => {
        const hasNok = group.items.some(i => i.status === 'NOK');
        return filters.status === 'OK' ? !hasNok : hasNok;
      });
    }

    // Computes aggregate checklist numbers
    let totalOk = 0;
    let totalNok = 0;

    finalGroups.forEach(g => {
      const hasNok = g.items.some(x => x.status === 'NOK');
      if (hasNok) {
        totalNok++;
      } else {
        totalOk++;
      }
    });

    // Count item-level failures by equipment to identify worst acting forklifts
    const equipmentFailures: Record<string, number> = {};
    const equipmentTotalInspections: Record<string, number> = {};

    groupsList.forEach(g => {
      equipmentTotalInspections[g.equipamento] = (equipmentTotalInspections[g.equipamento] || 0) + 1;
      const failedItemsCount = g.items.filter(i => i.status === 'NOK').length;
      if (failedItemsCount > 0) {
        equipmentFailures[g.equipamento] = (equipmentFailures[g.equipamento] || 0) + failedItemsCount;
      }
    });

    let worstEquipment = 'Nenhum ativo com falhas';
    let maxFailures = -1;
    Object.entries(equipmentFailures).forEach(([eqName, fails]) => {
      if (fails > maxFailures) {
        maxFailures = fails;
        worstEquipment = eqName;
      }
    });

    // Recharts data generators
    // 1. NOK by Month
    const nokByMonthMap: Record<string, number> = {};
    records.forEach(r => {
      if (r.status === 'NOK') {
        const m = r.data.substring(0, 7); // YYYY-MM
        nokByMonthMap[m] = (nokByMonthMap[m] || 0) + 1;
      }
    });

    const monthLabelsMap: Record<string, string> = {
      '2026-01': 'Jan', '2026-02': 'Fev', '2026-03': 'Mar', '2026-04': 'Abr', '2026-05': 'Mai',
      '2026-06': 'Jun', '2026-07': 'Jul', '2026-08': 'Ago', '2026-09': 'Set', '2026-10': 'Out',
      '2026-11': 'Nov', '2026-12': 'Dez'
    };

    const nokByMonth = Object.entries(nokByMonthMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([m, val]) => ({
        month: monthLabelsMap[m] || m,
        value: val
      }));


    // 2. Failures by Inspected Item Type
    const categoryFailuresMap: Record<string, number> = {};
    filtered.forEach(r => {
      if (r.status === 'NOK') {
        const itemMeta = CHECKLIST_ITEMS.find(i => i.label === r.item);
        const category = itemMeta ? itemMeta.categoria : 'Outros';
        const categoryLabelMap: Record<string, string> = {
          'Eletrico': 'Componentes Elétricos',
          'Mecanico': 'Sistemas Mecânicos',
          'Seguranca': 'Dispositivos de Segurança',
          'Limpeza': 'Infiltração ou Conservação'
        };
        const mappedLabel = categoryLabelMap[category] || category;
        categoryFailuresMap[mappedLabel] = (categoryFailuresMap[mappedLabel] || 0) + 1;
      }
    });

    const failuresByAsset = Object.entries(categoryFailuresMap).map(([name, value]) => ({
      name,
      value
    }));

    // 3. Inspections counts by date (last 7 inspections)
    const countByDateMap: Record<string, number> = {};
    groupsList.forEach(g => {
      countByDateMap[g.data] = (countByDateMap[g.data] || 0) + 1;
    });

    const inspectionsByPeriod = Object.entries(countByDateMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([date, val]) => {
        const [, , d] = date.split('-');
        return {
          date: `${d}`, // Day of month label
          value: val
        };
      });

    return {
      totalInspections: finalGroups.length,
      totalOk,
      totalNok,
      mostFailedEquipment: worstEquipment,
      nokByMonth,
      failuresByAsset,
      inspectionsByPeriod
    };
  }
}

// ─── Equipment Supabase operations (async, outside LocalDb class) ──────────────

export async function getEquipmentsFromSupabase(): Promise<Equipment[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }
  try {
    const { data, error } = await supabase
      .from('equipamentos_frota')
      .select('*')
      .order('patrimonio');
    if (error) {
      console.error('Erro ao buscar equipamentos:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Erro de rede ao buscar equipamentos:', err);
    return [];
  }
}

export async function addEquipmentToSupabase(equipment: Equipment): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }
  const { error } = await supabase
    .from('equipamentos_frota')
    .insert(equipment);
  if (error) throw error;
}

export async function removeEquipmentFromSupabase(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }
  const { error } = await supabase
    .from('equipamentos_frota')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function fetchChecklistRecordsFromSupabase(): Promise<ChecklistRecord[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }
  try {
    const query = supabase.from('registros_checklist').select('*').limit(500);
    const { data, error } = await withFetchTimeout(query as any, 8000) as any;
    if (error) {
      console.error('SUPABASE ERROR:', error);
      return [];
    }
    return (data || []) as ChecklistRecord[];
  } catch (e) {
    console.error('Erro ao buscar registros_checklist:', e);
    return [];
  }
}

async function withFetchTimeout<T>(promise: Promise<T>, ms = 10000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('fetch timeout')), ms))
  ]) as Promise<T>;
}

export async function fetchPreventiveChecklistsFromSupabase(): Promise<PreventiveChecklistSubmission[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }
  try {
    const query = supabase
      .from('checklist_preventivo')
      .select('*')
      .order('data', { ascending: false })
      .order('hora', { ascending: false })
      .limit(500);
    const { data, error } = await withFetchTimeout(query as any, 10000) as any;

    if (error) {
      console.error('Erro ao carregar checklists preventivos do Supabase:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      ...row,
      itens: typeof row.itens === 'string' ? JSON.parse(row.itens) : row.itens
    }));
  } catch (err) {
    console.error('Erro de rede ao carregar checklists preventivos do Supabase:', err);
    return [];
  }
}

export async function fetchHistoricoInspecoesFromSupabase(): Promise<HistoricoInspecao[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }
  try {
    const query = supabase
      .from('historico_inspecoes')
      .select('*')
      .order('data', { ascending: false })
      .order('hora', { ascending: false })
      .limit(500);
    const { data, error } = await withFetchTimeout(query as any, 10000) as any;

    if (error) {
      console.error('Erro ao buscar historico_inspecoes:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      ...row,
      itens: typeof row.itens === 'string' ? JSON.parse(row.itens) : row.itens
    }));
  } catch (err) {
    console.error('Erro de rede ao buscar historico_inspecoes:', err);
    return [];
  }
}

export async function fetchBatteryRechargesFromSupabase(): Promise<BatteryRechargeRecord[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }
  try {
    const query = supabase
      .from('abastecimento_recarga_bateria')
      .select('*')
      .order('data', { ascending: false })
      .order('hora_termino', { ascending: false })
      .limit(500);
    const { data, error } = await withFetchTimeout(query as any, 10000) as any;

    if (error) {
      console.error('Erro ao buscar abastecimento_recarga_bateria:', error);
      return [];
    }

    return (data || []) as BatteryRechargeRecord[];
  } catch (err) {
    console.error('Erro de rede ao buscar abastecimento_recarga_bateria:', err);
    return [];
  }
}

export async function fetchBaterias(): Promise<{ id: string; numero: number }[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [1,2,3,4,5,6].map(n => ({ id: String(n), numero: n }));
  }
  try {
    const { data, error } = await supabase
      .from('baterias')
      .select('id, numero')
      .eq('status', 'Ativa')
      .order('numero', { ascending: true });
    if (error || !data) {
      return [1,2,3,4,5,6].map(n => ({ id: String(n), numero: n }));
    }
    return data;
  } catch {
    return [1,2,3,4,5,6].map(n => ({ id: String(n), numero: n }));
  }
}
