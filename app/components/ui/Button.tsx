import React from 'react';
import { cn } from '../../utils/cn';

export const Button = ({ children, variant = 'primary', className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' }) => {
  const variants = {
    primary: "bg-[#0f2e64] text-white hover:bg-[#0a2050] shadow-sm",
    secondary: "bg-brand-red text-white hover:bg-red-700 shadow-sm",
    outline: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100",
    danger: "bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200",
  };
  return (
    <button className={cn("px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed", variants[variant], className)} {...props}>
      {children}
    </button>
  );
};
