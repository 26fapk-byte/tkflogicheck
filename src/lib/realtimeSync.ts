import { supabase } from './supabase';
import { ChecklistRecord } from '../types';

export class RealtimeSync {
  private subscription: any = null;

  subscribe(callback: (record: ChecklistRecord) => void) {
    if (!supabase) return;

    // Usar cliente de realtime do Supabase v2+
    this.subscription = supabase
      .channel('registros_checklist')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'registros_checklist' },
        (payload: any) => {
          callback(payload.new as ChecklistRecord);
        }
      )
      .subscribe();
  }

  unsubscribe() {
    if (this.subscription) {
      supabase?.removeChannel(this.subscription);
    }
  }

  subscribeToEquipment(patrimonio: string, callback: (record: ChecklistRecord) => void) {
    if (!supabase) return;

    this.subscription = supabase
      .channel(`registros_${patrimonio}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'registros_checklist' },
        (payload: any) => {
          const record = payload.new as ChecklistRecord;
          if (record.patrimonio === patrimonio) {
            callback(record);
          }
        }
      )
      .subscribe();
  }
}

export const realtime = new RealtimeSync();
