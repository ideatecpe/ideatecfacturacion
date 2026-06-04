"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import axios from "axios";
import { useToast } from "@/app/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { useSucursal } from "@/app/factufly/operaciones/boleta/gestionBoletas/useSucursal";
import { useEmpresaEmisor } from "@/app/factufly/operaciones/boleta/gestionBoletas/useEmpresaEmisor";
import { numeroAlertas } from "@/app/components/ui/numeroAlertas";
import { buscarDocumento } from "./clienteLookup";

import type { FilaCarga, FilaErrores, PeriodoKey, ResultadoEmitido, ProgresoEmision } from "./types";
import { PERIODO_ORDER, PERIODO_CFG } from "./constants";
import {
  normalizar,
  alias,
  getTipoDoc,
  toIsoDate,
  toLocalIso,
  parseIsoLocalDate,
  finPeriodo,
  sumarPeriodo,
  periodoTexto,
  generarConcepto,
  calcItemVelsat,
  calcTotalesGrupo,
  validarFila,
} from "./helpers";

// ─── Base URL de la API PlantillaVelsat ──────────────────────────────────────
const PLANTILLA_API = `${process.env.NEXT_PUBLIC_API_URL}/api/PlantillaVelsat`;

// ─── Campos que se persisten en la API (el resto son locales) ────────────────
// igv → siempre 18 (no está en la API)
// correo / whatsapp / tipoOverride → solo estado local

// ─── Mapper: respuesta API → FilaCarga ───────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const apiRowToFila = (row: any): FilaCarga => ({
  id:           String(row.id),
  numdoc:       String(row.numdoc       ?? ""),
  razonSocial:  String(row.razonSocial  ?? ""),
  periodo:      String(row.periodo      ?? "1"),
  concepto:     String(row.concepto     ?? ""),
  importe:      Number(row.importe)     || 0,
  igv:          18,   // fijo — no está en la API
  moneda:       String(row.moneda       ?? "PEN").toUpperCase(),
  correo:       String(row.correo       ?? ""),
  whatsapp:     String(row.whatsapp     ?? ""),
  fechaini:     row.fechaini ? String(row.fechaini).slice(0, 10) : "",
  fechafin:     row.fechafin ? String(row.fechafin).slice(0, 10) : "",
  placa:        String(row.placa        ?? ""),
  tipoOverride: undefined,
});

// ─── Mapper: FilaCarga → body para POST / PATCH ───────────────────────────────
const filaToPostBody = (fila: Omit<FilaCarga, "id">) => ({
  numdoc:      fila.numdoc,
  razonSocial: fila.razonSocial,
  periodo:     String(fila.periodo),
  concepto:    fila.concepto,
  moneda:      fila.moneda,
  importe:     Number(fila.importe),
  correo:      fila.correo   || null,
  whatsapp:    fila.whatsapp || null,
  fechaini:    fila.fechaini  ? `${fila.fechaini}T00:00:00`  : null,
  fechafin:    fila.fechafin  ? `${fila.fechafin}T00:00:00`  : null,
  placa:       fila.placa,
});

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useCargaComprobantes() {
  const { user, accessToken } = useAuth();
  const { showToast }         = useToast();
  const { sucursal }          = useSucursal();
  const { empresa }           = useEmpresaEmisor();

  // ── Estado ──
  const [filas,                 setFilas]                = useState<FilaCarga[]>([]);
  const [filasDeshabilitadas,   setFilasDeshabilitadas]  = useState<FilaCarga[]>([]);
  const [cargandoPlantilla,     setCargandoPlantilla]    = useState(false);
  const [emitiendo,             setEmitiendo]            = useState(false);
  const [modalPlantillaOpen,    setModalPlantillaOpen]   = useState(false);
  const [tabActiva,             setTabActiva]            = useState<PeriodoKey>("todos");
  const [fechaEmision,          setFechaEmision]         = useState<string>(toLocalIso(new Date()));
  const [periodosExpandidos,    setPeriodosExpandidos]   = useState<Set<string>>(() => new Set());
  const [loadingRazonSocialIds, setLoadingRazonSocialIds] = useState<Set<string>>(new Set());
  const [resultadoEmision,      setResultadoEmision]     = useState<ResultadoEmitido[] | null>(null);
  const [modalResultadoOpen,    setModalResultadoOpen]   = useState(false);
  const [progresoEmision,       setProgresoEmision]      = useState<ProgresoEmision | null>(null);

  // Ref para evitar stale closures en los debounces de PATCH
  const filasRef      = useRef<FilaCarga[]>([]);
  const patchTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => { filasRef.current = filas; }, [filas]);

  const esUsuarioVelsat =
    user?.username?.toLowerCase() === "velsat" || user?.ruc === "10073587382";

  // ── Cabeceras JWT ──
  const getHeaders = useCallback(() => ({
    Authorization:  `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  }), [accessToken]);

  // ── Acordeón ──
  const togglePeriodo = (p: string) =>
    setPeriodosExpandidos((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });

  // ── Computed ──
  const grupos = useMemo(() => {
    const map = new Map<string, FilaCarga[]>();
    filas.forEach((fila) => {
      const pt     = periodoTexto(fila.periodo);
      const moneda = (fila.moneda || "PEN").toUpperCase().trim();
      const tipo   = getTipoDoc(fila);
      const key    = `${fila.numdoc.trim()}||${pt}||${moneda}||${tipo}`;
      if (!fila.numdoc.trim()) return;
      map.set(key, [...(map.get(key) ?? []), fila]);
    });
    return Array.from(map.entries()).map(([key, items]) => {
      const [numdoc, periodoTipo, moneda, tipoDoc] = key.split("||");
      const totales = calcTotalesGrupo(items);
      return {
        key,
        numdoc,
        periodoTipo,
        moneda:      moneda || "PEN",
        tipoDoc:     (tipoDoc ?? "B") as "B" | "F",
        razonSocial: items[0]?.razonSocial ?? "",
        correo:      items[0]?.correo      ?? "",
        whatsapp:    items[0]?.whatsapp    ?? "",
        items,
        total:   totales.importeTotal,
        totales,
      };
    });
  }, [filas]);

  const periodosPresentes = useMemo(() => {
    const set = new Set(filas.map((f) => periodoTexto(f.periodo)));
    return PERIODO_ORDER.filter((p) => set.has(p));
  }, [filas]);

  const filasFiltradas = useMemo(
    () => (tabActiva === "todos" ? filas : filas.filter((f) => periodoTexto(f.periodo) === tabActiva)),
    [filas, tabActiva],
  );

  const gruposFiltrados = useMemo(
    () => (tabActiva === "todos" ? grupos : grupos.filter((g) => g.periodoTipo === tabActiva)),
    [grupos, tabActiva],
  );

  const stats = useMemo(
    () => ({
      filas:        filasFiltradas.length,
      comprobantes: gruposFiltrados.length,
      total:        gruposFiltrados.reduce((s, g) => s + g.total, 0),
    }),
    [filasFiltradas, gruposFiltrados],
  );

  const statsPorPeriodo = useMemo(() => {
    const result: Record<string, { filas: number; total: number; comprobantes: number }> = {};
    for (const p of PERIODO_ORDER) {
      const fs = filas.filter((f) => periodoTexto(f.periodo) === p);
      const gs = grupos.filter((g) => g.periodoTipo === p);
      result[p] = {
        filas:        fs.length,
        total:        gs.reduce((s, g) => s + g.total, 0),
        comprobantes: gs.length,
      };
    }
    return result;
  }, [filas, grupos]);

  /** Mapa id → errores de validación; solo contiene filas con al menos un error */
  const erroresPorFila = useMemo(() => {
    const map = new Map<string, FilaErrores>();
    for (const fila of filas) {
      const errs = validarFila(fila);
      if (Object.keys(errs).length > 0) map.set(fila.id, errs);
    }
    return map;
  }, [filas]);

  /** Días de ventana antes del siguiente período donde ya se puede emitir normalmente */
  const DIAS_VENTANA_EMISION = 7;

  const advertenciaTemprana = useMemo((): {
    diasHasta: number;
    fechaIniMin: string;
    periodoLabel: string;
  } | null => {
    if (tabActiva === "todos") return null;
    const fechas = gruposFiltrados
      .flatMap((g) => g.items.map((i) => i.fechaini))
      .filter(Boolean);
    if (!fechas.length) return null;
    const fechaIniMin = [...fechas].sort()[0];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const siguiente = parseIsoLocalDate(fechaIniMin);
    if (!siguiente) return null;
    const diasHasta = Math.floor(
      (siguiente.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diasHasta <= DIAS_VENTANA_EMISION) return null;
    return { diasHasta, fechaIniMin, periodoLabel: PERIODO_CFG[tabActiva]?.label ?? tabActiva };
  }, [gruposFiltrados, tabActiva]);

  // ── Cargar registros desde la API ──
  const cargarDesdeApi = useCallback(async () => {
    if (!accessToken) return;
    setCargandoPlantilla(true);
    try {
      const res = await axios.get<unknown[]>(`${PLANTILLA_API}/all`, { headers: getHeaders() });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const todos = res.data as any[];
      setFilas(todos.filter((r) => r.estado === 1).map(apiRowToFila));
      setFilasDeshabilitadas(todos.filter((r) => r.estado === 0).map(apiRowToFila));
    } catch {
      showToast("Error al cargar los registros desde el servidor", "error");
    } finally {
      setCargandoPlantilla(false);
    }
  }, [accessToken, getHeaders, showToast]);

  // Carga inicial cuando el token está disponible
  useEffect(() => {
    if (accessToken && esUsuarioVelsat) cargarDesdeApi();
  }, [accessToken, esUsuarioVelsat]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Recuperar TODOS los deshabilitados de golpe (botón de emergencia) ──
  const recuperarDatos = useCallback(async () => {
    if (!accessToken) return;
    setCargandoPlantilla(true);
    try {
      const res = await axios.get<unknown[]>(`${PLANTILLA_API}/all`, { headers: getHeaders() });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const todos     = res.data as any[];
      const borrados  = todos.filter((r) => r.estado === 0);
      if (!borrados.length) {
        showToast("No hay registros deshabilitados que recuperar", "error");
        return;
      }
      await Promise.allSettled(
        borrados.map((r) =>
          axios.patch(`${PLANTILLA_API}/${r.id}`, { estado: 1 }, { headers: getHeaders() }),
        ),
      );
      setFilas(todos.map(apiRowToFila));
      setFilasDeshabilitadas([]);
      showToast(`${borrados.length} registro${borrados.length !== 1 ? "s" : ""} recuperado${borrados.length !== 1 ? "s" : ""}`, "success");
    } catch {
      showToast("Error al recuperar los registros", "error");
    } finally {
      setCargandoPlantilla(false);
    }
  }, [accessToken, getHeaders, showToast]);

  // ── Resolución masiva de razón social ──
  const resolverRazonSociales = async (rows: FilaCarga[]): Promise<FilaCarga[]> => {
    const pendientes = [
      ...new Set(
        rows
          .filter((r) => !r.razonSocial.trim() && (r.numdoc.length === 8 || r.numdoc.length === 11))
          .map((r) => r.numdoc),
      ),
    ];
    if (!pendientes.length) return rows;

    // Mapa numdoc → { razonSocial, correo, whatsapp }
    const mapa = new Map<string, { razonSocial: string; correo: string | null; whatsapp: string | null }>();
    await Promise.allSettled(
      pendientes.map(async (numdoc) => {
        const res = await buscarDocumento(numdoc, accessToken ?? "", user?.ruc ?? "");
        mapa.set(numdoc, res);
      }),
    );

    return rows.map((r) => {
      if (r.razonSocial.trim() || !mapa.has(r.numdoc)) return r;
      const found = mapa.get(r.numdoc)!;
      return {
        ...r,
        razonSocial: found.razonSocial || r.razonSocial,
        // Solo autocompleta correo/whatsapp si vinieron de local y el campo está vacío
        correo:   (!r.correo   && found.correo)   ? found.correo   : r.correo,
        whatsapp: (!r.whatsapp && found.whatsapp) ? found.whatsapp : r.whatsapp,
      };
    });
  };

  // ── Agregar fila manualmente → POST ──
  const agregarFila = async (filaSinId: Omit<FilaCarga, "id">) => {
    try {
      const res = await axios.post(PLANTILLA_API, filaToPostBody(filaSinId), { headers: getHeaders() });
      setFilas((prev) => [...prev, apiRowToFila(res.data)]);
      showToast("Registro guardado correctamente", "success");
    } catch {
      showToast("Error al guardar el registro", "error");
    }
  };

  // ── Deshabilitar fila → PATCH estado:0 ──
  const deshabilitarFila = async (id: string) => {
    const fila = filasRef.current.find((f) => f.id === id);
    setFilas((prev) => prev.filter((f) => f.id !== id)); // optimista
    try {
      await axios.patch(`${PLANTILLA_API}/${id}`, { estado: 0 }, { headers: getHeaders() });
      if (fila) setFilasDeshabilitadas((prev) => [...prev, fila]);
    } catch {
      showToast("Error al deshabilitar — recargando...", "error");
      cargarDesdeApi();
    }
  };

  // ── Habilitar fila deshabilitada con nueva fecha de inicio ──
  const habilitarFila = async (id: string, nuevaFechaIni: string) => {
    const fila = filasDeshabilitadas.find((f) => f.id === id);
    if (!fila) return;
    const fechafin = finPeriodo(nuevaFechaIni, fila.periodo);
    const concepto = generarConcepto(fila.periodo, nuevaFechaIni, fechafin, fila.placa);
    const filaActualizada: FilaCarga = { ...fila, fechaini: nuevaFechaIni, fechafin, concepto };
    // Optimista: mueve de deshabilitadas a activas
    setFilasDeshabilitadas((prev) => prev.filter((f) => f.id !== id));
    setFilas((prev) => [...prev, filaActualizada]);
    try {
      await axios.patch(
        `${PLANTILLA_API}/${id}`,
        {
          estado:   1,
          fechaini: `${nuevaFechaIni}T00:00:00`,
          fechafin: `${fechafin}T00:00:00`,
          concepto,
        },
        { headers: getHeaders() },
      );
      showToast(`${fila.placa} habilitada`, "success");
    } catch {
      // Rollback optimista
      setFilas((prev) => prev.filter((f) => f.id !== id));
      setFilasDeshabilitadas((prev) => [...prev, fila]);
      showToast("Error al habilitar — intenta de nuevo", "error");
    }
  };

  // ── Ajustar fechaini al 1° del mes actual → PATCH masivo ──
  const ajustarFechasInicioMes = async () => {
    const hoy      = new Date();
    const primerDia = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
    const idsAfectar = new Set(filasFiltradas.map((f) => f.id));
    const actualizadas = filas.map((fila) => {
      if (!idsAfectar.has(fila.id)) return fila;
      const fechafin = finPeriodo(primerDia, fila.periodo);
      const concepto = generarConcepto(fila.periodo, primerDia, fechafin, fila.placa);
      return { ...fila, fechaini: primerDia, fechafin, concepto };
    });
    setFilas(actualizadas);

    // PATCH en paralelo solo las afectadas
    await Promise.allSettled(
      actualizadas
        .filter((f) => idsAfectar.has(f.id))
        .map((f) =>
          axios.patch(
            `${PLANTILLA_API}/${f.id}`,
            {
              fechaini: `${f.fechaini}T00:00:00`,
              fechafin: `${f.fechafin}T00:00:00`,
              concepto: f.concepto,
            },
            { headers: getHeaders() },
          ),
        ),
    );
    showToast(`${idsAfectar.size} fila${idsAfectar.size !== 1 ? "s" : ""} actualizadas al 1° del mes`, "success");
  };

  // ── Limpiar carga → DELETE lógico de todas las filas ──
  const limpiarCarga = async () => {
    const ids = filas.map((f) => f.id);
    setFilas([]);
    setTabActiva("todos");
    await Promise.allSettled(
      ids.map((id) => axios.delete(`${PLANTILLA_API}/${id}`, { headers: getHeaders() })),
    );
    showToast("Registros eliminados correctamente", "success");
  };

  // ── Cargar Excel → POST de cada fila al API ──
  const cargarExcel = async (file: File) => {
    const buffer   = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const raw      = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });

    const headerIndex = raw.findIndex((row) => {
      const normalized = (row as unknown[]).map((cell) => normalizar(String(cell ?? "")));
      return normalized.includes("numdoc");
    });

    if (headerIndex === -1) {
      showToast("No se encontró la columna 'numdoc' en el Excel", "error");
      return;
    }

    const headers = (raw[headerIndex] as unknown[]).map((cell) => String(cell ?? ""));
    const rows    = raw.slice(headerIndex + 1).map((row) =>
      headers.reduce<Record<string, unknown>>((acc, header, index) => {
        if (header.trim()) acc[header] = (row as unknown[])[index] ?? "";
        return acc;
      }, {}),
    );

    const parsed = rows
      .map((row, index) => {
        const normalizedEntries = Object.entries(row).map(([key, value]) => [normalizar(key), value]);
        const getValue = (field: keyof Omit<FilaCarga, "id" | "tipoOverride">) => {
          const match = normalizedEntries.find(([key]) =>
            alias[field].map(normalizar).includes(key as string),
          );
          return match?.[1] ?? "";
        };
        const fechaini      = toIsoDate(getValue("fechaini"));
        const periodo       = String(getValue("periodo") || "1");
        const placa         = String(getValue("placa")).trim();
        const fechafin      = toIsoDate(getValue("fechafin")) || finPeriodo(fechaini, periodo);
        const conceptoExcel = String(getValue("concepto")).trim();
        const concepto      = conceptoExcel || generarConcepto(periodo, fechaini, fechafin, placa);
        const monedaRaw     = String(getValue("moneda")).trim().toUpperCase();
        return {
          id:          `tmp-${Date.now()}-${index}`, // temporal, se reemplaza con id real
          numdoc:      String(getValue("numdoc")).trim(),
          razonSocial: String(getValue("razonSocial")).trim(),
          periodo,
          concepto,
          importe:     Number(getValue("importe")) || 0,
          igv:         18,
          moneda:      monedaRaw === "USD" ? "USD" : "PEN",
          correo:      String(getValue("correo")).trim(),
          whatsapp:    String(getValue("whatsapp")).trim(),
          fechaini,
          fechafin,
          placa,
        } satisfies FilaCarga;
      })
      .filter((fila) => fila.numdoc || fila.importe || fila.fechaini || fila.placa);

    if (!parsed.length) {
      showToast("No se encontraron filas válidas en el Excel", "error");
      return;
    }

    setModalPlantillaOpen(false);
    setCargandoPlantilla(true);
    showToast(`Subiendo ${parsed.length} filas al servidor…`, "success");

    try {
      // POST en paralelo — cada fila crea un registro en la API
      const resultadosPost = await Promise.allSettled(
        parsed.map((fila) =>
          axios.post(PLANTILLA_API, filaToPostBody(fila), { headers: getHeaders() })
            .then((r) => apiRowToFila(r.data)),
        ),
      );

      const creadosOk: FilaCarga[] = resultadosPost
        .filter((r): r is PromiseFulfilledResult<FilaCarga> => r.status === "fulfilled")
        .map((r) => r.value);

      const fallidos = resultadosPost.filter((r) => r.status === "rejected").length;

      setFilas((prev) => [...prev, ...creadosOk]);
      setTabActiva("todos");

      if (fallidos > 0) {
        showToast(`${creadosOk.length} filas guardadas · ${fallidos} con error`, "error");
      } else {
        showToast(`${creadosOk.length} filas cargadas correctamente`, "success");
      }

      // Resolver razón social faltante en background + PATCH
      const conNombres = await resolverRazonSociales(creadosOk);
      const conNombresMap = new Map(conNombres.map((f) => [f.id, f.razonSocial]));

      await Promise.allSettled(
        conNombres
          .filter((f) => conNombresMap.get(f.id) && !creadosOk.find((c) => c.id === f.id)?.razonSocial)
          .map((f) =>
            axios.patch(
              `${PLANTILLA_API}/${f.id}`,
              { razonSocial: f.razonSocial },
              { headers: getHeaders() },
            ),
          ),
      );
      setFilas((prev) =>
        prev.map((f) =>
          conNombresMap.has(f.id) ? { ...f, razonSocial: conNombresMap.get(f.id)! } : f,
        ),
      );
    } catch {
      showToast("Error inesperado al cargar el Excel", "error");
    } finally {
      setCargandoPlantilla(false);
    }
  };

  // ── Edición inline → actualiza estado local + PATCH debounced ──
  const actualizarFila = (id: string, campo: keyof FilaCarga, valor: string) => {
    // 1 — Actualización local inmediata
    setFilas((prev) => {
      const actualizadas = prev.map((fila) => {
        if (fila.id !== id) return fila;
        const next: FilaCarga = {
          ...fila,
          [campo]: (campo === "importe" || campo === "igv") ? Number(valor) : valor,
        };
        if (campo === "numdoc") {
          next.razonSocial  = "";
          next.tipoOverride = undefined;
        }
        if (campo === "fechaini" || campo === "periodo") {
          next.fechafin = finPeriodo(String(next.fechaini), String(next.periodo));
        }
        if (["periodo", "fechaini", "fechafin", "placa"].includes(campo)) {
          next.concepto = generarConcepto(
            String(next.periodo), String(next.fechaini), String(next.fechafin), String(next.placa),
          );
        }
        return next;
      });
      return actualizadas;
    });

    // 2 — Auto-consulta cuando numdoc alcanza 8 (DNI) u 11 (RUC) dígitos
    //     Primero busca en clientes locales (con correo/whatsapp); si no, json.pe
    if (campo === "numdoc" && (valor.length === 8 || valor.length === 11)) {
      setLoadingRazonSocialIds((prev) => new Set(prev).add(id));
      (async () => {
        try {
          const found = await buscarDocumento(valor, accessToken ?? "", user?.ruc ?? "");
          if (found.razonSocial) {
            setFilas((prev) => prev.map((f) => {
              if (f.id !== id) return f;
              return {
                ...f,
                razonSocial: found.razonSocial,
                // Autocompleta correo y whatsapp solo si estaban vacíos y vienen de local
                correo:   (!f.correo   && found.correo)   ? found.correo   : f.correo,
                whatsapp: (!f.whatsapp && found.whatsapp) ? found.whatsapp : f.whatsapp,
              };
            }));
            // PATCH en API — incluye correo/whatsapp si vinieron de local
            await axios.patch(
              `${PLANTILLA_API}/${id}`,
              {
                razonSocial: found.razonSocial,
                ...(found.correo   ? { correo:   found.correo   } : {}),
                ...(found.whatsapp ? { whatsapp: found.whatsapp } : {}),
              },
              { headers: getHeaders() },
            );
          }
        } catch {
          // silencioso — el usuario puede ingresar el nombre manualmente
        } finally {
          setLoadingRazonSocialIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      })();
    }

    // 3 — PATCH debounced a la API (campos que persisten en servidor)
    const CAMPOS_API: (keyof FilaCarga)[] = [
      "numdoc", "razonSocial", "periodo", "concepto", "importe", "moneda",
      "correo", "whatsapp", "fechaini", "fechafin", "placa",
    ];
    if (!CAMPOS_API.includes(campo)) return;

    const existing = patchTimeouts.current.get(id);
    if (existing) clearTimeout(existing);

    const timeout = setTimeout(async () => {
      patchTimeouts.current.delete(id);
      const fila = filasRef.current.find((f) => f.id === id);
      if (!fila) return;

      // Construir body con el campo cambiado + campos recalculados
      const body: Record<string, unknown> = {};
      switch (campo) {
        case "numdoc":      body.numdoc    = fila.numdoc; break;
        case "razonSocial": body.razonSocial = fila.razonSocial; break;
        case "importe":     body.importe   = fila.importe; break;
        case "moneda":      body.moneda    = fila.moneda;  break;
        case "concepto":    body.concepto  = fila.concepto; break;
        case "correo":      body.correo    = fila.correo    || null; break;
        case "whatsapp":    body.whatsapp  = fila.whatsapp  || null; break;
        case "placa":
          body.placa   = fila.placa;
          body.concepto = fila.concepto;
          break;
        case "periodo":
          body.periodo  = fila.periodo;
          body.fechafin = fila.fechafin ? `${fila.fechafin}T00:00:00` : null;
          body.concepto = fila.concepto;
          break;
        case "fechaini":
          body.fechaini = fila.fechaini ? `${fila.fechaini}T00:00:00` : null;
          body.fechafin = fila.fechafin ? `${fila.fechafin}T00:00:00` : null;
          body.concepto = fila.concepto;
          break;
        case "fechafin":
          body.fechafin = fila.fechafin ? `${fila.fechafin}T00:00:00` : null;
          body.concepto = fila.concepto;
          break;
      }

      try {
        await axios.patch(`${PLANTILLA_API}/${id}`, body, { headers: getHeaders() });
      } catch {
        // Silent — el dato ya está en UI. Si falla, el usuario verá el dato correcto
        // en la próxima carga desde API.
      }
    }, 600);

    patchTimeouts.current.set(id, timeout);
  };

  // ── Descarga plantilla Excel ──
  const descargarPlantilla = async () => {
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    wb.creator = "FactuFly";
    wb.created = new Date();

    const ws = wb.addWorksheet("Carga Velsat", {
      pageSetup: { paperSize: 9, orientation: "landscape" },
    });

    ws.columns = [
      { key: "numdoc",   width: 14 },
      { key: "periodo",  width: 10 },
      { key: "importe",  width: 12 },
      { key: "igv",      width: 8  },
      { key: "moneda",   width: 8  },
      { key: "fechaini", width: 14 },
      { key: "fechafin", width: 14 },
      { key: "placa",    width: 12 },
      { key: "correo",   width: 28 },
      { key: "whatsapp", width: 14 },
    ];

    const AZUL   = "2563EB";
    const OSCURO = "1E3A5F";
    const BLANCO = "FFFFFF";
    const AMBER  = "FEF3C7";
    const VERDE  = "DCFCE7";

    ws.mergeCells("A1:J1");
    ws.getRow(1).height = 34;
    const title = ws.getCell("A1");
    title.value     = "CARGA COMPROBANTES VELSAT — PLANTILLA";
    title.font      = { name: "Calibri", bold: true, size: 14, color: { argb: `FF${BLANCO}` } };
    title.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${OSCURO}` } };
    title.alignment = { horizontal: "center", vertical: "middle" };

    ws.mergeCells("A2:J2");
    ws.getRow(2).height = 30;
    const instr = ws.getCell("A2");
    instr.value     = "Una fila por placa. Mismo numdoc + mismo período = un solo comprobante. IGV=18 → gravada. Moneda: PEN o USD.";
    instr.font      = { name: "Calibri", size: 9, italic: true, color: { argb: "FF92400E" } };
    instr.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${AMBER}` } };
    instr.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

    const cabeceras = ["numdoc", "periodo", "importe", "igv", "moneda", "fechaini", "fechafin", "placa", "correo", "whatsapp"];
    ws.getRow(3).height = 30;
    cabeceras.forEach((header, index) => {
      const cell     = ws.getCell(3, index + 1);
      cell.value     = header;
      cell.font      = { name: "Calibri", size: 10, bold: true, color: { argb: `FF${BLANCO}` } };
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${AZUL}` } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border    = {
        top:    { style: "thin", color: { argb: "FFFFFFFF" } },
        bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
        left:   { style: "thin", color: { argb: "FFFFFFFF" } },
        right:  { style: "thin", color: { argb: "FFFFFFFF" } },
      };
    });

    const ejemplos = [
      ["41431773",    1,     39,  18, "PEN", new Date(2026, 4, 1),  new Date(2026, 4, 31), "M3N-046", "cliente1@gmail.com", "987654321"],
      ["09647995",    1,     50,  18, "PEN", new Date(2026, 4, 1),  new Date(2026, 4, 31), "BHR-277", "cliente2@gmail.com", ""],
      ["09647995",    1,     50,  18, "PEN", new Date(2026, 4, 1),  new Date(2026, 4, 31), "ADE-442", "",                   ""],
      ["09647995",   "1/2",  25,  18, "PEN", new Date(2026, 4, 16), new Date(2026, 4, 31), "ABC-123", "",                   ""],
      ["20601234567", 1,    295,  18, "PEN", new Date(2026, 4, 1),  new Date(2026, 4, 31), "XYZ-999", "empresa@ruc.com",    ""],
    ];

    ejemplos.forEach((row, rowIndex) => {
      const excelRow = ws.getRow(rowIndex + 4);
      excelRow.height = 23;
      row.forEach((value, colIdx) => {
        const cell    = ws.getCell(rowIndex + 4, colIdx + 1);
        cell.value    = value === "" ? null : value;
        cell.font     = { name: "Calibri", size: 10, color: { argb: "FF1E293B" } };
        const isAmber = colIdx === 1 || colIdx === 2 || colIdx === 3 || colIdx === 4;
        cell.fill = {
          type: "pattern", pattern: "solid",
          fgColor: { argb: isAmber ? `FF${AMBER}` : rowIndex % 2 === 0 ? "FFF0F9FF" : "FFEFF6FF" },
        };
        cell.border    = {
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right:  { style: "thin", color: { argb: "FFE2E8F0" } },
        };
        cell.alignment = { horizontal: isAmber ? "center" : "left", vertical: "middle" };
        if (colIdx === 2) { cell.numFmt = "#,##0.00"; cell.alignment = { horizontal: "right", vertical: "middle" }; }
        if (colIdx === 5 || colIdx === 6) { cell.numFmt = "dd/mm/yyyy"; cell.alignment = { horizontal: "center", vertical: "middle" }; }
      });
    });

    ws.views      = [{ state: "frozen", ySplit: 3, topLeftCell: "A4" }];
    ws.autoFilter = "A3:J3";

    const wsI = wb.addWorksheet("Instrucciones");
    wsI.columns = [{ width: 100 }];
    const lines: [string, boolean, string, string?][] = [
      ["INSTRUCCIONES — CARGA COMPROBANTES VELSAT", true, `FF${BLANCO}`, `FF${OSCURO}`],
      ["", false, "FF1E293B"],
      ["COLUMNAS:", true, `FF${AZUL}`],
      ["numdoc: DNI (8 dígitos = Boleta) o RUC (11 dígitos = Factura) del cliente.", false, "FF1E293B"],
      ["periodo: 1/2=quincenal, 1=mensual, 2=bimestral, 3=trimestral, 6=semestral, 12=anual. Para días exactos use Nd (ej: 17d).", false, "FF1E293B"],
      ["importe: monto por placa CON IGV incluido (IGV siempre 18%). Moneda: PEN o USD.", false, "FF1E293B"],
      ["fechaini / fechafin: fechas del servicio. Formato DD/MM/YYYY.", false, "FF1E293B"],
      ["placa: placa de la unidad (requerido).", false, "FF1E293B"],
      ["correo: correo del cliente para envío de comprobante (opcional).", false, "FF1E293B"],
      ["whatsapp: número WhatsApp, 9 dígitos empezando con 9 (opcional).", false, "FF1E293B"],
      ["", false, "FF1E293B"],
      ["REGLAS:", true, `FF${AZUL}`],
      ["• Una fila = una placa.", false, "FF1E293B"],
      ["• Mismo numdoc + mismo período + misma moneda → un solo comprobante agrupado.", false, "FF1E293B"],
      ["• Tras emitir, las fechas avanzan automáticamente al siguiente período.", false, "FF1E293B"],
      ["• Los comprobantes se crean como PENDIENTE, envíelos a SUNAT desde Comprobantes.", false, "FF1E293B"],
      ["", false, "FF1E293B"],
      ["IMPORTANTE:", true, "FFDC2626"],
      ["No agregue ni elimine columnas. Mantenga los nombres de cabecera tal como están.", false, "FF1E293B", `FF${VERDE}`],
    ];
    lines.forEach(([text, bold, color, fill], index) => {
      const row  = wsI.getRow(index + 1);
      row.height = index === 0 ? 34 : 21;
      const cell = wsI.getCell(index + 1, 1);
      cell.value     = text;
      cell.font      = { name: "Calibri", size: index === 0 ? 13 : 11, bold, color: { argb: color } };
      cell.alignment = { wrapText: true, vertical: "middle" };
      if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href       = url;
    a.download   = "Plantilla Carga Comprobantes Velsat.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Emitir → POST /api/Comprobantes/GenerarMasivo ──
  const emitir = async () => {
    if (tabActiva === "todos") {
      showToast("Selecciona un período específico antes de emitir", "error");
      return;
    }
    if (!filasFiltradas.length || !gruposFiltrados.length) {
      showToast("No hay registros para emitir", "error");
      return;
    }
    if (!sucursal || !empresa) {
      showToast("Esperando datos de sucursal y empresa, intenta en un momento", "error");
      return;
    }
    if (!fechaEmision) {
      showToast("Selecciona una fecha de emisión", "error");
      return;
    }

    const filasConErrores = gruposFiltrados.flatMap((g) => g.items).filter((f) => erroresPorFila.has(f.id));
    if (filasConErrores.length > 0) {
      const n = filasConErrores.length;
      showToast(`${n} fila${n !== 1 ? "s" : ""} con errores — corrígelas antes de emitir`, "error");
      return;
    }

    setEmitiendo(true);
    setResultadoEmision(null);
    setProgresoEmision(null);

    try {
      const resSucursal    = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal/${sucursal.sucursalId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const sucursalActual     = resSucursal.data;
      let correlativoBoleta:  number = sucursalActual.correlativoBoleta;
      let correlativoFactura: number = sucursalActual.correlativoFactura;

      const fechaISO      = `${fechaEmision}T00:00:00`;
      const gruposAEmitir = gruposFiltrados;

      const payloads = gruposAEmitir.map((grupo) => {
        const esBoleta       = grupo.tipoDoc === "B";
        const tipoComp       = esBoleta ? "03" : "01";
        const tipoDocCliente = esBoleta ? "01" : "6";
        const serie          = esBoleta ? sucursalActual.serieBoleta : sucursalActual.serieFactura;
        const correlativo    = esBoleta ? correlativoBoleta++ : correlativoFactura++;
        const monedaLabel    = grupo.moneda === "USD" ? "DÓLARES" : "SOLES";
        const { gravadas, exoneradas, igvTotal, importeTotal } = grupo.totales;

        const details = grupo.items.map((item, idx) => {
          const igvPct = Number(item.igv) || 18; // siempre 18 si no especificado
          const calc   = calcItemVelsat(Number(item.importe) || 0, igvPct);
          return {
            item:                idx + 1,
            productoId:          null,
            codigo:              null,
            descripcion:         item.concepto,
            cantidad:            1,
            unidadMedida:        "ZZ",
            precioUnitario:      calc.precioUnitario,
            tipoAfectacionIGV:   calc.tipoAfectacionIGV,
            porcentajeIGV:       calc.porcentajeIGV,
            baseIgv:             calc.baseIgv,
            montoIGV:            calc.montoIGV,
            codigoTipoDescuento: "01",
            descuentoUnitario:   0,
            descuentoTotal:      0,
            valorVenta:          calc.valorVenta,
            precioVenta:         calc.precioVenta,
            totalVentaItem:      calc.totalVentaItem,
            icbper:              0,
            factorIcbper:        0,
          };
        });

        return {
          ublVersion:                  "2.1",
          tipoOperacion:               "0101",
          tipoComprobante:             tipoComp,
          tipoMoneda:                  grupo.moneda,
          fechaEmision:                fechaISO,
          horaEmision:                 fechaISO,
          fechaVencimiento:            fechaEmision,
          tipoPago:                    "Contado",
          serie,
          correlativo:                 String(correlativo).padStart(8, "0"),
          company: {
            ...empresa,
            establecimientoAnexo:
              sucursalActual.codEstablecimiento ?? empresa.establecimientoAnexo ?? "0000",
          },
          cliente: {
            clienteId:          null,
            tipoDocumento:      tipoDocCliente,
            numeroDocumento:    grupo.numdoc,
            razonSocial:        grupo.razonSocial,
            ubigeo:             null,
            direccionLineal:    null,
            departamento:       null,
            provincia:          null,
            distrito:           null,
            correo:             grupo.correo   || null,
            enviadoPorCorreo:   false,
            whatsApp:           grupo.whatsapp || null,
            enviadoPorWhatsApp: false,
          },
          details,
          pagos: [{
            medioPago:         "Efectivo",
            monto:             importeTotal,
            fechaPago:         fechaISO,
            numeroOperacion:   "",
            entidadFinanciera: "",
            observaciones:     `Velsat ${grupo.periodoTipo}`,
          }],
          cuotas:                         [],
          guias:                          [],
          totalOperacionesGravadas:       gravadas,
          totalOperacionesExoneradas:     exoneradas,
          totalOperacionesInafectas:      0,
          totalOperacionesGratuitas:      0,
          totalIgvGratuitas:              0,
          totalIGV:                       igvTotal,
          totalIcbper:                    0,
          totalImpuestos:                 igvTotal,
          totalDescuentos:                0,
          totalOtrosCargos:               0,
          subTotal:    parseFloat((gravadas + exoneradas + igvTotal).toFixed(2)),
          importeTotal,
          valorVenta:  parseFloat((gravadas + exoneradas).toFixed(2)),
          montoCredito:          0,
          descuentoGlobal:       0,
          codigoTipoDescGlobal:  "03",
          usuarioCreacion:       user?.id ?? 0,
          enviadoEnResumen:      esBoleta ? false : null,
          legends:               [{ code: "1000", value: numeroAlertas(importeTotal, monedaLabel) }],
        };
      });

      // ── Emisión uno a uno con progreso real ──
      const resultados: ResultadoEmitido[] = [];
      const compUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/Comprobantes/GenerarMasivo`;
      const compHdrs = { Authorization: `Bearer ${accessToken}` };

      for (let i = 0; i < payloads.length; i++) {
        setProgresoEmision({ actual: i + 1, total: payloads.length });
        const grupo = gruposAEmitir[i];
        try {
          await axios.post(compUrl, [payloads[i]], { headers: compHdrs });
          resultados.push({
            serie: payloads[i].serie, correlativo: payloads[i].correlativo,
            tipoDoc: grupo.tipoDoc, razonSocial: grupo.razonSocial,
            numdoc: grupo.numdoc, importeTotal: grupo.total,
            moneda: grupo.moneda, periodoTipo: grupo.periodoTipo, ok: true,
          });
        } catch (err: unknown) {
          const e = err as { response?: { data?: { mensaje?: string; message?: string } }; message?: string };
          resultados.push({
            serie: payloads[i].serie, correlativo: payloads[i].correlativo,
            tipoDoc: grupo.tipoDoc, razonSocial: grupo.razonSocial,
            numdoc: grupo.numdoc, importeTotal: grupo.total,
            moneda: grupo.moneda, periodoTipo: grupo.periodoTipo, ok: false,
            error: e?.response?.data?.mensaje ?? e?.response?.data?.message ?? e?.message ?? "Error al generar",
          });
        }
      }

      setResultadoEmision(resultados);
      setModalResultadoOpen(true);

      // ── Avanzar fechas en API solo para grupos exitosos ──
      const exitosos = resultados.filter((r) => r.ok);
      const idsGruposExitosos = new Set(exitosos.map((r) => `${r.numdoc}||${r.periodoTipo}||${r.moneda}||${r.tipoDoc}`));
      const idsFilasExitosas  = new Set(
        gruposAEmitir
          .filter((g) => idsGruposExitosos.has(g.key))
          .flatMap((g) => g.items.map((i) => i.id)),
      );

      const siguientes = filas.map((fila) => {
        if (!idsFilasExitosas.has(fila.id)) return fila;
        const dFin = parseIsoLocalDate(fila.fechafin);
        const fechaini = dFin
          ? (() => { dFin.setDate(dFin.getDate() + 1); return toLocalIso(dFin); })()
          : sumarPeriodo(fila.fechaini, fila.periodo);
        const fechafin = finPeriodo(fechaini, fila.periodo);
        const concepto = generarConcepto(fila.periodo, fechaini, fechafin, fila.placa);
        return { ...fila, fechaini, fechafin, concepto };
      });
      setFilas(siguientes);

      // PATCH fechas avanzadas en API (background, no bloquea UI)
      Promise.allSettled(
        siguientes
          .filter((f) => idsFilasExitosas.has(f.id))
          .map((f) =>
            axios.patch(
              `${PLANTILLA_API}/${f.id}`,
              {
                fechaini: `${f.fechaini}T00:00:00`,
                fechafin: `${f.fechafin}T00:00:00`,
                concepto: f.concepto,
              },
              { headers: getHeaders() },
            ),
          ),
      );

      // ── Toast resumen ──
      const fallidos = resultados.filter((r) => !r.ok).length;
      const periodoEmitido = PERIODO_CFG[tabActiva]?.label.toLowerCase() ?? tabActiva;
      if (fallidos === 0) {
        showToast(
          `${exitosos.length} comprobante${exitosos.length !== 1 ? "s" : ""} generado${exitosos.length !== 1 ? "s" : ""} (${periodoEmitido})`,
          "success",
        );
      } else {
        showToast(
          `${exitosos.length} OK · ${fallidos} con error — revisa el resultado`,
          exitosos.length > 0 ? "success" : "error",
        );
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { mensaje?: string; message?: string } }; message?: string };
      showToast(
        e?.response?.data?.mensaje ?? e?.response?.data?.message ?? e?.message ?? "Error al generar los comprobantes",
        "error",
      );
    } finally {
      setEmitiendo(false);
      setProgresoEmision(null);
    }
  };

  // ── Return ──
  return {
    // datos
    filas,
    filasDeshabilitadas,
    filasFiltradas,
    gruposFiltrados,
    grupos,
    periodosPresentes,
    stats,
    statsPorPeriodo,
    erroresPorFila,
    // estado UI
    cargandoPlantilla,
    tabActiva,          setTabActiva,
    fechaEmision,       setFechaEmision,
    periodosExpandidos,
    loadingRazonSocialIds,
    emitiendo,
    modalPlantillaOpen,   setModalPlantillaOpen,
    modalResultadoOpen,   setModalResultadoOpen,
    resultadoEmision,
    progresoEmision,
    advertenciaTemprana,
    // acceso
    accessToken,
    esUsuarioVelsat,
    sucursal,
    empresa,
    // acciones
    cargarDesdeApi,
    recuperarDatos,
    cargarExcel,
    descargarPlantilla,
    actualizarFila,
    agregarFila,
    deshabilitarFila,
    habilitarFila,
    ajustarFechasInicioMes,
    emitir,
    togglePeriodo,
  };
}
