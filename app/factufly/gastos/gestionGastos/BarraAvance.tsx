import { cn } from "@/app/utils/cn";

/** Barra de avance del presupuesto: verde < 80 %, ámbar 80–100 %, rojo si se pasó. */
export function BarraAvance({
  porcentaje,
  nivel,
  className,
}: {
  porcentaje: number;
  nivel: "sin" | "ok" | "alerta" | "pasado";
  className?: string;
}) {
  const color = nivel === "pasado" ? "bg-rose-500" : nivel === "alerta" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className={cn("mt-1.5 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden", className)}>
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(100, porcentaje)}%` }} />
    </div>
  );
}
