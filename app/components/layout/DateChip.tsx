"use client";
import React, { useMemo, useEffect } from "react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;
const MESES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;

function formatDate(date: Date): { largo: string; corto: string } {
  const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const DIAS_CORTO = ["Dom.", "Lun.", "Mar.", "Mié.", "Jue.", "Vie.", "Sáb."];
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const MESES_CORTO = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "set.", "oct.", "nov.", "dic."];
  const dia = DIAS[date.getDay()];
  const diaCorto = DIAS_CORTO[date.getDay()];
  const num = date.getDate();
  const mes = MESES[date.getMonth()];
  const mesCorto = MESES_CORTO[date.getMonth()];
  const anio = date.getFullYear();
  return {
    largo: `${dia}, ${num} de ${mes} del ${anio}`,
    corto: `${diaCorto} ${num} ${mesCorto}`,
  };
}
// ─── SVG paths ───────────────────────────────────────────────────────────────

const PATH = {
  sparkles:
    "M9 2l1.09 3.26L13 6l-2.91.74L9 10 7.91 6.74 5 6l2.91-.74L9 2zm7 10l.73 2.27L19 15l-2.27.73L16 18l-.73-2.27L13 15l2.27-.73L16 12zM4.5 14.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L3 16.5l1.5-.5.5-1.5z",
  heart:
    "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  flag: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  // Copo de nieve para Navidad
  snowflake:
    "M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07M12 5l-2-2M12 5l2-2M12 19l-2 2M12 19l2 2M5 12l-2-2M5 12l-2 2M19 12l2-2M19 12l2 2",
  gift: "M20 12v10H4V12M22 7H2v5h20V7zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z",
  cross: "M12 2v20M2 12h20",
  leaf: "M17 8C8 10 5.9 16.17 3.82 22c2.06-1.06 4.47-1.74 7.18-2 3-.3 5.66-1.43 7.71-3.43 3.32-3.24 3.6-8.23 3.29-13.57-2.71.96-6 2-8 4zM3.82 22c5.65-3.56 11-6 17.18-7",
  woman:
    "M12 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 10c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z",
  calendar:
    "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

type AnimationType = "snow" | "confetti" | "hearts" | "none";

interface FestivoConfig {
  label: string;
  chipText: string;
  svgPath: string;
  /** Color principal del ícono y texto */
  color: string;
  /** Color suave para la fecha */
  colorMuted: string;
  animation: AnimationType;
  /** Paleta de colores para la animación — temática de la fecha */
  animPalette: string[];
}

interface FechaFija {
  tipo: "fija";
  mes: number;
  dia: number;
  config: FestivoConfig;
}

interface FechaVariable {
  tipo: "variable";
  resolver: (year: number) => { mes: number; dia: number };
  config: FestivoConfig;
}

type FechaEspecial = FechaFija | FechaVariable;

// ─── Fechas especiales ────────────────────────────────────────────────────────

const FECHAS_ESPECIALES: FechaEspecial[] = [
  // Año Nuevo — dorado, violeta, plateado (fuegos artificiales / brindis)
  {
    tipo: "fija",
    mes: 1,
    dia: 1,
    config: {
      label: "Año Nuevo",
      chipText: "¡Feliz Año Nuevo!",
      svgPath: PATH.sparkles,
      color: "#a16207",
      colorMuted: "#343a40",
      animation: "confetti",
      animPalette: [
        "#fbbf24",
        "#f59e0b",
        "#a78bfa",
        "#e879f9",
        "#c0c0c0",
        "#ffffff",
      ],
    },
  },
  // San Valentín — todo rojo y rosa, corazones
  {
    tipo: "fija",
    mes: 2,
    dia: 14,
    config: {
      label: "San Valentín",
      chipText: "¡Feliz San Valentín!",
      svgPath: PATH.heart,
      color: "#be123c",
      colorMuted: "#343a40",
      animation: "hearts",
      animPalette: [
        "#be123c",
        "#e11d48",
        "#f43f5e",
        "#fb7185",
        "#fda4af",
        "#fecdd3",
      ],
    },
  },
  // Día de la Mujer — violeta y lila, feminismo
  {
    tipo: "fija",
    mes: 3,
    dia: 8,
    config: {
      label: "Día de la Mujer",
      chipText: "¡Día de la Mujer!",
      svgPath: PATH.woman,
      color: "#7e22ce",
      colorMuted: "#343a40",
      animation: "confetti",
      animPalette: [
        "#7e22ce",
        "#a855f7",
        "#c084fc",
        "#e879f9",
        "#ffffff",
        "#d946ef",
      ],
    },
  },
  // Viernes Santo — sin animación, sobriedad
  {
    tipo: "variable",
    resolver: (year) => {
      const a = year % 19,
        b = Math.floor(year / 100),
        c = year % 100;
      const d = Math.floor(b / 4),
        e = b % 4,
        f = Math.floor((b + 8) / 25);
      const g = Math.floor((b - f + 1) / 3);
      const h = (19 * a + b - d - g + 15) % 30;
      const i = Math.floor(c / 4),
        k = c % 4;
      const l = (32 + 2 * e + 2 * i - h - k) % 7;
      const m = Math.floor((a + 11 * h + 22 * l) / 451);
      const month = Math.floor((h + l - 7 * m + 114) / 31);
      const day = ((h + l - 7 * m + 114) % 31) + 1;
      const easter = new Date(year, month - 1, day);
      easter.setDate(easter.getDate() - 2);
      return { mes: easter.getMonth() + 1, dia: easter.getDate() };
    },
    config: {
      label: "Viernes Santo",
      chipText: "Viernes Santo",
      svgPath: PATH.cross,
      color: "#44403c",
      colorMuted: "#343a40",
      animation: "none",
      animPalette: [],
    },
  },
  // Día de la Madre — rosa y rojo, corazones
  {
    tipo: "variable",
    resolver: (year) => {
      const d = new Date(year, 4, 1);
      const dow = d.getDay();
      return { mes: 5, dia: (dow === 0 ? 1 : 8 - dow) + 7 };
    },
    config: {
      label: "Día de la Madre",
      chipText: "¡Feliz Día Mamá!",
      svgPath: PATH.heart,
      color: "#be123c",
      colorMuted: "#343a40",
      animation: "hearts",
      animPalette: [
        "#be123c",
        "#e11d48",
        "#f43f5e",
        "#fb7185",
        "#fda4af",
        "#fce7f3",
      ],
    },
  },
  // Día del Padre — azul y celeste, confetti varonil
  {
    tipo: "variable",
    resolver: (year) => {
      const d = new Date(year, 5, 1);
      const dow = d.getDay();
      return { mes: 6, dia: (dow === 0 ? 1 : 8 - dow) + 14 };
    },
    config: {
      label: "Día del Padre",
      chipText: "¡Feliz Día Papá!",
      svgPath: PATH.star,
      color: "#1e40af",
      colorMuted: "#343a40",
      animation: "confetti",
      animPalette: [
        "#1e40af",
        "#2563eb",
        "#60a5fa",
        "#93c5fd",
        "#bfdbfe",
        "#ffffff",
      ],
    },
  },
  // San Juan — naranja y verde amazónico, sin animación
  {
    tipo: "fija",
    mes: 6,
    dia: 24,
    config: {
      label: "San Juan",
      chipText: "¡Feliz San Juan!",
      svgPath: PATH.leaf,
      color: "#b45309",
      colorMuted: "#343a40",
      animation: "none",
      animPalette: [],
    },
  },
  // Fiestas Patrias 28 — ROJO y BLANCO, colores de la bandera peruana
  {
    tipo: "fija",
    mes: 7,
    dia: 28,
    config: {
      label: "Fiestas Patrias",
      chipText: "¡Viva el Perú!",
      svgPath: PATH.flag,
      color: "#b91c1c",
      colorMuted: "#343a40",
      animation: "confetti",
      animPalette: [
        "#b91c1c",
        "#dc2626",
        "#ef4444",
        "#ffffff",
        "#fecaca",
        "#ffffff",
      ],
    },
  },
  // Fiestas Patrias 29 — igual
  {
    tipo: "fija",
    mes: 7,
    dia: 29,
    config: {
      label: "Fiestas Patrias",
      chipText: "¡Viva el Perú!",
      svgPath: PATH.flag,
      color: "#b91c1c",
      colorMuted: "#343a40",
      animation: "confetti",
      animPalette: [
        "#b91c1c",
        "#dc2626",
        "#ef4444",
        "#ffffff",
        "#fecaca",
        "#ffffff",
      ],
    },
  },
  // Santa Rosa — rosa floral, sin animación
  {
    tipo: "fija",
    mes: 8,
    dia: 30,
    config: {
      label: "Santa Rosa de Lima",
      chipText: "Santa Rosa de Lima",
      svgPath: PATH.leaf,
      color: "#9d174d",
      colorMuted: "#343a40",
      animation: "none",
      animPalette: [],
    },
  },
  // Señor de los Milagros — morado litúrgico, sin animación
  {
    tipo: "fija",
    mes: 10,
    dia: 18,
    config: {
      label: "Señor de los Milagros",
      chipText: "Señor de los Milagros",
      svgPath: PATH.cross,
      color: "#581c87",
      colorMuted: "#343a40",
      animation: "none",
      animPalette: [],
    },
  },
  // Todos los Santos — gris sobrio, sin animación
  {
    tipo: "fija",
    mes: 11,
    dia: 1,
    config: {
      label: "Todos los Santos",
      chipText: "Todos los Santos",
      svgPath: PATH.cross,
      color: "#374151",
      colorMuted: "#343a40",
      animation: "none",
      animPalette: [],
    },
  },
  // Nochebuena — ROJO navideño, copos de nieve blancos
  {
    tipo: "fija",
    mes: 12,
    dia: 24,
    config: {
      label: "Nochebuena",
      chipText: "¡Feliz Nochebuena!",
      svgPath: PATH.snowflake,
      color: "#b91c1c",
      colorMuted: "#343a40",
      animation: "snow",
      animPalette: ["#ffffff", "#e0f2fe", "#bae6fd", "#f1f5f9", "#e2e8f0"],
    },
  },
  // Navidad — ROJO navideño, copos de nieve blancos
  {
    tipo: "fija",
    mes: 12,
    dia: 25,
    config: {
      label: "Navidad",
      chipText: "¡Feliz Navidad!",
      svgPath: PATH.snowflake,
      color: "#b91c1c",
      colorMuted: "#343a40",
      animation: "snow",
      animPalette: ["#ffffff", "#e0f2fe", "#bae6fd", "#f1f5f9", "#e2e8f0"],
    },
  },
  // Nochevieja — dorado y plateado, confetti brillante
  {
    tipo: "fija",
    mes: 12,
    dia: 31,
    config: {
      label: "Nochevieja",
      chipText: "¡Feliz Año Nuevo!",
      svgPath: PATH.sparkles,
      color: "#a16207",
      colorMuted: "#343a40",
      animation: "confetti",
      animPalette: [
        "#fbbf24",
        "#f59e0b",
        "#d97706",
        "#e879f9",
        "#c0c0c0",
        "#ffffff",
      ],
    },
  },
];

// ─── Resolución ───────────────────────────────────────────────────────────────

function getFestivoConfig(date: Date): FestivoConfig | null {
  const year = date.getFullYear();
  const mes = date.getMonth() + 1;
  const dia = date.getDate();
  for (const f of FECHAS_ESPECIALES) {
    if (f.tipo === "fija") {
      if (f.mes === mes && f.dia === dia) return f.config;
    } else {
      const r = f.resolver(year);
      if (r.mes === mes && r.dia === dia) return f.config;
    }
  }
  return null;
}

// ─── Animación: ráfaga de 3 segundos con fade-out ────────────────────────────

interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  opacity: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  shape: "circle" | "rect" | "heart" | "snowflake";
  // para nieve: wobble lateral
  wobble: number;
  wobbleAmp: number;
  wobbleSpeed: number;
}

const DURATION_MS = 5000; // duración total de la animación
const FADE_MS = 800; // últimos 800ms hacen fade-out

function useParticleBurst(animation: AnimationType, palette: string[]) {
  useEffect(() => {
    if (animation === "none" || palette.length === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    Object.assign(canvas.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      pointerEvents: "none",
      zIndex: "9999",
    });
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d")!;

    const shape: Particle["shape"] =
      animation === "snow"
        ? "snowflake"
        : animation === "hearts"
          ? "heart"
          : "rect";

    const COUNT = animation === "snow" ? 80 : animation === "hearts" ? 35 : 65;

    function mkParticle(): Particle {
      return {
        x: Math.random() * canvas.width,
        y:
          animation === "snow"
            ? -10 - Math.random() * 60
            : Math.random() * canvas.height * 0.6,
        r:
          animation === "snow"
            ? 3 + Math.random() * 5
            : animation === "hearts"
              ? 8 + Math.random() * 10
              : 5 + Math.random() * 8,
        vx:
          (Math.random() - 0.5) *
          (animation === "snow" ? 0.4 : animation === "hearts" ? 0.6 : 2.5),
        vy:
          animation === "snow"
            ? 1.0 + Math.random() * 1.5
            : animation === "hearts"
              ? 0.5 + Math.random() * 0.8
              : 1.5 + Math.random() * 2.5,
        opacity: 0.7 + Math.random() * 0.3,
        color: palette[Math.floor(Math.random() * palette.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.1,
        wobble: Math.random() * Math.PI * 2,
        wobbleAmp: 0.4 + Math.random() * 0.8,
        wobbleSpeed: 0.02 + Math.random() * 0.03,
        shape, // 👈 esto faltaba
      };
    }

    const particles: Particle[] = Array.from({ length: COUNT }, mkParticle);

    // ── dibujado ──

    function drawSnowflake(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      r: number,
      color: string,
      opacity: number,
    ) {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, r * 0.22);
      ctx.lineCap = "round";
      ctx.translate(x, y);
      for (let i = 0; i < 6; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -r);
        // ramitas
        ctx.moveTo(0, -r * 0.55);
        ctx.lineTo(r * 0.28, -r * 0.72);
        ctx.moveTo(0, -r * 0.55);
        ctx.lineTo(-r * 0.28, -r * 0.72);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawHeart(ctx: CanvasRenderingContext2D, size: number) {
      ctx.beginPath();
      ctx.moveTo(0, size * 0.3);
      ctx.bezierCurveTo(0, 0, -size * 0.5, 0, -size * 0.5, size * 0.3);
      ctx.bezierCurveTo(-size * 0.5, size * 0.6, 0, size * 0.85, 0, size);
      ctx.bezierCurveTo(
        0,
        size * 0.85,
        size * 0.5,
        size * 0.6,
        size * 0.5,
        size * 0.3,
      );
      ctx.bezierCurveTo(size * 0.5, 0, 0, 0, 0, size * 0.3);
      ctx.closePath();
    }

    const startTime = performance.now();
    let raf = 0;

    function draw(now: number) {
      const elapsed = now - startTime;
      if (elapsed >= DURATION_MS) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.parentNode?.removeChild(canvas);
        return;
      }

      // factor de fade-out en el último tramo
      const fadeStart = DURATION_MS - FADE_MS;
      const globalFade =
        elapsed > fadeStart ? 1 - (elapsed - fadeStart) / FADE_MS : 1;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        const alpha = p.opacity * globalFade;
        if (alpha <= 0) continue;

        if (p.shape === "snowflake") {
          p.wobble += p.wobbleSpeed;
          p.x += p.vx + Math.sin(p.wobble) * p.wobbleAmp;
          p.y += p.vy;
          drawSnowflake(ctx, p.x, p.y, p.r, p.color, alpha);
        } else if (p.shape === "heart") {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          drawHeart(ctx, p.r);
          ctx.fill();
          ctx.restore();
          p.rotation += p.rotationSpeed;
          p.x += p.vx;
          p.y -= p.vy; // corazones suben
        } else {
          // confetti rect
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillRect(-p.r / 2, -p.r / 3, p.r, p.r * 0.45);
          ctx.restore();
          p.rotation += p.rotationSpeed;
          p.x += p.vx;
          p.y += p.vy;
        }

        // recicla si sale de pantalla, pero solo si quedan más de 500ms
        if (elapsed < DURATION_MS - 500) {
          if (p.y > canvas.height + 20 || p.y < -20) {
            Object.assign(p, mkParticle());
          }
        }
      }

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);

    const onResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      canvas.parentNode?.removeChild(canvas);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animation]);
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface DateChipProps {
  date?: Date;
  className?: string;
}

export const DateChip: React.FC<DateChipProps> = ({ date, className = "" }) => {
  const today = useMemo(() => date ?? new Date(), [date]);

  const festivo = useMemo(() => getFestivoConfig(today), [today]);
  const dateStr = useMemo(() => formatDate(today), [today]);

  useParticleBurst(festivo?.animation ?? "none", festivo?.animPalette ?? []);

  // ── Día festivo ──
  if (festivo) {
    return (
      <div className={`flex items-center gap-2 ${className} `}>
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke={festivo.color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        >
          <path d={festivo.svgPath} />
        </svg>

        <span
          style={{
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: festivo.color,
            whiteSpace: "nowrap",
          }}
        >
          {festivo.chipText}
        </span>

        <span style={{ color: "#d1d5db", fontSize: "11px" }}>·</span>

        <span
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: festivo.colorMuted,
            whiteSpace: "nowrap",
          }}
        >
          <span className="hidden sm:inline">
            {dateStr.largo.charAt(0).toUpperCase() + dateStr.largo.slice(1).toLowerCase()}
          </span>
          <span className="sm:hidden">
            {dateStr.corto}
          </span>
        </span>
      </div>
    );
  }

  // ── Día normal ──
  return (
    <div className={`flex items-center gap-1.5 shrink-0 ${className}`}>
      <svg
        viewBox="0 0 24 24"
        width="13"
        height="13"
        fill="none"
        stroke="#9ca3af"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <path d={PATH.calendar} />
      </svg>
      <span
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color: "#343a40",
          whiteSpace: "nowrap",
        }}
      >
        <span className="hidden sm:inline">
          {dateStr.largo.charAt(0).toUpperCase() + dateStr.largo.slice(1).toLowerCase()}
        </span>
        <span className="sm:hidden">
          {dateStr.corto}
        </span>
      </span>
    </div>
  );
};
