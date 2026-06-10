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
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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

  const { data, error } = await supabase
    .from('equipamentos')
    .select('id, nome, patrimonio, tipo, ativo')
    .eq('ativo', true)
    .order('patrimonio', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map(mapEquipmentRow);
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

  static saveRecords(newRecords: ChecklistRecord[]) {
    const current = this.getRecords();
    const updated = [...newRecords, ...current];
    localStorage.setItem(KEY_RECORDS, JSON.stringify(updated));

    // Try to sync to Supabase if available
    this.queueForSync('registros_checklist', newRecords);
    this.processSyncQueue();
  }

  private static queueForSync(
    table: SyncQueueEntry['table'],
    records: Array<ChecklistRecord | PreventiveChecklistSubmission | BatteryRechargeRecord>
  ) {
    try {
      const raw = localStorage.getItem(KEY_SYNC_QUEUE);
      const queue: SyncQueueEntry[] = raw ? JSON.parse(raw) : [];
      const entries: SyncQueueEntry[] = records.map((record) => ({ table, payload: record }));
      localStorage.setItem(KEY_SYNC_QUEUE, JSON.stringify([...queue, ...entries]));
    } catch {}
  }

  static async processSyncQueue(): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      return false;
    }

    try {
      const raw = localStorage.getItem(KEY_SYNC_QUEUE);
      if (!raw) return true;

      // Safe parse for sync queue
      let queue: SyncQueueEntry[] = [];
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return true;
        queue = parsed.map((entry) => {
          if (entry && typeof entry === 'object' && 'table' in entry && 'payload' in entry) {
            return entry as SyncQueueEntry;
          }
          return {
            table: 'registros_checklist',
            payload: entry as ChecklistRecord
          };
        });
      } catch {
        // Clear corrupted queue to prevent infinite crashes
        localStorage.setItem(KEY_SYNC_QUEUE, JSON.stringify([]));
        return true;
      }

      if (queue.length === 0) return true;

      const syncedIds = new Set<string>();
      const entriesByTable: Record<string, { entry: SyncQueueEntry; row: any }[]> = {};

      queue.forEach((entry) => {
        if (!entry.payload) return;
        let row: any = null;

        if (entry.table === 'registros_checklist') {
          const rec = entry.payload as ChecklistRecord;
          const hasValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rec.id);
          const formattedHour = rec.hora && rec.hora.split(':').length === 2 ? rec.hora + ':00' : rec.hora;
          row = {
            id: hasValidUuid ? rec.id : generateUUID(),
            created_at: rec.created_at,
            data: rec.data,
            hora: formattedHour,
            operador: rec.operador,
            equipamento: rec.equipamento,
            item: rec.item,
            status: rec.status,
            observacao: rec.observacao,
            patrimonio: rec.patrimonio || '',
            horimetro: rec.horimetro !== undefined ? rec.horimetro : null,
            ligando: rec.ligando || null,
            bateria_barras: rec.bateria_barras !== undefined ? rec.bateria_barras : null
          };
        } else if (entry.table === 'checklist_preventivo') {
          const rec = entry.payload as PreventiveChecklistSubmission;
          row = {
            ...rec,
            itens: JSON.stringify(rec.itens)
          };
        } else if (entry.table === 'abastecimento_recarga_bateria') {
          row = entry.payload as BatteryRechargeRecord;
        } else if (entry.table === 'historico_inspecoes') {
          const rec = entry.payload as HistoricoInspecao;
          row = {
            ...rec,
            itens: JSON.stringify(rec.itens)
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

      for (const [table, items] of Object.entries(entriesByTable)) {
        if (!items.length) continue;

        const rows = items.map(x => x.row);
        const { error } = await supabase.from(table as any).insert(rows);

        if (error) {
          console.error(`Erro ao sincronizar lote na tabela ${table}:`, error);
          allSuccess = false;

          // Fallback: try inserting each item individually to bypass duplicate key blocks
          for (const item of items) {
            const { error: singleError } = await supabase.from(table as any).insert(item.row);
            if (!singleError || singleError.code === '23505') {
              // Success or already exists in database
              syncedIds.add(item.entry.payload.id);
            } else {
              console.error(`Erro ao sincronizar item individual (${item.entry.payload.id}) na tabela ${table}:`, singleError);
            }
          }
        } else {
          // Entire batch succeeded
          items.forEach(x => syncedIds.add(x.entry.payload.id));
        }
      }

      // Filter out successfully synced items from queue
      const remainingQueue = queue.filter(x => x.payload && !syncedIds.has(x.payload.id));
      localStorage.setItem(KEY_SYNC_QUEUE, JSON.stringify(remainingQueue));

      return allSuccess || remainingQueue.length === 0;
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
          } catch {}
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
        const [,, d] = date.split('-');
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
  const { data, error } = await supabase
    .from('registros_checklist')
    .select('*');

  console.log('SUPABASE DATA:', data);
  console.log('SUPABASE ERROR:', error);

  return (data || []) as ChecklistRecord[];
}

export async function fetchPreventiveChecklistsFromSupabase(): Promise<PreventiveChecklistSubmission[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }
  try {
    const { data, error } = await supabase
      .from('checklist_preventivo')
      .select('*')
      .order('data', { ascending: false })
      .order('hora', { ascending: false });
      
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
    const { data, error } = await supabase
      .from('historico_inspecoes')
      .select('*')
      .order('data', { ascending: false })
      .order('hora', { ascending: false });

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
