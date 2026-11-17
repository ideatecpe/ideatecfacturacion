import {
  Home, Zap, Users, ShoppingBasket, Car, Wrench, Landmark, Megaphone, Tag,
  Utensils, Fuel, Truck, Phone, Wifi, Briefcase, Package, Receipt, HeartPulse,
  GraduationCap, Sparkles, ShieldCheck, Droplets, Coffee, Monitor,
  PartyPopper, Key, HandCoins, Gift, Store, Wallet,
  type LucideIcon, type LucideProps,
} from "lucide-react";
import { createElement } from "react";
import { cn } from "@/app/utils/cn";

// Lista fija de iconos para las categorías. El backend guarda solo el nombre
// (las de gastos por defecto usan home, zap, users, shopping-basket, car, wrench,
// landmark, megaphone y tag; las de ingresos party-popper, key, utensils, package,
// hand-coins y tag).
export const ICONOS_GASTO: { nombre: string; icono: LucideIcon }[] = [
  { nombre: "home", icono: Home },
  { nombre: "zap", icono: Zap },
  { nombre: "droplets", icono: Droplets },
  { nombre: "wifi", icono: Wifi },
  { nombre: "phone", icono: Phone },
  { nombre: "users", icono: Users },
  { nombre: "shopping-basket", icono: ShoppingBasket },
  { nombre: "package", icono: Package },
  { nombre: "car", icono: Car },
  { nombre: "fuel", icono: Fuel },
  { nombre: "truck", icono: Truck },
  { nombre: "wrench", icono: Wrench },
  { nombre: "sparkles", icono: Sparkles },
  { nombre: "landmark", icono: Landmark },
  { nombre: "receipt", icono: Receipt },
  { nombre: "megaphone", icono: Megaphone },
  { nombre: "utensils", icono: Utensils },
  { nombre: "coffee", icono: Coffee },
  { nombre: "monitor", icono: Monitor },
  { nombre: "briefcase", icono: Briefcase },
  { nombre: "heart-pulse", icono: HeartPulse },
  { nombre: "graduation-cap", icono: GraduationCap },
  { nombre: "shield-check", icono: ShieldCheck },
  { nombre: "party-popper", icono: PartyPopper },
  { nombre: "key", icono: Key },
  { nombre: "hand-coins", icono: HandCoins },
  { nombre: "gift", icono: Gift },
  { nombre: "store", icono: Store },
  { nombre: "wallet", icono: Wallet },
  { nombre: "tag", icono: Tag },
];

/** Color por defecto de todas las categorías: el azul de la marca. El cliente puede elegir otro. */
export const COLOR_GASTO_DEFECTO = "#0F2E64";

export const COLORES_GASTO = [
  COLOR_GASTO_DEFECTO, "#6366F1", "#0EA5E9", "#10B981", "#F59E0B", "#8B5CF6",
  "#EF4444", "#64748B", "#EC4899", "#14B8A6", "#F97316", "#84CC16",
];

export const iconoGasto = (nombre: string | null | undefined): LucideIcon =>
  ICONOS_GASTO.find((i) => i.nombre === nombre)?.icono ?? Tag;

/** Icono de una categoría por su nombre guardado (tag si no se reconoce). */
export function IconoGasto({ nombre, ...props }: { nombre: string | null | undefined } & LucideProps) {
  return createElement(iconoGasto(nombre), props);
}

/** Cuadradito de color con el icono de la categoría. */
export function IconoCategoria({
  icono,
  color,
  className,
  tamano = "md",
}: {
  icono: string | null | undefined;
  color: string | null | undefined;
  className?: string;
  tamano?: "sm" | "md" | "lg";
}) {
  const c = color || COLOR_GASTO_DEFECTO;
  const caja = tamano === "sm" ? "w-6 h-6 rounded-md" : tamano === "lg" ? "w-10 h-10 rounded-xl" : "w-8 h-8 rounded-lg";
  const ico = tamano === "sm" ? "w-3.5 h-3.5" : tamano === "lg" ? "w-5 h-5" : "w-4 h-4";
  return (
    <span
      className={cn("inline-flex items-center justify-center shrink-0", caja, className)}
      style={{ backgroundColor: `${c}1A`, color: c }}
    >
      <IconoGasto nombre={icono} className={ico} />
    </span>
  );
}

/** Chip con el nombre de la categoría. */
export function ChipCategoria({
  nombre,
  icono,
  color,
}: {
  nombre: string | null | undefined;
  icono: string | null | undefined;
  color: string | null | undefined;
}) {
  const c = color || COLOR_GASTO_DEFECTO;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold max-w-full"
      style={{ backgroundColor: `${c}1A`, color: c }}
    >
      <IconoGasto nombre={icono} className="w-3 h-3 shrink-0" />
      <span className="truncate">{nombre ?? "Sin categoría"}</span>
    </span>
  );
}
