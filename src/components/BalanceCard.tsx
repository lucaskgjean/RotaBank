import { Wallet, TrendingDown, Calendar } from "lucide-react";
import { Card } from "./UI";

export function BalanceCard({ 
  title, 
  amount, 
  icon: Icon, 
  variant = "emerald" 
}: { 
  title: string; 
  amount: number; 
  icon: any; 
  variant?: "emerald" | "slate" 
}) {
  const colors = {
    emerald: "bg-emerald-600 text-white",
    slate: "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
  };

  return (
    <Card className={`${colors[variant]} border-none`}>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${variant === 'emerald' ? 'bg-white/20' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <p className={`text-xs font-black uppercase tracking-widest mb-1 ${variant === 'emerald' ? 'text-emerald-100' : 'text-slate-400'}`}>
        {title}
      </p>
      <h2 className="text-3xl font-black">
        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}
      </h2>
    </Card>
  );
}
