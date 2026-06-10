import React from 'react';
import { PenLine } from 'lucide-react';

interface SignatureFieldProps {
  signerName: string;
  acknowledged: boolean;
  onSignerNameChange: (name: string) => void;
  onAcknowledgedChange: (value: boolean) => void;
}

export default function SignatureField({
  signerName,
  acknowledged,
  onSignerNameChange,
  onAcknowledgedChange
}: SignatureFieldProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <PenLine className="h-4 w-4 text-[#1e3a8a]" />
        <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-600">Assinatura Digital</h3>
      </div>
      <div className="space-y-3">
        <input
          value={signerName}
          onChange={(event) => onSignerNameChange(event.target.value)}
          placeholder="Nome completo para validação da assinatura"
          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-[#2563eb]"
        />
        <label className="flex items-start gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => onAcknowledgedChange(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#2563eb]"
          />
          Confirmo que as informações registradas são verdadeiras e representam a execução operacional.
        </label>
      </div>
    </section>
  );
}
