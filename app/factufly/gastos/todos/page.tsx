"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote, Ban, BarChart3, ChevronLeft, ChevronRight, FileCheck, FileSpreadsheet, Image as ImageIcon, Loader2,
  Pencil, PiggyBank, Plus, Receipt, RefreshCw, Repeat, Search, TrendingUp, Wallet,
} from "lucide-react";
import { cn } from "@/app/utils/cn";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/app/components/ui/Toast";
import { Button } from "@/app/components/ui/Button";
import { useSucursalRuc } from "../../operaciones/boleta/gestionBoletas/useSucursalRuc";
import { ModalGasto } from "@/app/components/modalGastos/ModalGasto";
import { ModalAnularGasto } from "@/app/components/modalGastos/ModalAnularGasto";
import { ModuloGastos } from "../gestionGastos/ModuloGastos";
import { useInicioGastos, useListaGastos } from "../gestionGastos/useGastos";
import { ChipCategoria } from "../gestionGastos/iconosGasto";
import { BarraAvance } from "../gestionGastos/BarraAvance";
import { SelectorTipo, useTipoMovimiento } from "../gestionGastos/SelectorTipo";
import { EmisionIngreso } from "../gestionGastos/EmisionIngreso";
import { PorEmitirPanel } from "../gestionGastos/PorEmitirPanel";
import { publicarPorEmitir } from "../gestionGastos/avisoPorEmitir";
import {
  MEDIOS_PAGO, fechaLocal, formatFechaCorta, formatSoles, nivelPresupuesto, nombreComprobante,
  type FiltrosGastos, type Gasto, type GuardarGasto, type GuardarProgramado, type TipoMovimiento,
} from "../gestionGastos/tipos";

type Atajo = "hoy" | "semana" | "mes" | "mesPasado" | "personalizado";

function rangoAtajo(a: Atajo): { desde: string; hasta: string } {
  const hoy = new Date();
  if (a === "hoy") return { desde: fechaLocal(hoy), hasta: fechaLocal(hoy) };
  if (a === "semana") {
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    return { desde: fechaLocal(lunes), hasta: fechaLocal(hoy) };
  }
  if (a === "mesPasado") {
    const ini = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
    return { desde: fechaLocal(ini), hasta: fechaLocal(fin) };
  }
  return { desde: fechaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: fechaLocal(hoy) };
}

const ATAJOS: { id: Atajo; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "semana", label: "Esta semana" },
  { id: "mes", label: "Este mes" },
  { id: "mesPasado", label: "Mes pasado" },
];

const TAMANO_PAGINA = 20;

export default function MovimientosPage() {
  return (
    <ModuloGastos>
      <TodosLosGastos />
    </ModuloGastos>
  );
}

function TodosLosGastos() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const esAdmin = user?.rol === "admin" || user?.rol === "superadmin";
  // Solo el superadmin (dueño) ve todas las sucursales; el admin, la suya.
  const esSuperAdmin = user?.rol === "superadmin";
  const hoy = new Date();
  const [tipo, setTipo] = useTipoMovimiento();
  const esIngreso = tipo === "I";
  const t = (gasto: string, ingreso: string) => (esIngreso ? ingreso : gasto);

  const [atajo, setAtajo] = useState<Atajo>(esAdmin ? "mes" : "hoy");
  const [filtros, setFiltros] = useState<FiltrosGastos>(() => ({
    tipo: "G",
    ...rangoAtajo(esAdmin ? "mes" : "hoy"),
    categoriaId: null,
    sucursalId: null,
    medioPago: "",
    q: "",
    incluirAnulados: false,
    page: 1,
    pageSize: TAMANO_PAGINA,
  }));
  const [busqueda, setBusqueda] = useState("");

  // La búsqueda espera a que se deje de escribir para no pedir en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      setFiltros((f) => (f.q === busqueda ? f : { ...f, q: busqueda, page: 1 }));
    }, 400);
    return () => clearTimeout(t);
  }, [busqueda]);

  // La pestaña Gastos / Ingresos cambia el tipo de la lista y limpia el filtro de categoría.
  useEffect(() => {
    setFiltros((f) => (f.tipo === tipo ? f : { ...f, tipo, categoriaId: null, page: 1 }));
  }, [tipo]);

  const { inicio, recargar: recargarInicio, api } = useInicioGastos(hoy.getFullYear(), hoy.getMonth() + 1);
  // La campanita y el menú toman el número de aquí apenas cambia (al emitir o descartar).
  const porEmitirInicio = inicio?.porEmitir;
  useEffect(() => {
    if (esAdmin && porEmitirInicio !== undefined) publicarPorEmitir(porEmitirInicio);
  }, [esAdmin, porEmitirInicio]);
  const { lista, loading, error, recargar } = useListaGastos(filtros);
  const { sucursales: todasSucursales } = useSucursalRuc(esSuperAdmin);
  // El API ya devuelve solo las habilitadas; el filtro es por si eso cambia.
  const sucursales = useMemo(() => todasSucursales.filter((s) => s.estado !== false), [todasSucursales]);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Gasto | null>(null);
  const [anulando, setAnulando] = useState<Gasto | null>(null);
  const [exportando, setExportando] = useState(false);
  // Ingreso que se está facturando: la lista se reemplaza por el formulario de emisión.
  const [emitiendo, setEmitiendo] = useState(false);

  const cambiar = (parcial: Partial<FiltrosGastos>) => setFiltros((f) => ({ ...f, ...parcial, page: 1 }));

  const elegirAtajo = (a: Atajo) => {
    setAtajo(a);
    cambiar(rangoAtajo(a));
  };

  const categorias = useMemo(() => (inicio?.categorias ?? []).filter((c) => c.tipo === tipo), [inicio, tipo]);
  const totalPaginas = lista ? Math.max(1, Math.ceil(lista.total / lista.tamanoPagina)) : 1;
  const cantidadVigentes = useMemo(
    () => (lista?.porCategoria ?? []).reduce((s, c) => s + c.cantidad, 0),
    [lista?.porCategoria],
  );
  const mayorCategoria = lista?.porCategoria?.[0];
  const presupuesto = inicio ? nivelPresupuesto(inicio.totalMes, inicio.totalPresupuesto) : null;

  const guardar = async (datos: GuardarGasto, id: number | null) => {
    if (id) await api.editar(id, datos);
    else await api.crear(datos);
    const nombre = datos.tipo === "I" ? "Ingreso" : "Gasto";
    showToast(
      id
        ? `${nombre} actualizado`
        : datos.pagadoConCaja
          ? datos.tipo === "I" ? "Ingreso registrado y sumado a la caja" : "Gasto registrado y descontado de la caja"
          : `${nombre} registrado`,
      "success",
    );
    recargar();
    recargarInicio();
  };

  // "Repetir automáticamente" desde Nuevo gasto / Nuevo ingreso: crea la regla.
  const programar = async (datos: GuardarProgramado) => {
    const r = await api.crearProgramado(datos);
    const proxima = r.proximaFecha ? ` Próximo: ${formatFechaCorta(r.proximaFecha)}.` : "";
    // Con comprobante, lo de hoy no queda registrado todavía: espera en «Por emitir» (o se emite solo).
    const deHoy = !datos.tipoComprobante
      ? "Ya se registró el de hoy."
      : datos.emisionAutomatica
        ? "El de hoy se emitirá solo en los próximos 30 minutos."
        : "El de hoy quedó arriba, en «Por emitir».";
    showToast(
      r.registrados > 0
        ? `Programado. ${deHoy}${proxima}`
        : `Programado: se registrará solo.${proxima} Lo ves en Programados.`,
      "success",
    );
    if (r.registrados > 0) {
      recargar();
      recargarInicio();
    }
  };

  const anular = async (motivo: string) => {
    if (!anulando) return;
    const r = await api.anular(anulando.gastoId, motivo);
    const nombre = anulando.tipo === "I" ? "Ingreso" : "Gasto";
    showToast(
      r.retiroEliminado
        ? `${nombre} anulado y quitado de la caja`
        : r.retiroSeMantiene
          ? `${nombre} anulado. El movimiento de caja se mantiene (turno ya cuadrado)`
          : `${nombre} anulado`,
      "success",
    );
    recargar();
    recargarInicio();
  };

  const exportar = async () => {
    setExportando(true);
    try {
      const datos = await api.listar({ ...filtros, page: 1, pageSize: 5000 });
      const ExcelJS = (await import("exceljs")).default;
      const libro = new ExcelJS.Workbook();
      const hoja = libro.addWorksheet(esIngreso ? "Ingresos" : "Gastos");
      hoja.columns = [
        { header: "Fecha", key: "fecha", width: 12 },
        { header: "Categoría", key: "categoria", width: 24 },
        { header: "Descripción", key: "descripcion", width: 40 },
        { header: esIngreso ? "Cliente" : "Proveedor", key: "proveedor", width: 30 },
        { header: "RUC/DNI", key: "doc", width: 14 },
        { header: "Comprobante", key: "comprobante", width: 22 },
        { header: "Medio de pago", key: "medio", width: 15 },
        { header: "Sucursal", key: "sucursal", width: 18 },
        { header: "Registrado por", key: "usuario", width: 18 },
        { header: "Estado", key: "estado", width: 10 },
        { header: "Monto (S/)", key: "monto", width: 14 },
      ];
      hoja.getRow(1).font = { bold: true };
      datos.items.forEach((g) => {
        hoja.addRow({
          fecha: formatFechaCorta(g.fecha),
          categoria: g.categoriaNombre ?? "",
          descripcion: g.descripcion,
          proveedor: g.proveedorNombre ?? "",
          doc: g.proveedorDocumento ?? "",
          comprobante: g.tipoComprobante === "00"
            ? "Sin comprobante"
            : `${nombreComprobante(g.tipoComprobante)} ${[g.serie, g.numero].filter(Boolean).join("-")}`.trim(),
          medio: g.medioPago + (g.pagadoConCaja ? " (caja)" : ""),
          sucursal: g.sucursalNombre ?? "Toda la empresa",
          usuario: g.nombreUsuario ?? "",
          estado: g.anulado ? "Anulado" : "Vigente",
          monto: g.monto,
        });
      });
      const totalFila = hoja.addRow({ descripcion: "TOTAL (sin anulados)", monto: datos.sumaTotal });
      totalFila.font = { bold: true };
      hoja.getColumn("monto").numFmt = "#,##0.00";

      const buffer = await libro.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${esIngreso ? "ingresos" : "gastos"}_${filtros.desde}_${filtros.hasta}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "No se pudo exportar", "error");
    } finally {
      setExportando(false);
    }
  };

  if (emitiendo) {
    return (
      <EmisionIngreso
        onVolver={() => {
          setEmitiendo(false);
          recargar();
          recargarInicio();
        }}
      />
    );
  }

  const puedeEditar = (g: Gasto) =>
    !g.anulado && (esAdmin || (g.usuarioId === Number(user?.id) && g.fechaRegistro.slice(0, 10) === fechaLocal()));

  return (
    <div className="space-y-3">
      {/* Ingresos programados con comprobante que ya tocan emitirse */}
      {esAdmin && inicio && (
        <PorEmitirPanel cantidad={inicio.porEmitir} onEmitir={() => setEmitiendo(true)} onCambio={recargarInicio} />
      )}

      {/* Tarjetas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tarjeta
          icono={Wallet}
          color={esIngreso ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"}
          titulo={esAdmin ? t("Gastado en el periodo", "Ingresado en el periodo") : t("Tus gastos de hoy", "Tus ingresos de hoy")}
          valor={formatSoles(lista?.sumaTotal ?? 0)}
          detalle={`${cantidadVigentes} ${t("gasto", "ingreso")}${cantidadVigentes === 1 ? "" : "s"}`}
        />
        {esAdmin ? (
          <>
            <Tarjeta
              icono={TrendingUp}
              color="text-amber-600 bg-amber-50"
              titulo={t("Categoría con más gasto", "Categoría con más ingreso")}
              valor={mayorCategoria ? mayorCategoria.nombre : "—"}
              detalle={mayorCategoria ? formatSoles(mayorCategoria.total) : t("Sin gastos en el periodo", "Sin ingresos en el periodo")}
              valorChico
            />
            <Tarjeta
              icono={Receipt}
              color="text-sky-600 bg-sky-50"
              titulo="Este mes"
              valor={formatSoles((esIngreso ? inicio?.totalIngresosMes : inicio?.totalMes) ?? 0)}
              detalle={inicio ? `Mes pasado: ${formatSoles(esIngreso ? inicio.totalIngresosMesAnterior : inicio.totalMesAnterior)}` : ""}
            />
            {esIngreso ? (
              <Link
                href="/factufly/gastos/resumen"
                className="rounded-xl border border-[#E2EAF6] bg-white px-3.5 py-3 shadow-xs hover:border-brand-blue/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center text-brand-blue bg-brand-blue/10">
                    <BarChart3 className="w-4 h-4" />
                  </span>
                  <p className="text-[11px] font-semibold text-gray-500">Resumen del mes</p>
                </div>
                <p className="mt-1.5 text-xs text-gray-600">Ventas + otros ingresos − gastos: cuánto te quedó.</p>
              </Link>
            ) : (
            <div className="rounded-xl border border-[#E2EAF6] bg-white px-3.5 py-3 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-emerald-600 bg-emerald-50">
                  <PiggyBank className="w-4 h-4" />
                </span>
                <p className="text-[11px] font-semibold text-gray-500">Presupuesto del mes</p>
              </div>
              {inicio && inicio.totalPresupuesto > 0 && presupuesto ? (
                <>
                  <p className="mt-1.5 text-base font-black text-gray-900 tabular-nums">
                    {Math.round(presupuesto.porcentaje)}%
                    <span className="ml-1 text-[11px] font-medium text-gray-400">de {formatSoles(inicio.totalPresupuesto)}</span>
                  </p>
                  <BarraAvance porcentaje={presupuesto.porcentaje} nivel={presupuesto.nivel} />
                </>
              ) : (
                <p className="mt-1.5 text-xs text-gray-400">Sin presupuesto. Defínelo en Presupuestos.</p>
              )}
            </div>
            )}
          </>
        ) : (
          <div className="col-span-1 lg:col-span-3 rounded-xl border border-[#E2EAF6] bg-white px-3.5 py-3 shadow-xs text-xs text-gray-500 flex items-center">
            {esIngreso
              ? "Registra aquí el dinero extra que entre durante el día. Si entra a tu caja, márcalo al registrarlo y se sumará solo al cuadrar."
              : "Registra aquí los gastos que hagas durante el día. Si sale del efectivo de tu caja, márcalo al registrarlo y se descontará solo al cuadrar."}
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-[#E2EAF6] bg-white px-3.5 py-2.5 shadow-xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
          <SelectorTipo tipo={tipo} onChange={setTipo} />
          {esAdmin ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {ATAJOS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => elegirAtajo(a.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    atajo === a.id ? "border-brand-blue bg-brand-blue text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50",
                  )}
                >
                  {a.label}
                </button>
              ))}
              <input
                type="date"
                value={filtros.desde}
                onChange={(e) => { setAtajo("personalizado"); cambiar({ desde: e.target.value }); }}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
              />
              <span className="text-xs text-gray-400">a</span>
              <input
                type="date"
                value={filtros.hasta}
                onChange={(e) => { setAtajo("personalizado"); cambiar({ hasta: e.target.value }); }}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
              />
            </div>
          ) : (
            <p className="text-sm font-semibold text-gray-700">{t("Gastos de hoy", "Ingresos de hoy")}</p>
          )}
          </div>
          <div className="flex items-center gap-2">
            {esAdmin && (
              <Link
                href="/factufly/gastos/programados"
                title={t("Gastos que se registran solos cada mes, quincena o semana", "Ingresos que se registran solos cada mes, quincena o semana")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-blue/30 bg-brand-blue/5 px-3 py-2 text-xs font-semibold text-brand-blue hover:bg-brand-blue/10 transition-colors"
              >
                <Repeat className="w-4 h-4" /> Programados
              </Link>
            )}
            {esAdmin && (
              <Button variant="outline" onClick={exportar} disabled={exportando || !lista?.total} className="text-xs">
                {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                Excel
              </Button>
            )}
            <Button onClick={() => { setEditando(null); setModalAbierto(true); }} disabled={!inicio}>
              <Plus className="w-4 h-4" /> {t("Nuevo gasto", "Nuevo ingreso")}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={t("Buscar por descripción, proveedor o comprobante", "Buscar por descripción, cliente o comprobante")}
              className="w-full rounded-lg border border-gray-200 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-brand-blue/50"
            />
          </div>
          <select
            value={filtros.categoriaId ?? ""}
            onChange={(e) => cambiar({ categoriaId: e.target.value ? Number(e.target.value) : null })}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.categoriaId} value={c.categoriaId}>{c.nombre}</option>
            ))}
          </select>
          <select
            value={filtros.medioPago}
            onChange={(e) => cambiar({ medioPago: e.target.value })}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
          >
            <option value="">Todos los medios</option>
            {MEDIOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {esSuperAdmin && sucursales.length > 1 && (
            <select
              value={filtros.sucursalId ?? ""}
              onChange={(e) => cambiar({ sucursalId: e.target.value ? Number(e.target.value) : null })}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
            >
              <option value="">Todas las sucursales</option>
              {sucursales.map((s) => <option key={s.sucursalId} value={s.sucursalId}>{s.nombre}</option>)}
            </select>
          )}
          {esAdmin && (
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={filtros.incluirAnulados}
                onChange={(e) => cambiar({ incluirAnulados: e.target.checked })}
                className="accent-brand-blue"
              />
              Ver anulados
            </label>
          )}
          <button onClick={recargar} title="Actualizar" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>

        {esAdmin && lista && lista.porCategoria.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-gray-100 pt-2">
            {lista.porCategoria.slice(0, 8).map((c) => (
              <button
                key={c.clave}
                onClick={() => cambiar({ categoriaId: filtros.categoriaId === c.categoriaId ? null : c.categoriaId })}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                  filtros.categoriaId === c.categoriaId ? "border-gray-400 bg-gray-50" : "border-gray-200 hover:bg-gray-50",
                )}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color ?? "#94A3B8" }} />
                <span className="text-gray-600">{c.nombre}</span>
                <span className="font-semibold text-gray-900 tabular-nums">{formatSoles(c.total)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="rounded-xl border border-[#E2EAF6] bg-white shadow-xs overflow-hidden">
        {error ? (
          <p className="px-4 py-10 text-center text-sm text-rose-600">{error}</p>
        ) : loading && !lista ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
        ) : !lista || lista.items.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Receipt className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="text-sm font-semibold text-gray-700">{t("No hay gastos en este periodo", "No hay ingresos en este periodo")}</p>
            <p className="text-xs text-gray-400">Registra el primero con &quot;{t("Nuevo gasto", "Nuevo ingreso")}&quot;.</p>
          </div>
        ) : (
          <>
            {/* Escritorio */}
            <table className="hidden md:table w-full text-xs">
              <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                  <th className="px-3 py-2 text-left font-semibold">Categoría</th>
                  <th className="px-3 py-2 text-left font-semibold">Descripción</th>
                  <th className="px-3 py-2 text-left font-semibold">Comprobante</th>
                  <th className="px-3 py-2 text-left font-semibold">Pago</th>
                  <th className="px-3 py-2 text-right font-semibold">Monto</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lista.items.map((g) => (
                  <tr key={g.gastoId} className={cn("hover:bg-gray-50/60", g.anulado && "opacity-50")}>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{formatFechaCorta(g.fecha)}</td>
                    <td className="px-3 py-2 max-w-40"><ChipCategoria nombre={g.categoriaNombre} icono={g.categoriaIcono} color={g.categoriaColor} /></td>
                    <td className="px-3 py-2 max-w-72">
                      <p className={cn("font-medium text-gray-800 truncate", g.anulado && "line-through")}>
                        {g.gastoProgramadoId && (
                          <Repeat className="mr-1 inline w-3 h-3 text-brand-blue" aria-label="Registrado automáticamente (programado)" />
                        )}
                        {g.descripcion}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {[g.proveedorNombre, esAdmin ? g.nombreUsuario : null, esSuperAdmin && sucursales.length > 1 ? g.sucursalNombre ?? "Toda la empresa" : null]
                          .filter(Boolean).join(" · ")}
                        {g.anulado && g.motivoAnulacion ? ` · Anulado: ${g.motivoAnulacion}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                      {g.tipoComprobante === "00" ? (
                        <span className="text-gray-400">—</span>
                      ) : g.comprobanteId ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-700" title="Emitido desde Ingresos">
                          <FileCheck className="w-3 h-3" />
                          {nombreComprobante(g.tipoComprobante)} {[g.serie, g.numero].filter(Boolean).join("-")}
                        </span>
                      ) : (
                        <>
                          {nombreComprobante(g.tipoComprobante)}{" "}
                          <span className="text-gray-400">{[g.serie, g.numero].filter(Boolean).join("-")}</span>
                        </>
                      )}
                      {g.adjuntoUrl && (
                        <a href={g.adjuntoUrl} target="_blank" rel="noreferrer" title="Ver foto" className="ml-1.5 inline-flex text-brand-blue">
                          <ImageIcon className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        {g.pagadoConCaja && (
                          <Banknote
                            className={cn("w-3.5 h-3.5", g.tipo === "I" ? "text-emerald-600" : "text-amber-600")}
                            aria-label={g.tipo === "I" ? "Entró a la caja" : "Salió de la caja"}
                          />
                        )}
                        {g.medioPago}
                      </span>
                    </td>
                    <td className={cn(
                      "px-3 py-2 text-right font-bold tabular-nums whitespace-nowrap",
                      g.tipo === "I" ? "text-emerald-700" : "text-gray-900",
                      g.anulado && "line-through",
                    )}>
                      {g.tipo === "I" ? "+ " : ""}{formatSoles(g.monto)}
                    </td>
                    <td className="px-3 py-2">
                      <Acciones gasto={g} puedeEditar={puedeEditar(g)} esAdmin={esAdmin}
                        onEditar={() => { setEditando(g); setModalAbierto(true); }}
                        onAnular={() => setAnulando(g)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Celular */}
            <ul className="md:hidden divide-y divide-gray-100">
              {lista.items.map((g) => (
                <li key={g.gastoId} className={cn("px-3 py-2.5 flex items-start gap-3", g.anulado && "opacity-50")}>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <ChipCategoria nombre={g.categoriaNombre} icono={g.categoriaIcono} color={g.categoriaColor} />
                      <span className={cn(
                        "text-sm font-black tabular-nums",
                        g.tipo === "I" ? "text-emerald-700" : "text-gray-900",
                        g.anulado && "line-through",
                      )}>
                        {g.tipo === "I" ? "+ " : ""}{formatSoles(g.monto)}
                      </span>
                    </div>
                    <p className={cn("text-sm font-medium text-gray-800 truncate", g.anulado && "line-through")}>{g.descripcion}</p>
                    <p className="text-[11px] text-gray-400 flex items-center gap-1">
                      {formatFechaCorta(g.fecha)} · {g.medioPago}
                      {g.pagadoConCaja && <Banknote className={cn("w-3 h-3", g.tipo === "I" ? "text-emerald-600" : "text-amber-600")} />}
                      {g.comprobanteId && <FileCheck className="w-3 h-3 text-sky-600" />}
                      {g.adjuntoUrl && (
                        <a href={g.adjuntoUrl} target="_blank" rel="noreferrer" className="text-brand-blue"><ImageIcon className="w-3 h-3" /></a>
                      )}
                    </p>
                  </div>
                  <Acciones gasto={g} puedeEditar={puedeEditar(g)} esAdmin={esAdmin}
                    onEditar={() => { setEditando(g); setModalAbierto(true); }}
                    onAnular={() => setAnulando(g)} />
                </li>
              ))}
            </ul>

            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
                <span>Página {filtros.page} de {totalPaginas} · {lista.total} {t("gastos", "ingresos")}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setFiltros((f) => ({ ...f, page: Math.max(1, f.page - 1) }))}
                    disabled={filtros.page <= 1}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40"
                    aria-label="Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setFiltros((f) => ({ ...f, page: Math.min(totalPaginas, f.page + 1) }))}
                    disabled={filtros.page >= totalPaginas}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40"
                    aria-label="Siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ModalGasto
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        tipo={(editando?.tipo ?? tipo) as TipoMovimiento}
        categorias={inicio?.categorias ?? []}
        gasto={editando}
        esAdmin={esAdmin}
        esSuperAdmin={esSuperAdmin}
        cajaTurnoAbiertoId={inicio?.cajaTurnoAbiertoId ?? null}
        sucursales={sucursales}
        onGuardar={guardar}
        onEmitir={() => setEmitiendo(true)}
        onProgramar={programar}
      />
      <ModalAnularGasto gasto={anulando} onClose={() => setAnulando(null)} onConfirmar={anular} />
    </div>
  );
}

function Tarjeta({
  icono: Icono, color, titulo, valor, detalle, valorChico,
}: {
  icono: React.ComponentType<{ className?: string }>;
  color: string;
  titulo: string;
  valor: string;
  detalle?: string;
  valorChico?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#E2EAF6] bg-white px-3.5 py-3 shadow-xs min-w-0">
      <div className="flex items-center gap-2">
        <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", color)}>
          <Icono className="w-4 h-4" />
        </span>
        <p className="text-[11px] font-semibold text-gray-500 truncate">{titulo}</p>
      </div>
      <p className={cn("mt-1.5 font-black text-gray-900 tabular-nums truncate", valorChico ? "text-sm" : "text-base")}>{valor}</p>
      {detalle && <p className="text-[11px] text-gray-400 truncate">{detalle}</p>}
    </div>
  );
}

function Acciones({
  gasto, puedeEditar, esAdmin, onEditar, onAnular,
}: {
  gasto: Gasto;
  puedeEditar: boolean;
  esAdmin: boolean;
  onEditar: () => void;
  onAnular: () => void;
}) {
  if (gasto.anulado) return <span className="text-[10px] font-semibold uppercase text-rose-500">Anulado</span>;
  return (
    <div className="flex items-center justify-end gap-0.5">
      {puedeEditar && (
        <button onClick={onEditar} title="Editar" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
      {esAdmin && (
        <button onClick={onAnular} title="Anular" className="p-1.5 rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600">
          <Ban className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
