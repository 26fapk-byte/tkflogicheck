import React, { useState, useEffect, useMemo } from 'react';
import { LocalDb, CHECKLIST_ITEMS, generateUUID } from '../lib/db';
import { useEquipments } from '../hooks/useEquipments';
import { ChecklistRecord } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  CheckCircle2, 
  Save, 
  Sparkles, 
  Clock, 
  Calendar, 
  Truck, 
  User, 
  Battery, 
  Gauge, 
  Power 
} from 'lucide-react';
import StatusToggle from '../components/StatusToggle';
import { useToast } from '../hooks/useToast';

export default function NewRecord() {
  const { user } = useAuth();
  const { equipments } = useEquipments();

  // Always include current authenticated user as an available operator.
  const operators = useMemo(() => {
    const list = [...LocalDb.getOperators()];
    if (user) {
      const exists = list.some(op => op.nome.toLowerCase() === user.name.toLowerCase());
      if (!exists) {
        list.push({
          id: user.id || generateUUID(),
          nome: user.name,
          matricula: 'AUTO',
          setor: 'Operações',
          ativo: true
        });
      }
    }
    return list;
  }, [user]);

  // Selected header fields
  const [operator, setOperator] = useState('');
  const [equipment, setEquipment] = useState('');
  const [horimetro, setHorimetro] = useState('');
  const [ligando, setLigando] = useState<'OK' | 'NOK'>('OK');
  const [bateriaBarras, setBateriaBarras] = useState<number>(4);

  // States for the 17 Checklist Attributes
  const [itemsStatus, setItemsStatus] = useState<Record<string, 'OK' | 'NOK'>>(() => {
    const initial: Record<string, 'OK' | 'NOK'> = {};
    CHECKLIST_ITEMS.forEach(i => {
      initial[i.key] = 'OK';
    });
    return initial;
  });

  // State for observation notes by key
  const [itemsObservations, setItemsObservations] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    CHECKLIST_ITEMS.forEach(i => {
      initial[i.key] = '';
    });
    return initial;
  });

  const [generalObservation, setGeneralObservation] = useState('');

  // Date/Time automatically set
  const [currentDate, setCurrentDate] = useState('');
  const [currentTime, setCurrentTime] = useState('');

  const { toast, showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-set operator to logged in user if they are an operator
  useEffect(() => {
    if (user && user.role === 'operador') {
      setOperator(user.name);
    }
  }, [user]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentDate(now.toISOString().split('T')[0]);
      setCurrentTime(now.toTimeString().substring(0, 5));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Shortcut command to quickly mark everything as OK or NOK
  const handleMarkAll = (status: 'OK' | 'NOK') => {
    const updated: Record<string, 'OK' | 'NOK'> = {};
    CHECKLIST_ITEMS.forEach(i => {
      updated[i.key] = status;
    });
    setItemsStatus(updated);
    showToast(`Todos os 17 atributos marcados como ${status}!`, 'success');
  };

  const handleStatusToggle = (key: string, status: 'OK' | 'NOK') => {
    setItemsStatus(prev => ({
      ...prev,
      [key]: status
    }));
  };

  const handleObsChange = (key: string, text: string) => {
    setItemsObservations(prev => ({
      ...prev,
      [key]: text
    }));
  };

  // Submit operations
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!operator) {
      showToast('Por favor, selecione o operador responsável.', 'error');
      return;
    }
    if (!equipment) {
      showToast('Por favor, selecione qual veículo está sendo inspecionado.', 'error');
      return;
    }
    
    const parsedHorimetroStr = horimetro ? horimetro.toString().trim() : '';
    const parsedHorimetro = Number(parsedHorimetroStr.replace(',', '.'));
    if (!parsedHorimetroStr || isNaN(parsedHorimetro) || parsedHorimetro < 0) {
      showToast('Por favor, digite uma leitura válida de Horímetro.', 'error');
      return;
    }

    let hasUnexplainedNok = false;
    CHECKLIST_ITEMS.forEach(item => {
      if (itemsStatus[item.key] === 'NOK' && !itemsObservations[item.key].trim()) {
        hasUnexplainedNok = true;
      }
    });

    if (hasUnexplainedNok) {
      showToast('Atenção: Descreva a não-conformidade (NOK) no campo de observação.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedEquipmentMeta = equipments.find(eq => eq.patrimonio === equipment);
      const eqLabelOutput = selectedEquipmentMeta 
        ? `${selectedEquipmentMeta.nome} (${selectedEquipmentMeta.patrimonio})`
        : equipment;

      const newRecordsToAdd: ChecklistRecord[] = [];
      const timestamp = new Date().toISOString();

      CHECKLIST_ITEMS.forEach(item => {
        newRecordsToAdd.push({
          id: generateUUID(),
          created_at: timestamp,
          data: currentDate,
          hora: currentTime,
          operador: operator,
          equipamento: eqLabelOutput,
          item: item.label,
          status: itemsStatus[item.key],
          observacao: itemsObservations[item.key].trim(),
          patrimonio: equipment,
          horimetro: parsedHorimetro,
          ligando: ligando,
          bateria_barras: bateriaBarras
        });
      });

      if (generalObservation.trim()) {
        newRecordsToAdd.push({
          id: generateUUID(),
          created_at: timestamp,
          data: currentDate,
          hora: currentTime,
          operador: operator,
          equipamento: eqLabelOutput,
          item: 'Observações Gerais',
          status: 'OK',
          observacao: generalObservation.trim(),
          patrimonio: equipment,
          horimetro: parsedHorimetro,
          ligando: ligando,
          bateria_barras: bateriaBarras
        });
      }

      LocalDb.saveRecords(newRecordsToAdd);

      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }

      showToast('Checklist de Empilhadeira registrado com sucesso!', 'success');

      setEquipment('');
      setHorimetro('');
      setLigando('OK');
      setBateriaBarras(4);
      setGeneralObservation('');
      
      const resetStatus: Record<string, 'OK' | 'NOK'> = {};
      const resetObs: Record<string, string> = {};
      CHECKLIST_ITEMS.forEach(i => {
        resetStatus[i.key] = 'OK';
        resetObs[i.key] = '';
      });
      setItemsStatus(resetStatus);
      setItemsObservations(resetObs);

      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
      showToast('Ocorreu uma falha interna ao salvar o registro.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6 relative pb-24 text-white">
      
      {toast.visible && (
        <div 
          className={`tkf-toast flex items-center justify-center gap-3 ${
            toast.type === 'success' 
              ? 'border-emerald-500 bg-[#0e131f] text-emerald-300' 
              : 'border-red-500 bg-[#0e131f] text-red-300'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          ) : null}
          <span>{toast.message}</span>
        </div>
      )}

      <div>
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <span>Novo Registro de Checklist</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Registro operacional digital para a rotina da frota TKF LogiCheck.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        <section className="tkf-card p-4 grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#4364f7]" />
              <span>data automática</span>
            </span>
            <p className="text-sm font-bold text-slate-200">
              {currentDate ? currentDate.split('-').reverse().join('/') : '--/--/----'}
            </p>
          </div>

          <div className="space-y-1 text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex justify-end items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#4364f7]" />
              <span>hora automática</span>
            </span>
            <p className="text-sm font-bold text-emerald-400">{currentTime || '--:--'}</p>
          </div>
        </section>

        <section className="tkf-card p-4 space-y-4">
          <h3 className="tkf-label">
            Identificação de Campo
          </h3>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1" htmlFor="operator">
              <User className="w-3.5 h-3.5 text-[#4364f7]" />
              <span>Operador Responsável</span>
            </label>
            <select
              id="operator"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="tkf-select"
            >
              <option value="">Selecione o Operador...</option>
              {operators.map(op => (
                <option key={op.id} value={op.nome}>
                  {op.nome} - MAT {op.matricula} ({op.setor})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1" htmlFor="eq">
              <Truck className="w-3.5 h-3.5 text-[#4364f7]" />
              <span>Equipamento (Patrimônio)</span>
            </label>
            <select
              id="eq"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              className="tkf-select"
            >
              <option value="">Selecione a Empilhadeira...</option>
              {equipments.map(eq => (
                <option key={eq.id} value={eq.patrimonio}>
                  {eq.patrimonio} - {eq.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1" htmlFor="horimetro">
                <Gauge className="w-3.5 h-3.5 text-[#4364f7]" />
                <span>Horímetro Atual (h)</span>
              </label>
              <input
                id="horimetro"
                type="text"
                inputMode="decimal"
                placeholder="Ex: 1208,5"
                value={horimetro}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9.,]/g, '');
                  setHorimetro(cleaned);
                }}
                className="tkf-input"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1" htmlFor="ignition">
                <Power className="w-3.5 h-3.5 text-[#4364f7]" />
                <span>Ligando?</span>
              </label>
              <StatusToggle value={ligando} onChange={setLigando} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
              <Battery className="w-3.5 h-3.5 text-[#4364f7]" />
              <span>Nível da Carga da Bateria (Barras)</span>
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map(b => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBateriaBarras(b)}
                  className={`h-11 rounded-lg font-bold text-xs border transition-all cursor-pointer flex flex-col items-center justify-center ${
                    bateriaBarras === b
                      ? 'bg-[#4364f7] text-white border-[#4364f7]'
                      : 'bg-[#131a2c] border-white/10 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>{b}</span>
                  <span className="text-[7px] opacity-75">{b === 5 ? 'Cheio' : `${b} B`}</span>
                </button>
              ))}
            </div>
          </div>

        </section>

        <section className="tkf-card p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
            <div>
              <h3 className="tkf-label">
                Itens de Inspeção (17 Itens)
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Selecione o estado de cada dispositivo.</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleMarkAll('OK')}
                className="bg-[#4364f7]/10 hover:bg-[#4364f7]/20 border border-[#4364f7]/30 text-[#93c5fd] px-2.5 py-1.5 rounded text-[10px] font-bold tracking-wide cursor-pointer transition-colors flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#4364f7]" />
                <span>MARCAR TODOS OK</span>
              </button>
            </div>
          </div>

          <div className="space-y-4 divide-y divide-white/5">
            {CHECKLIST_ITEMS.map((item, index) => {
              const itemStatus = itemsStatus[item.key];
              const obsValue = itemsObservations[item.key];

              const categoryLabels: Record<string, { bg: string, text: string, name: string }> = {
                'Eletrico': { bg: 'bg-[#0052d4]/20', text: 'text-[#93c5fd]', name: 'ELÉTRICO' },
                'Mecanico': { bg: 'bg-indigo-500/20', text: 'text-indigo-300', name: 'MECÂNICO' },
                'Seguranca': { bg: 'bg-amber-500/20', text: 'text-amber-300', name: 'SEGURANÇA' },
                'Limpeza': { bg: 'bg-emerald-500/20', text: 'text-emerald-300', name: 'CONSERVAÇÃO' }
              };
              const cat = categoryLabels[item.categoria] || { bg: 'bg-slate-500/20', text: 'text-slate-300', name: 'DIVERSOS' };

              return (
                <div key={item.key} className={`pt-4 first:pt-0 space-y-2.5 ${itemStatus === 'NOK' ? 'bg-[#ffdad6]/5 -mx-4 px-4 py-2 rounded-lg' : ''}`}>
                  
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className={`inline-block text-[8px] font-bold px-1.5 py-0.2 rounded ${cat.bg} ${cat.text} tracking-wider`}>
                        {cat.name}
                      </span>
                      <h4 className="text-sm font-semibold text-slate-200">{item.label}</h4>
                    </div>

                    <div className="w-36">
                      <StatusToggle value={itemStatus} onChange={(value) => handleStatusToggle(item.key, value)} size="sm" />
                    </div>
                  </div>

                  {itemStatus === 'NOK' && (
                    <div className="bg-[#ba1a1a]/5 border border-red-500/20 p-3 rounded-lg space-y-2 animate-fade-in transition-all">
                      <label className="text-[11px] font-bold text-red-300 block uppercase tracking-wide">
                        * DESCREVA O DETALHE DA AVARIA / FALHA:
                      </label>
                      <textarea
                        rows={2}
                        value={obsValue}
                        onChange={(e) => handleObsChange(item.key, e.target.value)}
                        placeholder="Ex: Mangueira apresentando vazamento de óleo ou buzina sem sinal sonoro..."
                        className="w-full text-xs p-2.5 bg-[#0e131f] border border-red-500/20 rounded focus:outline-none focus:border-red-400 text-white leading-relaxed"
                      />
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </section>

        <section className="tkf-card p-4 space-y-2">
          <label className="tkf-label block" htmlFor="general-obs">
            Observações Gerais (Opcional)
          </label>
          <textarea
            id="general-obs"
            rows={3}
            value={generalObservation}
            onChange={(e) => setGeneralObservation(e.target.value)}
            placeholder="Relate observações gerais do turno ou pendências técnicas da empilhadeira..."
            className="w-full text-xs p-3 bg-[#131a2c] border border-white/10 rounded-lg focus:outline-none focus:border-[#4364f7] text-white"
          />
        </section>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="tkf-btn-primary w-full h-14 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider text-sm font-bold disabled:opacity-70"
          >
            <Save className="w-5 h-5" />
            <span>Salvar Checklist Operacional</span>
          </button>
          <p className="text-center text-[10px] text-slate-400 mt-3">Ao salvar, o checklist fica disponível no histórico e no dashboard gerencial.</p>
        </div>

      </form>

    </div>
  );
}
