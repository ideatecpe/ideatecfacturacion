import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../utils/cn';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  /** Úsalo cuando este modal puede abrirse encima de otro Modal, para que su propio
   * fondo (mismo bg-black/20 backdrop-blur-sm de siempre) quede por encima del modal padre. */
  elevated?: boolean;
}

export const Modal = ({ isOpen, onClose, title, children, className, elevated = false }: ModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
  <motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  onClick={onClose}
  className={elevated
    ? "fixed top-0 left-0 w-screen h-screen bg-black/20 backdrop-blur-sm z-150"
    : "fixed top-0 left-0 w-screen h-screen bg-black/20 backdrop-blur-sm z-60"}
/>
          <div className={elevated
            ? "fixed inset-0 flex items-center justify-center pointer-events-none z-160 p-4"
            : "fixed inset-0 flex items-center justify-center pointer-events-none z-70 p-4"}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                "bg-white rounded-2xl shadow-2xl pointer-events-auto w-full max-w-3xl overflow-hidden flex flex-col",
                className
              )}
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="font-bold text-gray-900">{title}</h3>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[80vh] custom-scrollbar">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
