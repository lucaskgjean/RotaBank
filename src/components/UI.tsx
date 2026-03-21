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
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`glass-card p-8 ${className}`}
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
  variant?: "primary" | "secondary" | "ghost" | "danger";
  type?: "button" | "submit";
}) {
  const variants = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20",
    secondary: "bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
    ghost: "bg-transparent hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300",
    danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-600/20"
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      type={type}
      onClick={onClick}
      className={`px-6 py-3 rounded-2xl font-bold transition-all ${variants[variant]} ${className}`}
    >
      {children}
    </motion.button>
  );
}

export function Input({ 
  label, 
  className = "",
  ...props 
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-800 dark:text-zinc-200 ml-2">
        {label}
      </label>
      <input
        {...props}
        className={`bg-slate-100 dark:bg-zinc-800 border-2 border-transparent focus:border-emerald-600/50 dark:focus:border-emerald-600/30 rounded-2xl px-4 py-3 text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-500 outline-none transition-all font-medium ${className}`}
      />
    </div>
  );
}
