import { LucideIcon } from "lucide-react";
import { Card } from "./UI";

export function BalanceCard({ 
  title, 
  amount, 
  icon: Icon, 
  variant = "emerald",
  secondaryAmount,
  secondaryTitle
}: { 
  title: string; 
  amount: number; 
  icon: LucideIcon; 
  variant?: "emerald" | "slate" | "rose";
  secondaryAmount?: number;
  secondaryTitle?: string;
}) {
  const colors = {
    emerald: "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20",
    slate: "bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-800",
    rose: "bg-rose-600 text-white shadow-lg shadow-rose-600/20"
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <Card className={`${colors[variant]} p-8`}>
      <div className="flex justify-between items-start mb-6">
        <div className={`p-3 rounded-2xl ${variant === 'emerald' || variant === 'rose' ? 'bg-white/20' : 'bg-slate-100 dark:bg-zinc-800 text-emerald-600'}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      
      {secondaryAmount !== undefined && (
        <div className="mb-4">
          <p className={`text-[9px] font-bold uppercase tracking-widest mb-0.5 ${variant === 'emerald' || variant === 'rose' ? 'text-white/90' : 'text-slate-700 dark:text-zinc-300'}`}>
            {secondaryTitle || "Total"}
          </p>
          <p className="text-lg font-mono font-bold tabular-nums">
            {formatCurrency(secondaryAmount)}
          </p>
        </div>
      )}

      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${variant === 'emerald' || variant === 'rose' ? 'text-white' : 'text-slate-800 dark:text-zinc-200'}`}>
        {title}
      </p>
      <h2 className="text-3xl font-mono font-black tabular-nums">
        {formatCurrency(amount)}
      </h2>
    </Card>
  );
}
