import React, { useMemo, useState, useEffect } from 'react';
import { BatteryCharging, Clock3, Droplets, Gauge, Wrench } from 'lucide-react';
import { LocalDb, generateUUID } from '../lib/db';
import { useEquipments } from '../hooks/useEquipments';
import { useAuth } from '../context/AuthContext';
import { BatteryRechargeRecord, Equipment } from '../types';
import StatusToggle from '../components/StatusToggle';
import SignatureField from '../components/SignatureField';
import { useToast } from '../hooks/useToast';

export default function BatteryRecharge() {
  const { user } = useAuth();
  const { equipments } = useEquipments();
  const { toast, showToast } = useToast();

  const [patrimonio, setPatrimonio] = useState('');
  const [horimetro, setHorimetro] = useState('');
  const [inicioOperador, setInicioOperador] = useState(user?.name || '');
  const [terminoOperador, setTerminoOperador] = useState(user?.name || '');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaTermino, setHoraTermino] = useState('');
  const [carregadorStatus, setCarregadorStatus] = useState<'OK' | 'NOK'>('OK');
  const [reposicaoAgua, setReposicaoAgua] = useState(false);
  const [responsavelReposicao, setResponsavelReposicao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [signatureName, setSignatureName] = useState(user?.name || '');
  const [signatureAccepted, setSignatureAccepted] = useState(false);

  const latest = useMemo(() => LocalDb.getBatteryRechargeRecords().slice(0, 4), [toast.visible]);

  const handleSave = () => {
    if (!patrimonio) return showToast('Selecione o patrimônio do equipamento.', 'error');
    if (!horaInicio || !horaTermino) return showToast('Preencha horário de início e término.', 'error');
    if (!inicioOperador.trim() || !terminoOperador.trim()) return showToast('Informe operadores de início e término.', 'error');
    if (reposicaoAgua && !responsavelReposicao.trim()) return showToast('Informe o responsável pela reposição de água.', 'error');
    if (!signatureName.trim() || !signatureAccepted) return showToast('Assinatura digital obrigatória.', 'error');

    const now = new Date();
    const payload: BatteryRechargeRecord = {
      id: generateUUID(),
      created_at: now.toISOString(),
      data: now.toISOString().slice(0, 10),
      patrimonio,
      horimetro: Number(horimetro.replace(',', '.')) || 0,
      operador_inicio: inicioOperador.trim(),
      operador_termino: terminoOperador.trim(),
      hora_inicio: horaInicio,
      hora_termino: horaTermino,
      carregador_status: carregadorStatus,
      reposicao_agua: reposicaoAgua,
      responsavel_reposicao: responsavelReposicao.trim(),
      observacoes: observacoes.trim(),
      assinatura_nome: signatureName.trim(),
      assinatura_confirmada: signatureAccepted
    };

    LocalDb.saveBatteryRechargeRecord(payload);
    showToast('Módulo de recarga registrado.');
    setPatrimonio('');
    setHorimetro('');
    setHoraInicio('');
    setHoraTermino('');
    setCarregadorStatus('OK');
    setReposicaoAgua(false);
    setResponsavelReposicao('');
    setObservacoes('');
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
          <BatteryCharging className="mt-1 h-5 w-5 text-[#f59e0b]" />
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Abastecimento de Água e Recarga da Bateria</h2>
            <p className="mt-1 text-xs text-slate-400">Registro operacional de ciclo completo de carregamento e manutenção da bateria.</p>
          </div>
        </div>
      </header>

      <section className="tkf-card p-4 space-y-4">
        <div>
          <label className="tkf-label">Patrimônio</label>
          <select value={patrimonio} onChange={(event) => setPatrimonio(event.target.value)} className="tkf-select mt-1.5">
            <option value="">Selecionar equipamento</option>
            {equipments.map((eq) => (
              <option key={eq.id} value={eq.patrimonio}>{eq.patrimonio} - {eq.nome}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex items-center gap-1 tkf-label">
            <Gauge className="h-3.5 w-3.5 text-[#f59e0b]" /> Horímetro
          </label>
          <input value={horimetro} onChange={(event) => setHorimetro(event.target.value.replace(/[^0-9.,]/g, ''))} className="tkf-input mt-1.5" placeholder="Ex: 1320,0" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="tkf-label">Início operador</label>
            <input value={inicioOperador} onChange={(event) => setInicioOperador(event.target.value)} className="tkf-input mt-1.5" />
          </div>
          <div>
            <label className="tkf-label">Término operador</label>
            <input value={terminoOperador} onChange={(event) => setTerminoOperador(event.target.value)} className="tkf-input mt-1.5" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-1 tkf-label">
              <Clock3 className="h-3.5 w-3.5 text-[#f59e0b]" /> Hora início
            </label>
            <input type="time" value={horaInicio} onChange={(event) => setHoraInicio(event.target.value)} className="tkf-input mt-1.5 text-center" />
          </div>
          <div>
            <label className="flex items-center gap-1 tkf-label">
              <Clock3 className="h-3.5 w-3.5 text-[#f59e0b]" /> Hora término
            </label>
            <input type="time" value={horaTermino} onChange={(event) => setHoraTermino(event.target.value)} className="tkf-input mt-1.5 text-center" />
          </div>
        </div>
      </section>

      <section className="tkf-card p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <label className="tkf-label">Situação do carregador</label>
          <div className="w-36"><StatusToggle value={carregadorStatus} onChange={setCarregadorStatus} size="sm" /></div>
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#131a2c]/40 px-3 py-3 text-sm font-medium text-slate-300">
          <Droplets className="h-4 w-4 text-[#4364f7]" />
          <input type="checkbox" checked={reposicaoAgua} onChange={(event) => setReposicaoAgua(event.target.checked)} className="h-4 w-4 rounded border-white/10 bg-[#0e131f] text-[#4364f7] focus:ring-[#4364f7]" />
          Reposição de água executada
        </label>

        {reposicaoAgua && (
          <div className="space-y-1.5">
            <label className="tkf-label">Responsável pela reposição</label>
            <input value={responsavelReposicao} onChange={(event) => setResponsavelReposicao(event.target.value)} className="tkf-input mt-1" />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="tkf-label">Observações</label>
          <textarea value={observacoes} onChange={(event) => setObservacoes(event.target.value)} rows={3} className="w-full rounded-xl border border-white/10 bg-[#131a2c] px-3 py-2 text-sm text-white focus:border-[#4364f7] outline-none" placeholder="Relatar observações ou incidentes técnicos..." />
        </div>
      </section>

      <SignatureField signerName={signatureName} acknowledged={signatureAccepted} onSignerNameChange={setSignatureName} onAcknowledgedChange={setSignatureAccepted} />

      <button onClick={handleSave} className="tkf-btn-primary w-full h-14 flex items-center justify-center gap-2 cursor-pointer text-sm font-bold uppercase tracking-wider">
        <Wrench className="h-4 w-4" />
        Salvar Ciclo de Recarga
      </button>

      <section className="tkf-card p-4 space-y-3">
        <h3 className="tkf-label">Últimos ciclos registrados</h3>
        {latest.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhum ciclo de recarga registrado.</p>
        ) : latest.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-[#131a2c]/30 px-3 py-2 text-xs">
            <div>
              <p className="font-semibold text-slate-200">{entry.patrimonio}</p>
              <p className="text-slate-400">{entry.hora_inicio} - {entry.hora_termino}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold border ${entry.carregador_status === 'OK' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'}`}>{entry.carregador_status}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
