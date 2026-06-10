import React, { useMemo, useState, useEffect } from 'react';
import { AlertTriangle, Battery, ClipboardCheck, Gauge, Truck } from 'lucide-react';
import { LocalDb, CHECKLIST_ITEMS, generateUUID } from '../lib/db';
import { useEquipments } from '../hooks/useEquipments';
import { useAuth } from '../context/AuthContext';
import { PreventiveChecklistSubmission, Equipment } from '../types';
import StatusToggle from '../components/StatusToggle';
import SignatureField from '../components/SignatureField';
import { useToast } from '../hooks/useToast';

export default function PreventiveChecklist() {
  const { user } = useAuth();
  const { equipments } = useEquipments();
  const { toast, showToast } = useToast();
  const [equipment, setEquipment] = useState('');
  const [horimetro, setHorimetro] = useState('');
  const [batteryBars, setBatteryBars] = useState(4);
  const [generalNotes, setGeneralNotes] = useState('');
  const [signatureName, setSignatureName] = useState(user?.name || '');
  const [signatureAccepted, setSignatureAccepted] = useState(false);

  const [itemsState, setItemsState] = useState<Record<string, { status: 'OK' | 'NOK'; observacao: string }>>(() => {
    const state: Record<string, { status: 'OK' | 'NOK'; observacao: string }> = {};
    CHECKLIST_ITEMS.forEach((item) => {
      state[item.key] = { status: 'OK', observacao: '' };
    });
    return state;
  });

  const statusGeral = useMemo(
    () => (Object.values(itemsState).some((item) => item.status === 'NOK') ? 'NOK' : 'OK'),
    [itemsState]
  );

  const handleSave = async () => {
    if (!user) return;
    if (!equipment) return showToast('Selecione o equipamento inspecionado.', 'error');
    if (!horimetro.trim()) return showToast('Informe o horímetro.', 'error');
    if (!signatureName.trim() || !signatureAccepted) {
      return showToast('Finalize a assinatura digital para concluir.', 'error');
    }

    const pending = CHECKLIST_ITEMS.find((item) => itemsState[item.key].status === 'NOK' && !itemsState[item.key].observacao.trim());
    if (pending) return showToast(`Descreva o item NOK: ${pending.label}.`, 'error');

    const selectedEq = equipments.find((eq) => eq.patrimonio === equipment);
    const now = new Date();

    const submission: PreventiveChecklistSubmission = {
      id: generateUUID(),
      created_at: now.toISOString(),
      data: now.toISOString().slice(0, 10),
      hora: now.toTimeString().slice(0, 5),
      operador: user.name || user.email || '',
      equipamento: selectedEq ? selectedEq.nome : 'Empilhadeira',
      patrimonio: equipment,
      horimetro: Number(horimetro.replace(',', '.')),
      bateria_barras: batteryBars,
      observacoes_gerais: generalNotes.trim(),
      assinatura_nome: signatureName.trim(),
      assinatura_confirmada: signatureAccepted,
      status_geral: statusGeral,
      itens: CHECKLIST_ITEMS.map((item) => ({
        itemKey: item.key,
        itemLabel: item.label,
        status: itemsState[item.key].status,
        observacao: itemsState[item.key].observacao.trim()
      }))
    };

    LocalDb.savePreventiveChecklist(submission);
    showToast('Checklist preventivo registrado com sucesso.');
    setEquipment('');
    setHorimetro('');
    setBatteryBars(4);
    setGeneralNotes('');
    setSignatureAccepted(false);
  };


  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-5 pb-24 text-white">
      {toast.visible && (
        <div className={`tkf-toast flex items-center justify-center text-center ${toast.type === 'success' ? 'border-emerald-500 bg-[#0e131f] text-emerald-300' : 'border-red-500 bg-[#0e131f] text-red-300'}`}>
          {toast.message}
        </div>
      )}

      <header className="rounded-3xl border border-white/10 bg-[#0e131f] p-5 shadow-[0_20px_45px_rgba(14,19,31,0.5)]">
        <div className="flex items-start gap-3">
          <ClipboardCheck className="mt-1 h-5 w-5 text-[#4364f7]" />
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Checklist Preventivo de Empilhadeira</h2>
            <p className="mt-1 text-xs text-slate-400">Fluxo operacional mobile-first integrado com o Supabase.</p>
          </div>
        </div>
      </header>

      <section className="tkf-card p-4 space-y-4">
        <div>
          <label className="tkf-label">Operador autenticado</label>
          <div className="mt-1.5 flex h-12 w-full items-center rounded-xl border border-white/5 bg-[#131a2c]/60 px-3 text-sm font-semibold text-slate-300 select-none">
            {user?.email}
          </div>
        </div>

        <div>
          <label className="tkf-label">Equipamento</label>
          <select value={equipment} onChange={(event) => setEquipment(event.target.value)} className="tkf-select mt-1.5">
            <option value="">Selecionar patrimônio</option>
            {equipments.map((eq) => (
              <option key={eq.id} value={eq.patrimonio}>
                {eq.patrimonio} - {eq.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-1 tkf-label">
              <Gauge className="h-3.5 w-3.5 text-[#4364f7]" /> Horímetro
            </label>
            <input value={horimetro} onChange={(event) => setHorimetro(event.target.value.replace(/[^0-9.,]/g, ''))} className="tkf-input mt-1.5" placeholder="Ex: 1120,5" />
          </div>
          <div>
            <label className="flex items-center gap-1 tkf-label">
              <Battery className="h-3.5 w-3.5 text-[#4364f7]" /> Carga
            </label>
            <div className="grid h-12 grid-cols-5 gap-1 rounded-xl border border-white/10 bg-[#131a2c] p-1 mt-1.5">
              {[1, 2, 3, 4, 5].map((b) => (
                <button key={b} type="button" onClick={() => setBatteryBars(b)} className={`rounded-md text-[11px] font-bold transition-all cursor-pointer ${batteryBars === b ? 'bg-[#4364f7] text-white' : 'text-slate-400 hover:text-white'}`}>{b}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="tkf-card p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h3 className="text-sm font-semibold text-white">Itens de inspeção</h3>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold border ${statusGeral === 'OK' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'}`}>
            Status geral {statusGeral}
          </span>
        </div>

        <div className="space-y-3.5">
          {CHECKLIST_ITEMS.map((item) => (
            <article key={item.key} className="space-y-2 rounded-xl border border-white/5 bg-[#131a2c]/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-200">{item.label}</p>
                <div className="w-32">
                  <StatusToggle value={itemsState[item.key].status} onChange={(status) => setItemsState((prev) => ({ ...prev, [item.key]: { ...prev[item.key], status } }))} size="sm" />
                </div>
              </div>
              {itemsState[item.key].status === 'NOK' && (
                <textarea
                  value={itemsState[item.key].observacao}
                  onChange={(event) => setItemsState((prev) => ({ ...prev, [item.key]: { ...prev[item.key], observacao: event.target.value } }))}
                  rows={2}
                  className="w-full rounded-xl border border-amber-500/35 bg-[#0e131f] px-3 py-2 text-xs text-white focus:border-amber-500 outline-none"
                  placeholder="Descreva a não conformidade encontrada..."
                />
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="tkf-card p-4 space-y-3">
        <label className="tkf-label">Observações Gerais</label>
        <textarea value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} rows={3} className="w-full rounded-xl border border-white/10 bg-[#131a2c] px-3 py-2 text-sm text-white outline-none" placeholder="Opcional: Descreva observações adicionais sobre a máquina..." />
      </section>

      <section className="tkf-card p-4">
        <SignatureField signerName={signatureName} onSignerNameChange={setSignatureName} acknowledged={signatureAccepted} onAcknowledgedChange={setSignatureAccepted} />
        <button type="button" onClick={handleSave} className="tkf-btn-primary w-full mt-4 py-3.5 text-sm font-bold tracking-wide">
          Salvar e Enviar Inspeção
        </button>
      </section>
    </div>
  );
}
