"use client";
import React, { useState, useEffect } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Lock,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Globe,
  LifeBuoy,
  FileText,
  Zap,
  BarChart3,
  ShieldCheck,
  X,
  Mail,
  Send,
  Phone,
  MessageSquare,
  Clock,
  PlayCircle,
  ChevronRight,
} from "lucide-react";

import IncaPattern from "./IncaPattern";
import { InstallAppButton } from "./InstallAppButton";


enum LoginStatus {
  IDLE = "IDLE",
  LOADING = "LOADING",
  SUCCESS = "SUCCESS",
  ERROR = "ERROR",
}

type ModalType =
  | "forgotPassword"
  | "demo"
  | "support"
  | "terms"
  | "privacy"
  | null;

interface FormErrors {
  identifier?: string;
  password?: string;
}

interface LoginFormData {
  identifier: string;
  password: string;
  rememberMe: boolean;
}

// ─── Modal Base ────────────────────────────────────────────────────────────────

const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ open, onClose, children }) => {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors z-10"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
};

// ─── Modal: Olvidé mi Contraseña ───────────────────────────────────────────────

const ForgotPasswordModal: React.FC<{ onClose: () => void }> = ({
  onClose,
}) => {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrUsername.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emailOrUsername: emailOrUsername.trim() }),
        },
      );

      if (!res.ok) throw new Error("Error del servidor");

      // Siempre mostramos éxito (el backend no revela si el email existe)
      setSent(true);
    } catch {
      setError("No se pudo conectar con el servidor. Intenta más tarde.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-700">
          <Lock size={20} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Recuperar Contraseña
          </h3>
          <p className="text-xs text-slate-500">
            Te enviaremos un enlace seguro
          </p>
        </div>
      </div>

      {sent ? (
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h4 className="text-base font-bold text-slate-900 mb-2">
            ¡Correo enviado!
          </h4>
          <p className="text-sm text-slate-500 mb-6">
            Si tu cuenta existe, recibirás un correo con instrucciones para
            restablecer tu contraseña. El enlace expira en{" "}
            <span className="font-semibold text-slate-700">30 minutos</span>.
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-xl text-sm transition-colors"
          >
            Entendido
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <p className="text-sm text-slate-600">
            Ingresa el correo electrónico o usuario (RUC) asociado a tu cuenta.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">
              Correo Electrónico o Usuario
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail size={17} />
              </div>
              <input
                type="text"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                placeholder="correo@empresa.com o tu usuario"
                className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-brand-blue/50 focus:ring-4 focus:ring-blue-50 rounded-xl outline-none text-slate-900 font-medium text-sm transition-all"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !emailOrUsername.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-900 hover:bg-blue-950 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-colors"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send size={16} />
                Enviar instrucciones
              </>
            )}
          </button>

          <p className="text-center text-xs text-slate-400">
            ¿Recuerdas tu contraseña?{" "}
            <button
              type="button"
              onClick={onClose}
              className="font-bold text-blue-700 hover:text-blue-900"
            >
              Volver al login
            </button>
          </p>
        </form>
      )}
    </div>
  );
};

// ─── Modal: Solicitar Demostración ────────────────────────────────────────────

interface DemoModalProps {
  onClose: () => void;
  onFillDemo: () => void;
}

const DemoModal: React.FC<DemoModalProps> = ({ onClose, onFillDemo }) => {
  const [step, setStep] = useState<"info" | "form">("info");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleTryDemo = () => {
    onFillDemo();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/demo-request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, company, phone }),
        },
      );

      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      // opcional: setError("No se pudo enviar. Intenta más tarde.")
    } finally {
      setLoading(false);
    }
  };
  if (sent) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={32} className="text-green-600" />
        </div>
        <h4 className="text-base font-bold text-slate-900 mb-2">
          ¡Solicitud recibida!
        </h4>
        <p className="text-sm text-slate-500 mb-6">
          Uno de nuestros asesores se contactará contigo en las próximas 24
          horas hábiles para coordinar tu demostración personalizada.
        </p>
        <button
          onClick={onClose}
          className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-colors"
        >
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl">
      {/* Header */}
      <div className="bg-blue-900 p-6 text-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <PlayCircle size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold">Demo de FactuFly</h3>
            <p className="text-blue-200 text-xs">
              Sin compromiso, 100% gratuito
            </p>
          </div>
        </div>
        <p className="text-sm text-blue-100">
          Conoce todas las funcionalidades de nuestra plataforma de facturación
          electrónica.
        </p>
      </div>

      <div className="p-6 space-y-4">
        {/* Acceso rápido con cuenta demo */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-bold text-amber-800 mb-1 uppercase tracking-wide">
            Acceso Inmediato
          </p>
          <p className="text-sm text-amber-700 mb-3">
            Prueba la plataforma ahora mismo con nuestra cuenta de demostración.
          </p>
          <div className="flex gap-2 text-xs text-amber-800 bg-amber-100 rounded-lg p-2.5 font-mono mb-3">
            <span>
              Usuario:<strong>demo</strong>
            </span>
            <span>-</span>
            <span>
              Contraseña:<strong>demo123</strong>
            </span>
          </div>
          <button
            onClick={handleTryDemo}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-sm transition-colors"
          >
            <Zap size={15} />
            Autocompletar y probar ahora
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400 font-medium">
            o agenda una demo personalizada
          </span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* Formulario de contacto */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre completo"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-brand-blue/50 focus:ring-4 focus:ring-blue-50 transition-all"
              required
            />
          </div>
          <div>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Empresa o RUC"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-brand-blue/50 focus:ring-4 focus:ring-blue-50 transition-all"
              required
            />
          </div>
          <div>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Número de contacto"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-brand-blue/50 focus:ring-4 focus:ring-blue-50 transition-all"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-900 hover:bg-blue-950 disabled:opacity-60 text-white font-bold rounded-xl text-sm transition-colors"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send size={15} />
                Agendar demostración
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

// ─── Modal: Soporte ────────────────────────────────────────────────────────────

const SupportModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const router = useRouter();

  const channels = [
    {
      icon: <Phone size={20} />,
      color: "bg-green-100 text-green-700",
      title: "Llamada Directa",
      desc: "Lunes a viernes de 8am a 6pm",
      value: "+51 111 111 111",
      action: "tel:+5117005000",
      label: "Llamar ahora",
      btnColor: "bg-green-600 hover:bg-green-700",
    },
    {
      icon: <MessageSquare size={20} />,
      color: "bg-emerald-100 text-emerald-700",
      title: "WhatsApp",
      desc: "Respuesta en menos de 1 hora",
      value: "+51 111 111 111",
      action: "https://wa.me/51111111111",
      label: "Abrir WhatsApp",
      btnColor: "bg-emerald-600 hover:bg-emerald-700",
    },
    {
      icon: <Mail size={20} />,
      color: "bg-blue-100 text-blue-700",
      title: "Correo Electrónico",
      desc: "Respuesta en 24 horas hábiles",
      value: "velsatsac823@gmail.com",
      action: "mailto:velsatsac823@gmail.com",
      label: "Enviar correo",
      btnColor: "bg-blue-700 hover:bg-blue-900",
    },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-700">
          <LifeBuoy size={20} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Centro de Soporte
          </h3>
          <p className="text-xs text-slate-500">Estamos aquí para ayudarte</p>
        </div>
      </div>

      <div className="space-y-3">
        {channels.map((ch, i) => (
          <div
            key={i}
            className="border border-slate-100 rounded-xl p-4 hover:border-slate-200 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${ch.color}`}
              >
                {ch.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900">{ch.title}</p>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <Clock size={11} /> {ch.desc}
                </p>
                <p className="text-sm font-semibold text-slate-700 mt-1">
                  {ch.value}
                </p>
              </div>
              <a
                href={ch.action}
                target={ch.action.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-white text-xs font-bold transition-colors ${ch.btnColor}`}
              >
                {ch.label} <ChevronRight size={12} />
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 bg-slate-50 rounded-xl p-4">
        <p className="text-xs font-bold text-slate-700 mb-1">
          Base de Conocimiento
        </p>
        <p className="text-xs text-slate-500 mb-3">
          Encuentra respuestas rápidas en nuestra documentación.
        </p>
        <button
          type="button"
          onClick={() => {
            onClose();
            router.push("/docs/faq");
          }}
          className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900"
        >
          Ver preguntas frecuentes <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
};

// ─── Modal: Términos de Servicio ───────────────────────────────────────────────

const TermsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="p-8">
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-700">
        <FileText size={20} />
      </div>
      <div>
        <h3 className="text-lg font-bold text-slate-900">
          Términos de Servicio
        </h3>
        <p className="text-xs text-slate-500">
          Última actualización: Enero 2025
        </p>
      </div>
    </div>
    <div className="space-y-5 text-sm text-slate-600 leading-relaxed overflow-y-auto max-h-[55vh] pr-2">
      {[
        {
          title: "1. Aceptación de los Términos",
          body: "Al acceder y utilizar la plataforma FactuFly, usted acepta estar sujeto a estos Términos de Servicio. Si no está de acuerdo con alguno de estos términos, le pedimos que no utilice nuestros servicios.",
        },
        {
          title: "2. Descripción del Servicio",
          body: "FactuFly es una plataforma de facturación electrónica que permite a empresas y personas naturales con negocio emitir comprobantes de pago electrónicos conforme a las normas de la SUNAT (Superintendencia Nacional de Aduanas y de Administración Tributaria) del Perú.",
        },
        {
          title: "3. Obligaciones del Usuario",
          body: "El usuario se compromete a: (a) proporcionar información verídica y actualizada; (b) mantener la confidencialidad de sus credenciales de acceso; (c) usar el servicio conforme a la legislación peruana vigente; (d) no utilizar la plataforma para emitir comprobantes falsos o fraudulentos.",
        },
        {
          title: "4. Propiedad Intelectual",
          body: "Todos los derechos de propiedad intelectual sobre la plataforma, incluyendo software, diseño, logotipos y contenido, son propiedad exclusiva de IDEATEC S.A.C. Queda prohibida su reproducción total o parcial sin autorización expresa.",
        },
        {
          title: "5. Limitación de Responsabilidad",
          body: "IDEATEC no será responsable por daños indirectos, incidentales o consecuentes derivados del uso o imposibilidad de uso del servicio. Nuestra responsabilidad máxima estará limitada al monto pagado por el usuario en los últimos 12 meses.",
        },
        {
          title: "6. Modificaciones",
          body: "Nos reservamos el derecho de modificar estos términos en cualquier momento. Las modificaciones entrarán en vigor 30 días después de su publicación en la plataforma. El uso continuado del servicio constituye la aceptación de los nuevos términos.",
        },
        {
          title: "7. Ley Aplicable",
          body: "Estos términos se rigen por las leyes de la República del Perú. Cualquier controversia será sometida a los tribunales competentes de la ciudad de Lima.",
        },
      ].map((section, i) => (
        <div key={i}>
          <h4 className="font-bold text-slate-900 mb-1">{section.title}</h4>
          <p>{section.body}</p>
        </div>
      ))}
    </div>
    <button
      onClick={onClose}
      className="mt-6 w-full py-3 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-xl text-sm transition-colors"
    >
      Entendido
    </button>
  </div>
);

// ─── Modal: Política de Privacidad ────────────────────────────────────────────

const PrivacyModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="p-8">
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-700">
        <Globe size={20} />
      </div>
      <div>
        <h3 className="text-lg font-bold text-slate-900">
          Política de Privacidad
        </h3>
        <p className="text-xs text-slate-500">
          Última actualización: Enero 2025
        </p>
      </div>
    </div>
    <div className="space-y-5 text-sm text-slate-600 leading-relaxed overflow-y-auto max-h-[55vh] pr-2">
      {[
        {
          title: "1. Información que Recopilamos",
          body: "Recopilamos información que usted nos proporciona directamente, como nombre, RUC, correo electrónico, datos tributarios y de facturación. También recopilamos automáticamente datos de uso, dirección IP, tipo de navegador y actividad dentro de la plataforma.",
        },
        {
          title: "2. Uso de la Información",
          body: "Utilizamos su información para: (a) proveer y mejorar nuestros servicios; (b) procesar transacciones y comprobantes electrónicos; (c) enviar notificaciones relacionadas con su cuenta; (d) cumplir con obligaciones legales y tributarias ante la SUNAT.",
        },
        {
          title: "3. Compartición de Datos",
          body: "Compartimos su información únicamente con: organismos reguladores (SUNAT, SUNAT OSE/PSE) conforme a la ley, proveedores de servicios que nos asisten en la operación de la plataforma bajo acuerdos de confidencialidad, y en casos requeridos por ley o autoridad competente.",
        },
        {
          title: "4. Seguridad de los Datos",
          body: "Implementamos medidas de seguridad técnicas y organizativas de nivel bancario, incluyendo encriptación SSL de 256 bits, autenticación de dos factores y auditorías periódicas de seguridad para proteger su información personal y empresarial.",
        },
        {
          title: "5. Retención de Datos",
          body: "Conservamos sus datos por el período necesario para cumplir con los fines descritos y conforme a la legislación tributaria peruana, que exige mantener registros de comprobantes electrónicos por un mínimo de 5 años.",
        },
        {
          title: "6. Sus Derechos (ARCO)",
          body: "De acuerdo con la Ley N° 29733 de Protección de Datos Personales del Perú, usted tiene derecho de Acceso, Rectificación, Cancelación y Oposición (ARCO) sobre sus datos. Para ejercerlos, contáctenos en privacidad@ideatec.pe.",
        },
        {
          title: "7. Cookies",
          body: "Usamos cookies estrictamente necesarias para el funcionamiento de la plataforma y cookies analíticas para mejorar la experiencia. Puede configurar su navegador para rechazar cookies, aunque esto puede afectar algunas funcionalidades.",
        },
      ].map((section, i) => (
        <div key={i}>
          <h4 className="font-bold text-slate-900 mb-1">{section.title}</h4>
          <p>{section.body}</p>
        </div>
      ))}
    </div>
    <button
      onClick={onClose}
      className="mt-6 w-full py-3 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-xl text-sm transition-colors"
    >
      Entendido
    </button>
  </div>
);

// ─── Componente de Login ──────────────────────────────────────────────────────────

const LoginClient: React.FC = () => {
  const router = useRouter();
  const { status: sessionStatus } = useSession();

  // Si el usuario ya está autenticado, redirigir automáticamente al dashboard
  useEffect(() => {
    if (sessionStatus === "authenticated") {
      router.replace("/factufly/dashboard");
    }
  }, [sessionStatus, router]);

  const [formData, setFormData] = useState<LoginFormData>({
    identifier: "",
    password: "",
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<LoginStatus>(LoginStatus.IDLE);
  const [apiError, setApiError] = useState<string>("");
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [environment, setEnvironment] = useState<"beta" | "production">("production");
  const [doorOpen, setDoorOpen] = useState(false);
  const [sesionExpirada, setSesionExpirada] = useState(false);

  // Detectar entorno y sesión expirada desde la URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isBeta = window.location.pathname.startsWith("/beta");
      setEnvironment(isBeta ? "beta" : "production");
      const params = new URLSearchParams(window.location.search);
      if (params.get("expirado") === "1" || params.get("sessionExpired") === "1") {
        setSesionExpirada(true);
      }
    }
  }, []);

  // Cargar identificador guardado al montar el componente (sin contraseñas por seguridad)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("rememberedCredentials");
      if (saved) {
        const parsed = JSON.parse(saved);
        const savedIdentifier =
          typeof parsed === "string" ? parsed : (parsed?.identifier ?? "");

        if (savedIdentifier) {
          setFormData((prev) => ({
            ...prev,
            identifier: savedIdentifier,
            password: "",
            rememberMe: true,
          }));

          // Si el storage contenía una contraseña guardada antigua, sanitizarla inmediatamente
          if (parsed?.password) {
            localStorage.setItem(
              "rememberedCredentials",
              JSON.stringify({ identifier: savedIdentifier }),
            );
          }
        }
      }
    } catch {
      // Si hay algún error leyendo localStorage, ignorar silenciosamente
    }
  }, []);

  const validate = (name: string, value: string) => {
    let error = "";
    if (name === "identifier" && !value)
      error = "RUC o correo electrónico es requerido";
    if (name === "password" && !value) error = "La contraseña es requerida";
    return error;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    // Si es identifier (RUC/Usuario), limpiamos espacios accidentales al inicio y final
    const val =
      type === "checkbox"
        ? checked
        : name === "identifier"
          ? value.trim()
          : value;

    setFormData((prev) => ({ ...prev, [name]: val }));
    const error = validate(name, typeof val === "string" ? val : "");
    setErrors((prev) => ({ ...prev, [name]: error }));
    setApiError("");
  };

  // Autocompletar con credenciales de demo
  const fillDemoCredentials = () => {
    setFormData((prev) => ({
      ...prev,
      identifier: "demo",
      password: "demo123",
    }));
    setErrors({});
    setApiError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIdentifier = formData.identifier.trim();
    const idError = validate("identifier", cleanIdentifier);
    const passError = validate("password", formData.password);
    if (idError || passError) {
      setErrors({ identifier: idError, password: passError });
      return;
    }
    setStatus(LoginStatus.LOADING);
    setApiError("");
    try {
      const loginPayload = {
        identifier: cleanIdentifier,
        password: formData.password,
        environment: environment,
        rememberMe: formData.rememberMe,
      };

      console.group("🚀 [LOGIN API CONSUMPTION]");
      console.log("📍 URL:", `${process.env.NEXT_PUBLIC_API_URL}/api/Auth/login`);
      console.log("📡 Método:", "POST");
      console.log("📦 Datos enviados:", loginPayload);
      console.groupEnd();

      const result = await signIn("credentials", {
        identifier: cleanIdentifier,
        password: formData.password,
        environment: environment,
        rememberMe: formData.rememberMe.toString(),
        redirect: false,
      });
      if (result?.error) {
        setStatus(LoginStatus.ERROR);
        setApiError("Credenciales inválidas. Verifica tus datos.");
        return;
      }
      if (result?.ok) {
        if (formData.rememberMe) {
          localStorage.setItem(
            "rememberedCredentials",
            JSON.stringify({
              identifier: cleanIdentifier,
            }),
          );
        } else {
          localStorage.removeItem("rememberedCredentials");
        }

        setStatus(LoginStatus.SUCCESS);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setDoorOpen(true);
            // Navegar a mitad de la animación: dashboard monta mientras las puertas aún se abren
            setTimeout(() => router.push("/factufly/dashboard"), 300);
          });
        });
      }
    } catch (error) {
      console.error("Error en login:", error);
      setStatus(LoginStatus.ERROR);
      setApiError("Error al conectar con el servidor");
    }
  };

  return (
    <>
      {/* ── Modales ─────────────────────────────────────────────────────────── */}

      <Modal
        open={activeModal === "forgotPassword"}
        onClose={() => setActiveModal(null)}
      >
        <ForgotPasswordModal onClose={() => setActiveModal(null)} />
      </Modal>

      <Modal open={activeModal === "demo"} onClose={() => setActiveModal(null)}>
        <DemoModal
          onClose={() => setActiveModal(null)}
          onFillDemo={fillDemoCredentials}
        />
      </Modal>

      <Modal
        open={activeModal === "support"}
        onClose={() => setActiveModal(null)}
      >
        <SupportModal onClose={() => setActiveModal(null)} />
      </Modal>

      <Modal
        open={activeModal === "terms"}
        onClose={() => setActiveModal(null)}
      >
        <TermsModal onClose={() => setActiveModal(null)} />
      </Modal>

      <Modal
        open={activeModal === "privacy"}
        onClose={() => setActiveModal(null)}
      >
        <PrivacyModal onClose={() => setActiveModal(null)} />
      </Modal>

      {/* ── Layout Principal ─────────────────────────────────────────────────── */}

      <div className="min-h-screen flex flex-col md:flex-row bg-white" style={{ overflow: doorOpen ? "hidden" : "visible" }}>
        {/* Left Column: Login Form */}
        <section
          className="w-full md:w-[45%] lg:w-[40%] flex flex-col justify-center min-h-screen p-6 sm:p-10 lg:p-16 relative overflow-hidden"
          style={{
            transform: doorOpen ? "translateX(-100%)" : "translateX(0)",
            transition: doorOpen ? "transform 0.5s cubic-bezier(0.87, 0, 0.13, 1)" : "none",
          }}
        >
          <IncaPattern />

          <div className="w-full max-w-md mx-auto space-y-8 relative z-10">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-8">
              {/* Imagen a la izquierda */}
              <img
                src="/logofnsb.png"
                alt=""
                className="w-20 h-20 object-contain rounded-lg bg-[#00296b]"
              />

              {/* Textos a la derecha, uno debajo del otro */}
              <div className="flex flex-col">
                <h1 className="text-2xl font-extrabold text-[#00296b] tracking-[0.02em] leading-tight">
                  FACTU<span className="text-[#a80a0a]">FLY</span>
                </h1>
                <p className="text-sm text-[#6c757d] font-medium tracking-wide">
                  Facturación electrónica
                </p>
              </div>
            </div>

            {/* Main Content */}
            <div>
              <div className="mb-8">
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  Iniciar Sesión
                </h2>
                <p className="text-slate-500 text-[14px]">
                  Accede a tu panel de facturación electrónica.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Banner de Modo Beta */}
                {environment === "beta" && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
                    <Zap size={20} className="text-orange-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-orange-800 font-bold">
                        Modo Beta Activado
                      </p>
                      <p className="text-xs text-orange-700 mt-0.5">
                        Estás accediendo al ambiente de pruebas y desarrollo.
                      </p>
                    </div>
                  </div>
                )}

                {/* Banner de Sesión Expirada */}
                {sesionExpirada && !apiError && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
                    <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-amber-800 font-bold">
                        Tu sesión ha expirado
                      </p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Por seguridad, ingresa tus credenciales nuevamente.
                      </p>
                    </div>
                  </div>
                )}

                {/* Error de API */}
                {apiError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle
                      size={20}
                      className="text-red-600 shrink-0 mt-0.5"
                    />
                    <p className="text-sm text-red-700 font-medium">
                      {apiError}
                    </p>
                  </div>
                )}

                {/* Identifier */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="identifier"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    Usuario
                  </label>
                  <div className="relative group">
                    <div
                      className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors ${errors.identifier ? "text-red-500" : "text-slate-400 group-focus-within:text-blue-700"}`}
                    >
                      <User size={18} />
                    </div>
                    <input
                      id="identifier"
                      name="identifier"
                      type="text"
                      placeholder="Usuario o RUC"
                      className={`block w-full pl-11 pr-4 py-3 bg-slate-50 border ${errors.identifier ? "border-red-300 ring-4 ring-red-50" : "border-slate-200 focus:ring-4 focus:ring-blue-50 focus:border-brand-blue/50"} rounded-xl transition-all outline-none text-slate-900 font-medium`}
                      value={formData.identifier}
                      onChange={handleChange}
                      autoComplete="username"
                    />
                  </div>
                  {errors.identifier && (
                    <p className="flex items-center gap-1.5 text-[13px] font-medium text-red-600 mt-1.5">
                      <AlertCircle size={14} /> {errors.identifier}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label
                      htmlFor="password"
                      className="block text-sm font-semibold text-slate-700"
                    >
                      Contraseña
                    </label>
                    {/* ✅ Botón de Olvidé contraseña */}
                    <button
                      type="button"
                      onClick={() => setActiveModal("forgotPassword")}
                      className="text-xs font-bold text-blue-700 hover:text-red-600 transition-colors"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div className="relative group">
                    <div
                      className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors ${errors.password ? "text-red-500" : "text-slate-400 group-focus-within:text-blue-700"}`}
                    >
                      <Lock size={18} />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className={`block w-full pl-11 pr-11 py-3.5 bg-slate-50 border ${errors.password ? "border-red-300 ring-4 ring-red-50" : "border-slate-200 focus:ring-4 focus:ring-blue-50 focus:border-brand-blue/50"} rounded-xl transition-all outline-none text-slate-900 font-medium`}
                      value={formData.password}
                      onChange={handleChange}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="flex items-center gap-1.5 text-[13px] font-medium text-red-600 mt-1.5">
                      <AlertCircle size={14} /> {errors.password}
                    </p>
                  )}
                </div>



                <div className="flex items-center justify-between">
                  <label className="flex items-center group cursor-pointer">
                    <input
                      type="checkbox"
                      name="rememberMe"
                      className="w-5 h-5 rounded focus:ring-blue-900 accent-blue-900"
                      checked={formData.rememberMe}
                      onChange={handleChange}
                    />
                    <span className="ml-2.5 text-sm font-medium text-slate-600">
                      Recordarme
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={status === LoginStatus.LOADING}
                  className={`w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-sm font-bold text-white transition-all ${
                    status === LoginStatus.LOADING
                      ? "bg-[#0f2e64]/80 opacity-80 cursor-not-allowed"
                      : "bg-[#0f2e64] hover:bg-[#091a3d] hover:shadow-xl"
                  }`}
                >
                  {status === LoginStatus.LOADING ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Verificando...</span>
                    </div>
                  ) : status === LoginStatus.SUCCESS ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={20} className="text-green-400" />
                      <span>¡Bienvenido!</span>
                    </div>
                  ) : (
                    <>
                      <span>Entrar al Sistema</span>
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-10 pt-2 border-t border-slate-100 text-center">
                <p className="text-sm text-slate-600">
                  ¿Necesitas una demostración? 
                  <button
                    type="button"
                    onClick={() => setActiveModal("demo")}
                    className="font-bold text-red-600 hover:text-red-700 transition-colors"
                  >
                    Click aquí
                  </button>
                </p>
              </div>
            </div>

            {/* Footer */}
            <footer className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              <button
                type="button"
                onClick={() => setActiveModal("support")}
                className="text-xs font-semibold text-slate-400 hover:text-blue-900 flex items-center gap-1 transition-colors"
              >
                <LifeBuoy size={14} /> Soporte
              </button>
              <button
                type="button"
                onClick={() => setActiveModal("terms")}
                className="text-xs font-semibold text-slate-400 hover:text-blue-900 flex items-center gap-1 transition-colors"
              >
                <FileText size={14} /> Términos
              </button>
              <button
                type="button"
                onClick={() => setActiveModal("privacy")}
                className="text-xs font-semibold text-slate-400 hover:text-blue-900 flex items-center gap-1 transition-colors"
              >
                <Globe size={14} /> Privacidad
              </button>
            </footer>
          </div>
        </section>

        {/* Right Column: Hero / Brand Panel (Mismo gradiente del Sidebar) */}
        <section
          className="hidden md:flex md:w-[55%] lg:w-[60%] relative overflow-hidden items-center justify-center p-8 lg:p-16"
          style={{
            background: "linear-gradient(180deg, #0f2e64 0%, #091a3d 100%)",
            transform: doorOpen ? "translateX(100%)" : "translateX(0)",
            transition: doorOpen ? "transform 0.5s cubic-bezier(0.87, 0, 0.13, 1)" : "none",
          }}
        >
          <div className="relative z-10 w-full max-w-2xl">
            <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <h3 className="text-2xl lg:text-3xl xl:text-3xl font-brand font-extrabold text-white leading-tight">
                La Facturación
                <span className="text-red-500 italic"> más confiable</span>{" "}
             
                del Perú.
              </h3>
              <p className="text-white text-[12px] mt-4 leading-relaxed max-w-lg">
                Optimiza la gestión tributaria de tu empresa con cumplimiento
                100% SUNAT, reportes en tiempo real y soporte especializado.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
              {[
                {
                  icon: <Zap size={18}  />,
                  
                  title: "Emisión Instantánea",
                  desc: "Genera facturas, boletas y guías en segundos desde cualquier dispositivo.",
                },
                {
                  icon: <ShieldCheck size={18} />,
                  title: "Seguridad Bancaria",
                  desc: "Tus datos empresariales protegidos con los estándares más altos de encriptación.",
                },
                {
                  icon: <BarChart3 size={18} />,
                  title: "Análisis Financiero",
                  desc: "Visualiza tus ventas y crecimiento con dashboards dinámicos y reportes PDF/Excel.",
                },
                {
                  icon: <Globe size={18} />,
                  title: "Conectividad SUNAT",
                  desc: "Sincronización directa y masiva con los sistemas de validación de SUNAT.",
                },
              ].map((card, i) => (
                <div
                  key={i}
                  className="bg-white/6 backdrop-blur-md border border-white/10 p-3.5 lg:p-4 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all duration-200"
                >
                  <div className="w-8.5 h-8.5 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center mb-3 text-[#a9d6e5] shadow-inner">
                    {card.icon}
                  </div>
                  <h4 className="text-white font-bold mb-1 text-[13px] lg:text-[14px]">
                    {card.title}
                  </h4>
                  <p className="text-blue-100/70 text-xs leading-snug">
                    {card.desc}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center gap-6 animate-in fade-in duration-1000 delay-500">
              <div className="flex -space-x-3">
                {[
                  "/logosEmpresas/alCalifa.webp",
                  "/logosEmpresas/jolce.webp",
                  "/logosEmpresas/rapidnails.webp",
                  "/logosEmpresas/resterika.webp",
                  "/logosEmpresas/velsat.webp",
                ].map((logo, i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full border-2 border-blue-900 overflow-hidden animate-in zoom-in duration-500"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <img
                      src={logo}
                      alt="Logo Empresa"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
              <p className="text-blue-200 text-xs lg:text-sm">
                <span className="text-white font-bold">Muchas empresas</span>{" "}
                 peruanas ya confían en FactuFly.
              </p>
            </div>
          </div>

          {/* Bandera de Perú en la esquina inferior derecha */}
          <div className="absolute bottom-4 right-5 flex items-center gap-1.5 select-none pointer-events-none opacity-80">
            <img
              src="/peru.jpg"
              alt="Perú"
              className="w-5 h-3.5 object-cover rounded-xs shadow-sm border border-white/20"
            />
            <span className="text-[10px] font-semibold text-blue-200/60 uppercase tracking-wider font-mono">
              PE
            </span>
          </div>
        </section>

        {/* Install App Badge */}
        <InstallAppButton />
      </div>
    </>
  );
};

export default LoginClient;
