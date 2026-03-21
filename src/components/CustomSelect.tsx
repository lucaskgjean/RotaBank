import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

interface Option {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export function CustomSelect({ 
  label, 
  options, 
  value, 
  onChange,
  className = ""
}: { 
  label: string; 
  options: Option[]; 
  value: string; 
  onChange: (val: string) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value);

  return (
    <div className="flex flex-col gap-2 relative">
      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-800 dark:text-zinc-200 ml-2">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`bg-slate-100 dark:bg-zinc-800 border border-transparent focus:border-emerald-500/50 dark:focus:border-emerald-500/30 rounded-2xl px-4 py-3 flex items-center justify-between text-left outline-none transition-all ${className}`}
      >
        <span className="flex items-center gap-3 text-slate-900 dark:text-zinc-100">
          <span className="text-emerald-500">{selectedOption?.icon}</span>
          <span className="font-medium">{selectedOption?.label || "Selecione..."}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-zinc-800 z-50 overflow-hidden">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-3 transition-colors text-slate-700 dark:text-zinc-300"
              >
                <span className="text-emerald-500">{option.icon}</span>
                <span className="font-medium">{option.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
