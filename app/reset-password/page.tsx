"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Building2,
  ShieldCheck,
} from "lucide-react";

enum ResetStatus {
  IDLE = "IDLE",
  LOADING = "LOADING",
  SUCCESS = "SUCCESS",
  ERROR = "ERROR",
  INVALID_TOKEN = "INVALID_TOKEN",
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState<ResetStatus>(ResetStatus.IDLE);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) setStatus(ResetStatus.INVALID_TOKEN);
  }, [token]);

  const passwordStrength = () => {
    if (password.length === 0) return null;
    if (password.length < 8) return { label: "Muy corta", color: "bg-red-500", width: "w-1/4" };
    if (password.length < 12) return { label: "Débil", color: "bg-orange-500", width: "w-2/4" };
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password))
      return { label: "Media", color: "bg-yellow-500", width: "w-3/4" };
    return { label: "Fuerte", color: "bg-green-500", width: "w-full" };
  };

  const strength = passwordStrength();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (password.length < 8) {
      setErrorMsg("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Las contraseñas no coinciden.");
      return;
    }

    setStatus(ResetStatus.LOADING);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, newPassword: password }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setStatus(ResetStatus.ERROR);
        setErrorMsg(data.message ?? "Error al restablecer la contraseña.");
        return;
      }

      setStatus(ResetStatus.SUCCESS);
      setTimeout(() => router.push("/"), 3000);
    } catch {
      setStatus(ResetStatus.ERROR);
      setErrorMsg("Error de conexión. Intenta nuevamente.");
    }
  };

  // ── Token inválido ─────────────────────────────────────────────────────
  if (status === ResetStatus.INVALID_TOKEN) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Enlace no válido</h2>
          <p className="text-sm text-slate-500 mb-6">
            Este enlace de recuperación no es válido o ha expirado. Solicita uno nuevo.
          </p>
          <button
            onClick={() => router.push("/")}
            className="w-full py-3 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-xl text-sm transition-colors"
          >
            Volver al inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  // ── Éxito ──────────────────────────────────────────────────────────────
  if (status === ResetStatus.SUCCESS) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            ¡Contraseña actualizada!
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Tu contraseña se cambió correctamente. Serás redirigido al login en unos segundos...
          </p>
          <div className="w-8 h-8 border-2 border-blue-900/20 border-t-blue-900 rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  // ── Formulario principal ───────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-[#0f2e64] p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <Building2 size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              IDEA<span className="text-red-500">TEC</span>
            </h1>
          </div>
          <p className="text-blue-200 text-xs">Facturación Electrónica</p>
        </div>

        {/* Body */}
        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-700">
              <Lock size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Nueva contraseña</h2>
              <p className="text-xs text-slate-500">Elige una contraseña segura</p>
            </div>
          </div>

          {/* Error */}
          {(status === ResetStatus.ERROR || errorMsg) && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 mb-5">
              <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{errorMsg}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nueva contraseña */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">
                Nueva contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={17} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="block w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 focus:border-brand-blue/50 focus:ring-4 focus:ring-blue-50 rounded-xl outline-none text-slate-900 font-medium text-sm transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              {/* Medidor de fortaleza */}
              {strength && (
                <div className="space-y-1 mt-2">
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`} />
                  </div>
                  <p className="text-xs text-slate-500">
                    Fortaleza: <span className="font-semibold">{strength.label}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Confirmar contraseña */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">
                Confirmar contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <ShieldCheck size={17} />
                </div>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu contraseña"
                  className={`block w-full pl-11 pr-11 py-3 bg-slate-50 border rounded-xl outline-none text-slate-900 font-medium text-sm transition-all
                    ${confirmPassword && confirmPassword !== password
                      ? "border-red-300 focus:ring-4 focus:ring-red-50"
                      : "border-slate-200 focus:border-brand-blue/50 focus:ring-4 focus:ring-blue-50"
                    }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {confirmPassword && confirmPassword !== password && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                  <AlertCircle size={12} /> Las contraseñas no coinciden
                </p>
              )}
              {confirmPassword && confirmPassword === password && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                  <CheckCircle2 size={12} /> Las contraseñas coinciden
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={status === ResetStatus.LOADING}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-900 hover:bg-blue-950 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-colors"
            >
              {status === ResetStatus.LOADING ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Actualizando...
                </>
              ) : (
                <>
                  <ShieldCheck size={17} />
                  Actualizar contraseña
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-5">
            ¿Recordaste tu contraseña?{" "}
            <button
              type="button"
              onClick={() => router.push("/")}
              className="font-bold text-blue-700 hover:text-blue-900"
            >
              Volver al login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}