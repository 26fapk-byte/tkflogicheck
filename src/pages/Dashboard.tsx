import React, { useEffect, useMemo, useState } from 'react';
import { LocalDb, createEquipment, removeEquipment, generateUUID } from '../lib/db';
import { ChecklistRecord } from '../types';
import { useEquipments } from '../hooks/useEquipments';
import {
  Truck,
  AlertCircle,
  Trash2,
  Plus,
  Info,
  CheckCircle2,
  Clock,
  User,
  Siren,
  CircleDot,
  Activity
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [records, setRecords] = useState<ChecklistRecord[]>([]);
  const { equipments, reload: reloadEquipments } = useEquipments();
  const [selectedMonth, setSelectedMonth] = useState('Todos');
  const [selectedEq, setSelectedEq] = useState('Todos');
  const [selectedStatus, setSelectedStatus] = useState('Todos');
  const [equipmentName, setEquipmentName] = useState('');
  const [equipmentPatrimonio, setEquipmentPatrimonio] = useState('');
  const [equipmentType, setEquipmentType] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadData = async () => {
    setRecords(LocalDb.getRecords());
    reloadEquipments();
  };

  useEffect(() => {
    loadData();
  }, []);

  // Permission check: Only gerente/master can access this dashboard
  useEffect(() => {
    if (user && user.role === 'operador') {
      window.location.href = '/';
    }
  }, [user]);

  const filteredRecords = useMemo(() => {
    let result = [...records];
    if (selectedMonth !== 'Todos') {
      result = result.filter((record) => record.data.startsWith(selectedMonth));
    }
    if (selectedEq !== 'Todos') {
      result = result.filter((record) => record.equipamento.includes(selectedEq));
    }
    if (selectedStatus !== 'Todos') {
      result = result.filter((record) => record.status === selectedStatus);
    }
    return result.sort((a, b) => `${b.data} ${b.hora}`.localeCompare(`${a.data} ${a.hora}`));
  }, [records, selectedMonth, selectedEq, selectedStatus]);

  const months = useMemo(() => {
    const unique = Array.from(new Set(records.map((record) => record.data.substring(0, 7))));
    return unique.sort((a: string, b: string) => b.localeCompare(a));
  }, [records]);

  const totalInspections = useMemo(() => {
    const inspectionKeys = new Set(records.map((record) => `${record.data}_${record.hora}_${record.equipamento}`));
    return inspectionKeys.size;
  }, [records]);

  const totalOk = useMemo(() => records.filter((record) => record.status === 'OK').length, [records]);
  const totalNok = useMemo(() => records.filter((record) => record.status === 'NOK').length, [records]);
  const today = new Date().toISOString().slice(0, 10);
  const checklistsToday = useMemo(() => {
    const keys = new Set(
      records
        .filter((record) => record.data === today)
        .map((record) => `${record.data}_${record.hora}_${record.equipamento}`)
    );
    return keys.size;
  }, [records, today]);

  const equipmentHealth = useMemo(() => {
    return equipments.map((equipment) => {
      const equipmentRecords = records.filter((record) => record.patrimonio === equipment.patrimonio);
      const latest = equipmentRecords.sort((a, b) => `${b.data} ${b.hora}`.localeCompare(`${a.data} ${a.hora}`))[0];
      const failedItems = equipmentRecords.filter((record) => record.status === 'NOK' && record.data === latest?.data && record.hora === latest?.hora).map((record) => record.item);
      return {
        ...equipment,
        lastInspection: latest ? `${latest.data.split('-').reverse().join('/')} ${latest.hora}` : 'Sem registro',
        lastOperator: latest?.operador ?? 'Sem operador',
        status: latest ? (failedItems.length > 0 ? 'NOK' : 'OK') : 'Sem inspe��o',
        failedItems
      };
    });
  }, [equipments, records]);

  const operatorRanking = useMemo(() => {
    const countMap: Record<string, number> = {};
    records.forEach((record) => {
      if (!record.operador) return;
      countMap[record.operador] = (countMap[record.operador] || 0) + 1;
    });
    return Object.entries(countMap)
      .map(([operador, count]) => ({ operador, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [records]);

  const recurringFailures = useMemo(() => {
    const failures: Record<string, number> = {};
    records.forEach((record) => {
      if (record.status === 'NOK') {
        failures[record.item] = (failures[record.item] || 0) + 1;
      }
    });
    return Object.entries(failures)
      .map(([item, count]) => ({ item, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [records]);

  const criticalEquipments = useMemo(
    () => equipmentHealth.filter((item) => item.status === 'NOK').slice(0, 5),
    [equipmentHealth]
  );

  const handleDeleteRecord = (id: string) => {
    if (!user || (user.role !== 'gerente' && user.role !== 'master')) {
      setNotification({ message: 'Voc� n�o tem permiss�o para excluir registros.', type: 'error' });
      return;
    }

    const success = LocalDb.deleteRecord(id);
    if (success) {
      setNotification({ message: 'Registro exclu�do com sucesso.', type: 'success' });
      loadData();
    } else {
      setNotification({ message: 'N�o foi poss�vel excluir o registro. Tente novamente.', type: 'error' });
    }
  };

  const handleCreateEquipment = async () => {
    if (!equipmentName.trim() || !equipmentPatrimonio.trim() || !equipmentType.trim()) {
      setNotification({ message: 'Preencha todos os campos do cadastro de equipamento.', type: 'error' });
      return;
    }
    const result = await createEquipment({
      id: generateUUID(),
      nome: equipmentName.trim(),
      patrimonio: equipmentPatrimonio.trim().toUpperCase(),
      tipo: equipmentType.trim(),
      ativo: true
    });
    if (!result.success) {
      setNotification({ message: result.error || 'Não foi possível cadastrar o equipamento.', type: 'error' });
      return;
    }
    setEquipmentName('');
    setEquipmentPatrimonio('');
    setEquipmentType('');
    setNotification({ message: 'Equipamento cadastrado com sucesso.', type: 'success' });
    loadData();
  };

  const handleRemoveEquipment = async (id: string) => {
    const success = await removeEquipment(id);
    if (!success) {
      setNotification({ message: 'Não foi possível remover o equipamento.', type: 'error' });
      return;
    }
    setNotification({ message: 'Equipamento removido da frota.', type: 'success' });
    loadData();
  };

  useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(() => setNotification(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notification]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 pb-24">
      {notification && (
        <div className={`tkf-toast ${notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {notification.message}
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="tkf-title">Painel Operacional Enterprise</h1>
          <p className="text-sm text-[#475569] max-w-2xl mt-1">Visão gerencial de produtividade, ativos e auditorias da operação TKF LogiCheck.</p>
        </div>
      </div>

      <section className="tkf-card p-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="tkf-label">Período</label>
          <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="tkf-select mt-1">
            <option value="Todos">Todos os meses</option>
            {months.map((month) => (
              <option key={month} value={month}>
                {month.split('-')[1]}/{month.split('-')[0]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="tkf-label">Ativo</label>
          <select value={selectedEq} onChange={(event) => setSelectedEq(event.target.value)} className="tkf-select mt-1">
            <option value="Todos">Todos os ativos</option>
            {equipments.map((eq) => (
              <option key={eq.id} value={eq.patrimonio}>{eq.patrimonio} - {eq.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="tkf-label">Status</label>
          <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)} className="tkf-select mt-1">
            <option value="Todos">Todos</option>
            <option value="OK">OK</option>
            <option value="NOK">NOK</option>
          </select>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="tkf-card p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#64748B]">Inspeções totais</p>
          <h2 className="mt-3 text-3xl font-bold text-[#0F172A]">{totalInspections}</h2>
          <p className="mt-2 text-xs text-[#475569]">Contagem de checklists �nicos enviados hoje e no hist�rico.</p>
        </article>

        <article className="tkf-card p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#64748B]">Checklists do dia</p>
          <h2 className="mt-3 text-3xl font-bold text-[#0F172A]">{checklistsToday}</h2>
          <div className="mt-2 flex items-center gap-2 text-xs text-[#1D4ED8]">
            <Activity className="w-4 h-4" />
            <span>Movimento operacional hoje</span>
          </div>
        </article>

        <article className="tkf-card p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#64748B]">Status OK</p>
          <h2 className="mt-3 text-3xl font-bold text-[#0F172A]">{totalOk}</h2>
          <div className="mt-2 flex items-center gap-2 text-xs text-[#047857]">
            <CheckCircle2 className="w-4 h-4" />
            <span>Registros conformes</span>
          </div>
        </article>

        <article className="tkf-card p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#64748B]">Status NOK</p>
          <h2 className="mt-3 text-3xl font-bold text-[#0F172A]">{totalNok}</h2>
          <div className="mt-2 flex items-center gap-2 text-xs text-[#881337]">
            <AlertCircle className="w-4 h-4" />
            <span>Registros com n�o conformidades</span>
          </div>
        </article>

        <article className="rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#64748B]">M�quinas ativas</p>
          <h2 className="mt-3 text-3xl font-bold text-[#0F172A]">{equipments.length}</h2>
          <div className="mt-2 flex items-center gap-2 text-xs text-[#1D4ED8]">
            <Truck className="w-4 h-4" />
            <span>Checklists registrados</span>
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
        <article className="tkf-card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#64748B]">Ranking de Produtividade</p>
              <h2 className="mt-2 text-xl font-bold text-[#0F172A]">Operadores com mais registros</h2>
            </div>
            <div className="rounded-2xl bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A] border border-[#E2E8F0]">
              Total de operadores: {operatorRanking.length}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {operatorRanking.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 text-sm text-[#64748B]">Ainda n�o h� registros suficientes.</div>
            ) : (
              operatorRanking.map((entry, index) => (
              <div key={entry.operador} className="flex items-center justify-between rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A]">{entry.operador}</p>
                    <p className="text-[11px] text-[#64748B]">A��es registradas</p>
                  </div>
                  <div className="rounded-full bg-[#E2E8F8] px-3 py-1 text-sm font-bold text-[#0F172A]">{entry.count}</div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="tkf-card p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#64748B]">Saúde da Frota</p>
          <h2 className="mt-2 text-xl font-bold text-[#0F172A]">Empilhadeiras críticas</h2>
          <div className="mt-5 space-y-3">
            {(criticalEquipments.length ? criticalEquipments : equipmentHealth.slice(0, 5)).map((equipment) => (
              <div key={equipment.id} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#0F172A]">{equipment.nome}</p>
                    <p className="text-[11px] text-[#64748B]">{equipment.patrimonio} � {equipment.tipo}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${equipment.status === 'OK' ? 'bg-[#E6F7F8] text-[#006970]' : equipment.status === 'NOK' ? 'bg-[#FEF2F2] text-[#981B1B]' : 'bg-[#E2E8F0] text-[#475569]'}`}>
                    {equipment.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-[11px] text-[#475569]">
                  <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-[#64748B]" /> {equipment.lastInspection}</span>
                  <span className="flex items-center gap-2"><User className="w-4 h-4 text-[#64748B]" /> {equipment.lastOperator}</span>
                </div>
                {equipment.failedItems?.length ? (
                  <div className="mt-3 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-[11px] text-[#981B1B]">
                    <p className="font-semibold">Itens NOK:</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {equipment.failedItems.map((item, index) => (
                        <span key={index} className="rounded-full bg-[#FEE2E2] px-2 py-1">{item}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="tkf-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#64748B]">Auditoria de checklist</p>
              <h2 className="mt-2 text-xl font-bold text-[#0F172A]">Registros gerais</h2>
            </div>
            <span className="rounded-full bg-[#E6F7F8] px-3 py-2 text-[11px] text-[#006970] border border-[#1e3a8a]">{filteredRecords.length} itens filtrados</span>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-[12px] text-[#1E293B]">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[#64748B] uppercase tracking-[0.18em] text-[10px]">
                  <th className="px-3 py-3">Data</th>
                  <th className="px-3 py-3">Equipamento</th>
                  <th className="px-3 py-3">Item</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Operador</th>
                  <th className="px-3 py-3">A��o</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.slice(0, 15).map((record) => (
                  <tr key={record.id} className="border-b border-[#F1F4F6] hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-3 py-3 whitespace-nowrap text-[#475569]">{record.data.split('-').reverse().join('/')}</td>
                    <td className="px-3 py-3 font-semibold text-[#0F172A]">{record.equipamento}</td>
                    <td className="px-3 py-3">{record.item}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${record.status === 'OK' ? 'bg-[#E6F7F8] text-[#006970]' : 'bg-[#003366] text-white'}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">{record.operador}</td>
                    <td className="px-3 py-3">
                      {(user?.role === 'gerente' || user?.role === 'master') ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(record.id)}
                          className="inline-flex items-center gap-2 rounded-full bg-[#FEF2F2] px-3 py-2 text-[10px] font-semibold text-[#981B1B] border border-[#FECACA] hover:bg-[#FEE2E2] transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Excluir
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#6C797B]">Sem permiss�o</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredRecords.length > 15 && (
            <div className="mt-4 text-xs text-[#64748B]">Apenas os 15 registros mais recentes s�o exibidos aqui para performance.</div>
          )}
        </article>

        <article className="tkf-card p-5">
          <div className="flex items-center gap-3">
            <Plus className="w-5 h-5 text-[#1E3A8A]" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#64748B]">Cadastro de Equipamento</p>
              <h2 className="text-xl font-bold text-[#0F172A]">Gerencie ativos da Checklists</h2>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Nome do equipamento</label>
              <input
                value={equipmentName}
                onChange={(event) => setEquipmentName(event.target.value)}
                className="tkf-input"
                placeholder="Empilhadeira elétrica Toyota 8FBRE16S"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Patrim�nio</label>
              <input
                value={equipmentPatrimonio}
                onChange={(event) => setEquipmentPatrimonio(event.target.value)}
                className="tkf-input"
                placeholder="EMP-4410"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Tipo de ativo</label>
              <input
                value={equipmentType}
                onChange={(event) => setEquipmentType(event.target.value)}
                className="tkf-input"
                placeholder="Empilhadeira retrátil"
              />
            </div>
            <button
              type="button"
              onClick={handleCreateEquipment}
              className="tkf-btn-primary w-full uppercase tracking-[0.16em]"
            >
              Cadastrar ativo
            </button>
          </div>

          <div className="mt-8 space-y-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#64748B]">Registros operacionais</div>
            {equipments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 text-sm text-[#64748B]">Nenhum equipamento cadastrado.</div>
            ) : (
              <div className="space-y-3">
                {equipments.map((equipment) => (
                  <div key={equipment.id} className="flex flex-col gap-3 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#0F172A]">{equipment.nome}</p>
                        <p className="text-[11px] text-[#64748B]">{equipment.patrimonio} � {equipment.tipo}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveEquipment(equipment.id)}
                        className="tkf-btn-danger"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="tkf-card p-5">
          <div className="flex items-center gap-2 font-semibold text-[#0F172A] mb-2">
            <Siren className="w-4 h-4 text-amber-600" />
            Falhas Recorrentes
          </div>
          <div className="space-y-2">
            {recurringFailures.length === 0 ? (
              <div className="tkf-empty">Nenhuma falha recorrente no período selecionado.</div>
            ) : recurringFailures.map((failure) => (
              <div key={failure.item} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <span className="font-medium text-slate-700">{failure.item}</span>
                <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-700">{failure.count}x</span>
              </div>
            ))}
          </div>
        </article>

        <article className="tkf-card p-5">
          <div className="flex items-center gap-2 font-semibold text-[#0F172A] mb-2">
            <CircleDot className="w-4 h-4 text-[#2563eb]" />
            Atividade Recente
          </div>
          <div className="space-y-2">
            {filteredRecords.slice(0, 6).map((record) => (
              <div key={record.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <p className="font-semibold text-slate-800">{record.equipamento}</p>
                <p className="text-slate-600">{record.item} • {record.status} • {record.operador}</p>
              </div>
            ))}
            {filteredRecords.length === 0 && <div className="tkf-empty">Sem atividade recente para os filtros atuais.</div>}
          </div>
        </article>
      </section>

      <section className="tkf-card-muted p-5 text-sm text-[#475569]">
        <div className="flex items-center gap-2 font-semibold text-[#0F172A] mb-2">
          <Info className="w-4 h-4" />
          Observação de Gestão
        </div>
        <p>
          Esta área permite que gerentes visualizem o status de toda a operação,
          ajustem ativos e removam registros indevidos com segurança.
          A exclusão de registros também mantém sincronização com o banco de dados
          remoto quando o Supabase estiver configurado.
        </p>
      </section>
    </div>
  );
}