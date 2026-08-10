"use client";

import { useEffect, useState } from "react";
import { MonitorDown } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (installed || !deferredPrompt) return null;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  return (
    <div className="fixed bottom-6 left-6 z-20">
      <button
        type="button"
        onClick={handleInstall}
        className="flex items-center gap-3 bg-white/90 backdrop-blur shadow-xl border border-slate-200 p-2 rounded-xl hover:bg-white hover:shadow-2xl hover:border-blue-200 transition-all cursor-pointer"
      >
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-[#00296b]">
          <MonitorDown size={16} />
        </div>
        <div className="text-left">
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
            Disponible para escritorio
          </p>
          <p className="text-[10px] font-semibold text-slate-700">
            Instalar aplicación
          </p>
        </div>
      </button>
    </div>
  );
}
