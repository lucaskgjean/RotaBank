import { LucideIcon } from "lucide-react";
import { Card } from "./UI";

export function BalanceCard({ 
  title, 
  amount, 
  icon: Icon, 
  variant = "emerald" 
}: { 
  title: string; 
  amount: number; 
  icon: LucideIcon; 
  variant?: "emerald" | "slate" | "rose";
}) {
  const colors = {
    emerald: "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20",
    slate: "bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-800",
    rose: "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
  };

  return (
    <Card className={`${colors[variant]} p-8`}>
      <div className="flex justify-between items-start mb-6">
        <div className={`p-3 rounded-2xl ${variant === 'emerald' || variant === 'rose' ? 'bg-white/20' : 'bg-slate-100 dark:bg-zinc-800 text-emerald-500'}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${variant === 'emerald' || variant === 'rose' ? 'text-white/80' : 'text-slate-500 dark:text-zinc-500'}`}>
        {title}
      </p>
      <h2 className="text-3xl font-mono font-medium tabular-nums">
        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}
      </h2>
    </Card>
  );
}
