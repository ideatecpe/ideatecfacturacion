"use client";
import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  ChevronRight,
  LifeBuoy,
  FileText,
  Settings,
  CreditCard,
  HelpCircle,
  Building2,
  MessageSquare,
  Phone,
  Mail,
} from "lucide-react";

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface FAQItem {
  question: string;
  answer: React.ReactNode;
}

interface FAQCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: FAQItem[];
}

// ─── Datos ─────────────────────────────────────────────────────────────────────

const FAQ_DATA: FAQCategory[] = [
  {
    id: "basicos",
    label: "Conceptos básicos",
    icon: <HelpCircle size={16} />,
    items: [
      {
        question: "¿Qué es la facturación electrónica?",
        answer: (
          <>
            Es el proceso de emisión de comprobantes de pago (facturas, boletas,
            notas de crédito/débito, guías de remisión) en formato digital XML,
            con firma electrónica y validados por la SUNAT o un OSE autorizado.
            Reemplaza definitivamente al comprobante en papel.
          </>
        ),
      },
      {
        question:
          "¿Quiénes están obligados a emitir comprobantes electrónicos?",
        answer: (
          <>
            Desde el 2022, prácticamente todos los contribuyentes activos con
            RUC están obligados, incluyendo MYPES, personas naturales con
            negocio y empresas de cualquier régimen (RER, RMT, Régimen General).
            La SUNAT notifica mediante resolución de superintendencia o
            directamente en el portal SOL.
          </>
        ),
      },
      {
        question: "¿Cuál es la diferencia entre OSE, PSE y el sistema SOL?",
        answer: (
          <ul className="space-y-2 mt-1">
            <li>
              <span className="font-semibold text-slate-800">SOL</span> — Portal
              web gratuito de SUNAT para emitir comprobantes directamente, con
              funcionalidad limitada.
            </li>
            <li>
              <span className="font-semibold text-slate-800">PSE</span> —
              Proveedor de Servicios Electrónicos: empresas como IDEATEC que
              envían los comprobantes directamente a SUNAT.
            </li>
            <li>
              <span className="font-semibold text-slate-800">OSE</span> —
              Operador de Servicios Electrónicos: entidad autorizada por SUNAT
              que valida el comprobante antes de enviarlo. Ofrece respuesta más
              rápida y mayor disponibilidad.
            </li>
          </ul>
        ),
      },
      {
        question: "¿Qué tipos de comprobantes electrónicos existen?",
        answer: (
          <ul className="space-y-1.5 mt-1">
            {[
              "Factura Electrónica (serie F)",
              "Boleta de Venta Electrónica (serie B)",
              "Nota de Crédito Electrónica",
              "Nota de Débito Electrónica",
              "Guía de Remisión Electrónica (Remitente y Transportista)",
              "Liquidación de Compra Electrónica",
            ].map((t, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-700 shrink-0" />
                {t}
              </li>
            ))}
          </ul>
        ),
      },
    ],
  },
  {
    id: "plataforma",
    label: "IDEATEC",
    icon: <Building2 size={16} />,
    items: [
      {
        question: "¿Cómo inicio sesión en IDEATEC?",
        answer:
          "Accede con tu usuario (puede ser tu RUC o el usuario creado por tu administrador) y contraseña en la pantalla de inicio. Si olvidaste tu contraseña, usa el enlace '¿Olvidaste tu contraseña?' para recibir un correo de restablecimiento con un enlace válido por 30 minutos.",
      },
      {
        question: "¿Puedo usar IDEATEC desde mi celular o tablet?",
        answer:
          "Sí, IDEATEC tiene diseño responsive y funciona en cualquier navegador moderno (Chrome, Safari, Firefox). También disponemos de una aplicación móvil en fase beta para Android e iOS.",
      },
      {
        question: "¿Cuántas empresas puedo gestionar con una sola cuenta?",
        answer:
          "Las que usted desee contratar. Al trabajar con IDEATEC puede gestionar RUC ilimitados pero cada uno bajo una cuenta administradora distinta.",
      },
      {
        question: "¿Qué pasa si emito una factura con datos incorrectos?",
        answer:
          "Si el comprobante ya fue aceptado por SUNAT/OSE, no puede modificarse directamente. Debes emitir una Nota de Crédito para anular o reducir el monto, o una Nota de Débito para incrementarlo. IDEATEC facilita este proceso desde el detalle del comprobante con un solo clic.",
      },
    ],
  },
  {
    id: "sunat",
    label: "Validación SUNAT",
    icon: <FileText size={16} />,
    items: [
      {
        question: "¿Cómo sé si mi comprobante fue aceptado por SUNAT?",
        answer:
          "En IDEATEC verás el estado del comprobante en tiempo real: 'Aceptado', 'Aceptado con observaciones' o 'Rechazado'. También puedes verificarlo directamente en el portal de SUNAT ingresando el número de RUC, tipo y número del comprobante.",
      },
      {
        question: "¿Qué significa 'Aceptado con observaciones'?",
        answer:
          "El comprobante es válido tributariamente, pero SUNAT encontró alguna inconsistencia menor (ej. código de producto no estándar, descripción incompleta). No requiere corrección inmediata, pero es recomendable subsanarlo para futuros comprobantes.",
      },
      {
        question: "¿Qué hago si mi comprobante fue rechazado?",
        answer: (
          <>
            Un rechazo puede deberse a: RUC del cliente inactivo o no habido,
            datos del emisor inconsistentes, error en el código de tributo o
            moneda. IDEATEC muestra el código de error SUNAT con su descripción.
            Corriges los datos y vuelves a emitir con un{" "}
            <span className="font-semibold text-slate-800">
              nuevo número correlativo
            </span>{" "}
            (el comprobante rechazado no se puede reutilizar).
          </>
        ),
      },
      {
        question: "¿La baja de un comprobante es inmediata en SUNAT?",
        answer:
          "La comunicación de baja se envía a SUNAT dentro de las 24 horas. SUNAT procesa las bajas en lotes. Una vez procesada, el comprobante aparece como 'Dado de baja' en el portal. El plazo máximo para dar de baja es hasta el día siguiente de emitido.",
      },
    ],
  },
  {
    id: "tecnico",
    label: "Configuración y XML",
    icon: <Settings size={16} />,
    items: [
      {
        question: "¿Necesito instalar algún programa para usar IDEATEC?",
        answer:
          "No. IDEATEC es 100% web, no requiere instalación. Solo necesitas un navegador actualizado e internet. Para integraciones vía API o importación masiva de XML, sí se requiere configuración técnica, pero el soporte te acompaña en el proceso.",
      },
      {
        question: "¿Qué es el XML UBL 2.1 y por qué es importante?",
        answer:
          "Es el formato técnico estándar definido por SUNAT para todos los comprobantes electrónicos en Perú. Contiene toda la información del comprobante estructurada y firmada digitalmente. IDEATEC genera el XML automáticamente; no necesitas conocer los detalles técnicos.",
      },
      {
        question: "¿Cómo configuro mi certificado digital?",
        answer:
          "El certificado digital (firma electrónica) es obligatorio. IDEATEC te permite cargar tu propio certificado PKCS#12 (.pfx). Ve a Configuración → Empresa → Firma Digital y sigue el asistente. Soporte te guía en menos de 15 minutos.",
      },
    ],
  },
  {
    id: "planes",
    label: "Pagos y planes",
    icon: <CreditCard size={16} />,
    items: [
      {
        question: "¿Cuántos comprobantes puedo emitir?",
        answer:
          "IDEATEC no tiene límite de comprobantes. Puedes emitir facturas, boletas, notas de crédito/débito y guías de remisión sin restricciones de cantidad.",
      },
      {
        question: "¿Ofrecen periodo de prueba gratuito?",
        answer:
          "Sí, disponemos de una cuenta demo con acceso completo a todas las funcionalidades. Los comprobantes emitidos en modo demo llevan marca de agua y no son válidos tributariamente. Solicita tu acceso desde la pantalla de inicio de sesión.",
      },
      {
        question: "¿Hay costos adicionales por volumen de comprobantes?",
        answer:
          "No. IDEATEC opera bajo un modelo de uso ilimitado, sin cobros adicionales por cantidad de comprobantes emitidos ni por número de usuarios.",
      },
    ],
  },
];

// ─── Componente FAQ Item ───────────────────────────────────────────────────────

const FAQItem: React.FC<{ item: FAQItem; defaultOpen?: boolean }> = ({
  item,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden bg-white transition-shadow hover:shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-sm font-semibold text-slate-800 leading-relaxed">
          {item.question}
        </span>
        <ChevronRight
          size={18}
          className={`text-slate-400 shrink-0 mt-0.5 transition-transform duration-200 ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 pt-0 text-sm text-slate-600 leading-relaxed border-t border-slate-100">
          <div className="pt-4">{item.answer}</div>
        </div>
      )}
    </div>
  );
};

// ─── Página FAQ ────────────────────────────────────────────────────────────────

const FAQPage: React.FC = () => {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return FAQ_DATA.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          (activeCategory === "all" || cat.id === activeCategory) &&
          (!q ||
            item.question.toLowerCase().includes(q) ||
            (typeof item.answer === "string" &&
              item.answer.toLowerCase().includes(q))),
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [search, activeCategory]);

  const totalResults = filtered.reduce((acc, c) => acc + c.items.length, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-900 transition-colors"
          >
            <ArrowLeft size={16} />
            Volver
          </button>

          <div className="h-5 w-px bg-slate-200" />

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-900 rounded-lg flex items-center justify-center text-white">
              <Building2 size={14} />
            </div>
            <span className="text-sm font-bold text-blue-900">
              IDEA<span className="text-red-600">TEC</span>
            </span>
          </div>

          <span className="text-slate-300">/</span>
          <span className="text-sm text-slate-500 font-medium">
            Preguntas frecuentes
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <LifeBuoy size={13} />
            Centro de Ayuda
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-3">
            ¿En qué podemos ayudarte?
          </h1>
          <p className="text-slate-500 text-base max-w-xl">
            Encuentra respuestas sobre facturación electrónica, SUNAT y el uso
            de la plataforma IDEATEC.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Buscar pregunta..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActiveCategory("all");
            }}
            className="w-full pl-12 pr-5 py-3.5 bg-white border border-slate-200 focus:border-brand-blue/50 focus:ring-4 focus:ring-blue-50 rounded-xl outline-none text-slate-900 text-sm font-medium transition-all shadow-sm"
          />
          {search && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              {totalResults} resultado{totalResults !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Category tabs */}
        {!search && (
          <div className="flex gap-2 flex-wrap mb-8">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                activeCategory === "all"
                  ? "bg-blue-900 text-white border-blue-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-200 hover:text-blue-900"
              }`}
            >
              Todos
            </button>
            {FAQ_DATA.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                  activeCategory === cat.id
                    ? "bg-blue-900 text-white border-blue-900"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-200 hover:text-blue-900"
                }`}
              >
                {cat.icon}
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* FAQ Sections */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search size={24} className="text-slate-400" />
            </div>
            <p className="text-slate-700 font-semibold mb-1">
              Sin resultados para "{search}"
            </p>
            <p className="text-sm text-slate-500">
              Prueba con otras palabras o contacta al soporte.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {filtered.map((category) => (
              <section key={category.id}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="text-slate-500">{category.icon}</div>
                  <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                    {category.label}
                  </h2>
                </div>
                <div className="space-y-2">
                  {category.items.map((item, i) => (
                    <FAQItem key={i} item={item} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Contact Section */}
        <div className="mt-14 bg-white border border-slate-200 rounded-2xl p-8">
          <div className="text-center mb-7">
            <h3 className="text-lg font-bold text-slate-900 mb-1.5">
              ¿No encontraste tu respuesta?
            </h3>
            <p className="text-sm text-slate-500">
              Nuestro equipo de soporte especializado está listo para ayudarte.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: <Phone size={18} />,
                color: "bg-green-50 text-green-700",
                title: "Llamada",
                value: "+51 111 111 111",
                sub: "Lun–Vie 8am–6pm",
                href: "tel:+51111111111",
              },
              {
                icon: <MessageSquare size={18} />,
                color: "bg-emerald-50 text-emerald-700",
                title: "WhatsApp",
                value: "+51 111 111 111",
                sub: "Respuesta en <1 hora",
                href: "https://wa.me/51111111111",
              },
              {
                icon: <Mail size={18} />,
                color: "bg-blue-50 text-blue-700",
                title: "Correo",
                value: "soporte@ideatec.pe",
                sub: "Respuesta en 24h",
                href: "mailto:soporte@ideatec.pe",
              },
            ].map((ch, i) => (
              <a
                key={i}
                href={ch.href}
                target={ch.href.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                className="flex flex-col items-center text-center p-5 border border-slate-100 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all group"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${ch.color}`}
                >
                  {ch.icon}
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {ch.title}
                </p>
                <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-900 transition-colors">
                  {ch.value}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{ch.sub}</p>
              </a>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-xs text-slate-400">
        © {new Date().getFullYear()} IDEATEC S.A.C. — Todos los derechos
        reservados.
      </footer>
    </div>
  );
};

export default FAQPage;
