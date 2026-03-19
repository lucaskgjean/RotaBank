import React, { ReactNode } from "react";
import { motion } from "motion/react";

interface CardProps {
  children: ReactNode;
  className?: string;
  key?: any;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass rounded-4xl p-8 ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function Button({ 
  children, 
  onClick, 
  className = "", 
  variant = "primary",
  type = "button"
}: { 
  children: ReactNode; 
  onClick?: () => void; 
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
  type?: "button" | "submit";
}) {
  const variants = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20",
    secondary: "bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700",
    ghost: "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
  };

  return (
    <button
      type={type}
      onClick={onClick}
      className={`px-6 py-3 rounded-2xl font-bold transition-all active:scale-95 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input({ 
  label, 
  ...props 
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-black uppercase tracking-wider text-slate-400 ml-2">
        {label}
      </label>
      <input
        {...props}
        className="bg-slate-100 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
      />
    </div>
  );
}
