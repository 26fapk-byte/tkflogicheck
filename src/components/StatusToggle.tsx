import React from 'react';
import { Check, X } from 'lucide-react';

interface StatusToggleProps {
  value: 'OK' | 'NOK';
  onChange: (value: 'OK' | 'NOK') => void;
  size?: 'sm' | 'md';
}

export default function StatusToggle({ value, onChange, size = 'md' }: StatusToggleProps) {
  const baseSize = size === 'sm' ? 'h-10' : 'h-12';

  return (
    <div className={`grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 ${baseSize}`}>
      <button
        type="button"
        onClick={() => onChange('OK')}
        className={`flex items-center justify-center gap-1 rounded-lg text-xs font-bold transition ${
          value === 'OK' ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'text-slate-500'
        }`}
      >
        <Check className="h-3.5 w-3.5" />
        OK
      </button>
      <button
        type="button"
        onClick={() => onChange('NOK')}
        className={`flex items-center justify-center gap-1 rounded-lg text-xs font-bold transition ${
          value === 'NOK' ? 'bg-[#1e3a8a] text-white border border-[#1e40af]' : 'text-slate-500'
        }`}
      >
        <X className="h-3.5 w-3.5" />
        NOK
      </button>
    </div>
  );
}
