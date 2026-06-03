import React from 'react';
import { cn } from '../../utils/cn';

export const CardTable = ({ children, className, title, subtitle, action }: { children: React.ReactNode, className?: string, title?: string, subtitle?: string, action?: React.ReactNode, key?: React.Key }) => (
  <div className={cn("bg-white rounded-xl shadow-sm border border-[#E2EAF6] overflow-hidden", className)}>
    {(title || action) && (
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div>
          {title && <h3 className="text-sm font-semibold text-[#0f2e64]">{title}</h3>}
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
    )}
    <div className="p-0">{children}</div>
  </div>
);
