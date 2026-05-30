"use client";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Printer,
  ShieldCheck,
  ChevronLeft,
  Truck,
  FileText,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { formatoFechaActual, fechaLocalISO } from "@/app/components/ui/formatoFecha";
import { Card } from "@/app/components/ui/Card";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState, Suspense } from "react";
import { useToast } from "@/app/components/ui/Toast";
import ModalPuntoDireccion, {
  DireccionSeleccionada,
} from "@/app/components/guia/ModalPuntoDireccion";
import ModalConductor, {
  ConductorData,
} from "@/app/components/guia/ModalConductor";
import ModalVehiculo, {
  VehiculoData,
} from "@/app/components/guia/ModalVehiculo";
import ModalTransportistaPublico, {
  TransportistaPublicoData,
} from "@/app/components/guia/ModalTransportistaPublico";
import ModalDocumentoRelacionado, {
  DocumentoRelacionado,
  DetalleComprobante,
} from "@/app/components/guia/ModalDocumentoRelacionado";
import ModalBienGuia, { BienGuia } from "@/app/components/guia/Modalbienguia";
import { useSearchParams } from "next/navigation";
import { consultaRuc } from "@/app/components/apiConsultasJsonPe/consultaRuc";
import { consultaDni } from "@/app/components/apiConsultasJsonPe/consultaDni";


// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoGuia = "remitente" | "transportista";
type ModalidadTraslado = "01" | "02";

interface SucursalData {
  serieGuiaRemision: string;
  correlativoGuiaRemision: number;
  serieGuiaTransportista: string;
  correlativoGuiaTransportista: number;
}

interface DireccionCliente {
  direccionId: number;
  direccionLineal: string;
  ubigeo: string;
  departamento: string;
  provincia: string;
  distrito: string;
  tipoDireccion: string;
}

interface Cliente {
  clienteId: number;
  razonSocialNombre: string;
  numeroDocumento: string;
  tipoDocumento: { tipoDocumentoId: string; tipoDocumentoNombre: string };
  direccion: DireccionCliente[];
  telefono?: string;
  correo?: string;
}
// ─── Constantes ───────────────────────────────────────────────────────────────
const MOTIVOS_TRASLADO = [
  { codigo: "01", label: "Venta" },
  { codigo: "02", label: "Compra" },
  { codigo: "14", label: "Venta con entrega a terceros" },
  {
    codigo: "03",
    label: "Traslado entre establecimientos de la misma empresa",
  },
  { codigo: "04", label: "Consignación" },
  { codigo: "05", label: "Devolución" },
  { codigo: "10", label: "Recojo de bienes transformados" },
  { codigo: "08", label: "Importación" },
  { codigo: "09", label: "Exportación" },
  { codigo: "11", label: "Venta sujeta a confirmación del comprador" },
  { codigo: "12", label: "Traslado de bienes para transformación" },
  { codigo: "06", label: "Traslado emisor itinerante de comprobantes de pago" },
  { codigo: "13", label: "Otros" },
];

const inputClass =
  "w-full py-2 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all";
const selectClass =
  "w-full py-2 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue";
const labelClass = "text-[10px] font-bold text-gray-600 uppercase";

// ─── Componente ───────────────────────────────────────────────────────────────

function GuiaRemisionContent() {
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const { showToast } = useToast();

  // — Estado: tipo de guía
  const [tipoGuia, setTipoGuia] = useState<TipoGuia>("remitente");

  // — Estado: datos de la sucursal (series y correlativos)
  const [sucursal, setSucursal] = useState<SucursalData | null>(null);
  const [loadingSucursal, setLoadingSucursal] = useState(true);
  const [errorSucursal, setErrorSucursal] = useState<string | null>(null);

  // — Estado: campos del formulario
  const [modalidad, setModalidad] = useState<ModalidadTraslado>("01");
  const [motivoCodigo, setMotivoCodigo] = useState("01");
  const [motivoOtros, setMotivoOtros] = useState("");

  const [destinatarioQuery, setDestinatarioQuery] = useState("");
  const [destinatarioResultados, setDestinatarioResultados] = useState<
    Cliente[]
  >([]);
  const [destinatarioSeleccionado, setDestinatarioSeleccionado] =
    useState<Cliente | null>(null);
  const [loadingDestinatario, setLoadingDestinatario] = useState(false);
  const [destinatarioSunatResultado, setDestinatarioSunatResultado] =
    useState<Cliente | null>(null);
  const [destinatarioSunatHint, setDestinatarioSunatHint] = useState<{
    text: string;
    color: string;
  } | null>(null);
  const [loadingSunat, setLoadingSunat] = useState(false);

  const [modalGuardarCliente, setModalGuardarCliente] = useState(false);
  const [clienteNuevoTelefono, setClienteNuevoTelefono] = useState("");
  const [clienteNuevoCorreo, setClienteNuevoCorreo] = useState("");
  const [guardandoCliente, setGuardandoCliente] = useState(false);

  const [modalPartida, setModalPartida] = useState(false);
  const [modalLlegada, setModalLlegada] = useState(false);
  const [puntoPartida, setPuntoPartida] =
    useState<DireccionSeleccionada | null>(null);
  const [puntoLlegada, setPuntoLlegada] =
    useState<DireccionSeleccionada | null>(null);
  const [observaciones, setObservaciones] = useState("");
  const [documentosRelacionados, setDocumentosRelacionados] = useState<
    DocumentoRelacionado[]
  >([]);
  const [modalDocumento, setModalDocumento] = useState(false);
  const [avisoSpotVisible, setAvisoSpotVisible] = useState(true);
  // Bienes precargados desde comprobante — se usará en la tabla de productos
  const [bienesPreCargados, setBienesPreCargados] = useState<
    DetalleComprobante[]
  >([]);
  const [bienes, setBienes] = useState<BienGuia[]>([]);
  const [modalBien, setModalBien] = useState(false);

  // Transporte privado
  const [transbordo, setTransbordo] = useState(false);
  const [vehiculoM1L, setVehiculoM1L] = useState(false);
  const [vehiculos, setVehiculos] = useState<VehiculoData[]>([]);
  const [conductores, setConductores] = useState<ConductorData[]>([]);
  const [modalVehiculo, setModalVehiculo] = useState(false);
  const [modalConductor, setModalConductor] = useState(false);

  // Transporte público
  const [transportistaPublico, setTransportistaPublico] =
    useState<TransportistaPublicoData | null>(null);
  const [modalTransportistaPublico, setModalTransportistaPublico] =
    useState(false);

  const [emitiendo, setEmitiendo] = useState(false);
  const [errorEmision, setErrorEmision] = useState<string | null>(null);
  const [guiaEmitida, setGuiaEmitida] = useState<any>(null);

  const [refreshSucursal, setRefreshSucursal] = useState(0);
  const [guiaEmitidaId, setGuiaEmitidaId] = useState<number | null>(null);
  const [telefonoEnvio, setTelefonoEnvio] = useState("");
  const [correoEnvio, setCorreoEnvio] = useState("");
  const [errorWhatsApp, setErrorWhatsApp] = useState("");
  const [errorCorreo, setErrorCorreo] = useState("");

  // — Estados nuevos para superadmin
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [sucursalSeleccionadaId, setSucursalSeleccionadaId] = useState<
    number | null
  >(null);

  const [errorGuardarCliente, setErrorGuardarCliente] = useState<string | null>(
    null,
  );

  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [envioExitoso, setEnvioExitoso] = useState(false);
  const [enviarWhatsapp, setEnviarWhatsapp] = useState(false);
  const [enviarCorreo, setEnviarCorreo] = useState(false);
  const searchParams = useSearchParams();
  const editarGuiaId = searchParams.get("editarGuiaId");
  const [placaM1L, setPlacaM1L] = useState("");
  const [fechaTraslado, setFechaTraslado] = useState(
    formatoFechaActual().fecha,
  );

  const isSuperAdmin = user?.rol === "superadmin";

  const resetFormulario = () => {
    // Tipo y serie
    setTipoGuia("remitente");

    // Formulario
    setModalidad("01");
    setMotivoCodigo("01");
    setMotivoOtros("");

    // Destinatario
    setDestinatarioQuery("");
    setDestinatarioResultados([]);
    setDestinatarioSeleccionado(null);
    setDestinatarioSunatResultado(null);
    setDestinatarioSunatHint(null);

    // Puntos
    setPuntoPartida(null);
    setPuntoLlegada(null);

    // Transporte
    setTransbordo(false);
    setVehiculoM1L(false);
    setVehiculos([]);
    setConductores([]);
    setTransportistaPublico(null);

    // Documentos y bienes
    setDocumentosRelacionados([]);
    setBienesPreCargados([]);
    setBienes([]);

    // Observaciones y avisos
    setObservaciones("");
    setAvisoSpotVisible(true);

    // Errores
    setErrorEmision(null);
    setGuiaEmitida(null);

    // Recargar sucursal para obtener nuevo correlativo
    setLoadingSucursal(true);
    setSucursal(null);
    setRefreshSucursal((prev) => prev + 1);
    setPlacaM1L("");
    setFechaTraslado(formatoFechaActual().fecha);
  };

  useEffect(() => {
    if (!editarGuiaId || !accessToken) return;
    const cargarParaEditar = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/guias/detalle/${editarGuiaId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!res.ok) return;
        const g = await res.json();

        // Tipo de guía
        setTipoGuia(g.tipoDoc === "09" ? "remitente" : "transportista");

        // Motivo y modalidad
        setMotivoCodigo(g.codTraslado ?? "01");
        setModalidad(g.modTraslado === "02" ? "02" : "01");

        // Puntos
        if (g.partidaDireccion)
          setPuntoPartida({
            ubigeo: g.partidaUbigeo ?? "",
            direccionLineal: g.partidaDireccion,
            departamento: g.partidaDepartamento ?? "",
            provincia: g.partidaProvincia ?? "",
            distrito: g.partidaDistrito ?? "",
            resumen: g.partidaDireccion,
            tipo: "otra",
            tipoDireccion: "OTRA DIRECCIÓN",
          });

        if (g.llegadaDireccion)
          setPuntoLlegada({
            ubigeo: g.llegadaUbigeo ?? "",
            direccionLineal: g.llegadaDireccion,
            departamento: g.llegadaDepartamento ?? "",
            provincia: g.llegadaProvincia ?? "",
            distrito: g.llegadaDistrito ?? "",
            resumen: g.llegadaDireccion,
            tipo: "otra",
            tipoDireccion: "OTRA DIRECCIÓN",
          });

        // Destinatario
        if (g.destinatarioNumDoc)
          setDestinatarioSeleccionado({
            clienteId: 0,
            razonSocialNombre: g.destinatarioRznSocial ?? "",
            numeroDocumento: g.destinatarioNumDoc,
            tipoDocumento: {
              tipoDocumentoId: g.destinatarioTipoDoc === "6" ? "06" : "01",
              tipoDocumentoNombre:
                g.destinatarioTipoDoc === "6" ? "RUC" : "DNI",
            },
            direccion: [],
          });

        // Observaciones
        setObservaciones(g.observacion ?? "");

        // Transportista público
        if (g.modTraslado === "01" && g.transportistaNumDoc) {
          setTransportistaPublico({
            ruc: g.transportistaNumDoc,
            razonSocial: g.transportistaRznSocial ?? "",
            registroMTC: g.transportistaRegistroMTC ?? "",
            entidadAutorizacion: g.autorizacionVehiculoEntidad ?? "",
            numeroAutorizacion: g.autorizacionVehiculoNumero ?? "",
          });
        }

        // Vehículos
        const placas = [
          g.transportistaPlaca,
          g.placaSecundaria1,
          g.placaSecundaria2,
          g.placaSecundaria3,
        ].filter(Boolean) as string[];
        if (placas.length > 0) {
          setVehiculos(
            placas.map((p) => ({
              placa: p,
              entidadAutorizacion: "",
              numeroAutorizacion: "",
            })),
          );
        }

        // Conductor principal
        if (g.choferDoc) {
          setConductores([
            {
              tipoDocumento: g.choferTipoDoc ?? "1",
              numeroDocumento: g.choferDoc,
              nombres: g.choferNombres ?? "",
              apellidos: g.choferApellidos ?? "",
              licencia: g.choferLicencia ?? "",
            },
            ...(g.choferSecundarioDoc
              ? [
                  {
                    tipoDocumento: g.choferSecundarioTipoDoc ?? "1",
                    numeroDocumento: g.choferSecundarioDoc,
                    nombres: g.choferSecundarioNombres ?? "",
                    apellidos: g.choferSecundarioApellidos ?? "",
                    licencia: g.choferSecundarioLicencia ?? "",
                  },
                ]
              : []),
            ...(g.choferSecundario2Doc
              ? [
                  {
                    tipoDocumento: g.choferSecundario2TipoDoc ?? "1",
                    numeroDocumento: g.choferSecundario2Doc,
                    nombres: g.choferSecundario2Nombres ?? "",
                    apellidos: g.choferSecundario2Apellidos ?? "",
                    licencia: g.choferSecundario2Licencia ?? "",
                  },
                ]
              : []),
          ]);
        }

        // M1/L
        setVehiculoM1L(g.indVehiculoM1L ?? false);

        setVehiculoM1L(g.indVehiculoM1L ?? false);
        if (g.indVehiculoM1L && g.transportistaPlaca) {
          setPlacaM1L(g.transportistaPlaca);
        }

        // Transbordo
        setTransbordo(g.indTransbordo ?? false);

        // Documentos relacionados
        if (g.relDocNroDoc) {
          setDocumentosRelacionados([
            {
              tipoDocumento: g.relDocTipoDoc ?? "01",
              tipoDocumentoLabel:
                g.relDocTipoDoc === "01"
                  ? "Factura"
                  : g.relDocTipoDoc === "03"
                    ? "Boleta de Venta"
                    : (g.relDocTipoDoc ?? ""),
              numeroCompleto: g.relDocNroDoc,
              numero: g.relDocNroDoc, // ← faltaba
              detalles: [],
            },
          ]);
        }
        // Bienes
        if (g.details?.length > 0) {
          setBienes(
            g.details.map((d: any) => ({
              productoId: d.detalleId,
              codigo: d.codigo ?? "",
              descripcion: d.descripcion,
              cantidad: d.cantidad,
              unidadMedida: d.unidad,
              pesoKg: 0,
            })),
          );
        }
      } catch (err) {
        console.error("Error cargando guía para editar:", err);
      }
    };
    cargarParaEditar();
  }, [editarGuiaId, accessToken]);

  // ── API 1: Cargar sucursal(es) ─────────────────────────────────────────────
  useEffect(() => {
    if (!accessToken || !user?.ruc) return;

    const fetchSucursal = async () => {
      setLoadingSucursal(true);
      setErrorSucursal(null);
      try {
        if (isSuperAdmin) {
          // Superadmin: trae todas las sucursales por RUC
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal?ruc=${user.ruc}`,
            {
              headers: {
                accept: "*/*",
                Authorization: `Bearer ${accessToken}`,
              },
            },
          );
          if (!res.ok) throw new Error(`Error ${res.status}`);
          const data = await res.json(); // array
          setSucursales(data);
          // Precarga la primera sucursal
          if (data.length > 0) {
            setSucursalSeleccionadaId(data[0].sucursalId);
            setSucursal({
              serieGuiaRemision: data[0].serieGuiaRemision,
              correlativoGuiaRemision: data[0].correlativoGuiaRemision,
              serieGuiaTransportista: data[0].serieGuiaTransportista,
              correlativoGuiaTransportista:
                data[0].correlativoGuiaTransportista,
            });
          }
        } else {
          // Rol normal: trae su sucursal directamente
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/Sucursal/${user.sucursalID}`,
            {
              headers: {
                accept: "*/*",
                Authorization: `Bearer ${accessToken}`,
              },
            },
          );
          if (!res.ok) throw new Error(`Error ${res.status}`);
          const data = await res.json();
          setSucursal({
            serieGuiaRemision: data.serieGuiaRemision,
            correlativoGuiaRemision: data.correlativoGuiaRemision,
            serieGuiaTransportista: data.serieGuiaTransportista,
            correlativoGuiaTransportista: data.correlativoGuiaTransportista,
          });
        }
      } catch (err: any) {
        setErrorSucursal("No se pudo cargar la serie. Intenta recargar.");
        console.error("Error fetching sucursal:", err);
      } finally {
        setLoadingSucursal(false);
      }
    };

    fetchSucursal();
  }, [user?.sucursalID, user?.ruc, accessToken, isSuperAdmin, refreshSucursal]);

  // ── API 2: Buscar destinatario (cliente) ──────────────────────────────────
  useEffect(() => {
    if (
      !destinatarioQuery ||
      destinatarioQuery.length < 2 ||
      !user?.ruc ||
      !accessToken
    ) {
      setDestinatarioResultados([]);
      return;
    }

    const delay = setTimeout(async () => {
      setLoadingDestinatario(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/Cliente/search/${user.ruc}?q=${encodeURIComponent(destinatarioQuery)}`,
          {
            headers: { accept: "*/*", Authorization: `Bearer ${accessToken}` },
          },
        );
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data: Cliente[] = await res.json();
        setDestinatarioResultados(data);
      } catch (err) {
        console.error("Error buscando cliente:", err);
        setDestinatarioResultados([]);
      } finally {
        setLoadingDestinatario(false);
      }
    }, 350); // debounce 350ms

    return () => clearTimeout(delay);
  }, [destinatarioQuery, user?.ruc, accessToken]);

  useEffect(() => {
    if (!destinatarioSeleccionado) return;
    if (destinatarioSeleccionado.telefono) {
      setTelefonoEnvio(destinatarioSeleccionado.telefono);
    } else {
      setTelefonoEnvio("");
    }
    if (destinatarioSeleccionado.correo) {
      setCorreoEnvio(destinatarioSeleccionado.correo);
    } else {
      setCorreoEnvio("");
    }
    // checkboxes siempre inician desmarcados
    setEnviarWhatsapp(false);
    setEnviarCorreo(false);
    setErrorWhatsApp("");
    setErrorCorreo("");
  }, [destinatarioSeleccionado]);

  useEffect(() => {
    if (bienesPreCargados.length === 0) return;
    const nuevos: BienGuia[] = bienesPreCargados.map((b) => ({
      productoId: b.productoId,
      codigo: b.codigo,
      descripcion: b.descripcion,
      cantidad: b.cantidad,
      unidadMedida: b.unidadMedida,
      pesoKg: 0,
    }));
    setBienes((prev) => {
      // Evitar duplicados por productoId
      const ids = new Set(prev.map((b) => b.productoId));
      return [...prev, ...nuevos.filter((b) => !ids.has(b.productoId))];
    });
  }, [bienesPreCargados]);

  // — Derivados según tipo de guía seleccionado
  const serieActual =
    tipoGuia === "remitente"
      ? sucursal?.serieGuiaRemision
      : sucursal?.serieGuiaTransportista;

  const correlativoActual =
    tipoGuia === "remitente"
      ? sucursal?.correlativoGuiaRemision
      : sucursal?.correlativoGuiaTransportista;

  const correlativoFormateado = correlativoActual
    ? String(correlativoActual).padStart(7, "0")
    : "-------";

  // handleDestinatarioSunat actualizado
  const handleDestinatarioSunat = async (val: string) => {
    setDestinatarioSunatResultado(null);

    if (val.length === 8) {
      // Consulta DNI
      setLoadingSunat(true);
      setDestinatarioSunatHint({
        text: "Consultando DNI...",
        color: "#185FA5",
      });
      try {
        const data = await consultaDni(val);
        if (data) {
          setDestinatarioSunatResultado({
            clienteId: 0,
            razonSocialNombre: data.nombreCompleto,
            numeroDocumento: val,
            tipoDocumento: {
              tipoDocumentoId: "01",
              tipoDocumentoNombre: "DNI",
            },
            direccion: [],
          });
          setDestinatarioSunatHint({
            text: `✓ ${data.nombreCompleto}`,
            color: "#15803d",
          });
        } else {
          setDestinatarioSunatHint({
            text: "DNI no encontrado",
            color: "#DC2626",
          });
        }
      } catch {
        setDestinatarioSunatHint({
          text: "Error al consultar DNI",
          color: "#DC2626",
        });
      } finally {
        setLoadingSunat(false);
      }
    } else if (val.length === 11) {
      // Consulta RUC
      setLoadingSunat(true);
      setDestinatarioSunatHint({
        text: "Consultando RUC...",
        color: "#185FA5",
      });
      try {
        const data = await consultaRuc(val);
        if (data) {
          setDestinatarioSunatResultado({
            clienteId: 0,
            razonSocialNombre: data.razonSocial,
            numeroDocumento: val,
            tipoDocumento: {
              tipoDocumentoId: "06",
              tipoDocumentoNombre: "RUC",
            },
            direccion: data.direccionLineal
              ? [
                  {
                    direccionId: 0,
                    direccionLineal: data.direccionLineal,
                    ubigeo: data.ubigeo ?? "",
                    departamento: data.departamento ?? "",
                    provincia: data.provincia ?? "",
                    distrito: data.distrito ?? "",
                    tipoDireccion: "fiscal",
                  },
                ]
              : [],
          });
          setDestinatarioSunatHint({
            text: `✓ ${data.razonSocial}`,
            color: "#15803d",
          });
        } else {
          setDestinatarioSunatHint({
            text: "RUC no encontrado",
            color: "#DC2626",
          });
        }
      } catch {
        setDestinatarioSunatHint({
          text: "Error al consultar RUC",
          color: "#DC2626",
        });
      } finally {
        setLoadingSunat(false);
      }
    } else if (val.length > 0) {
      setDestinatarioSunatHint({
        text: `${val.length}/8 DNI · ${val.length}/11 RUC`,
        color: "#B45309",
      });
    } else {
      setDestinatarioSunatHint(null);
    }
  };

  const handleGuardarClienteNuevo = async () => {
    if (!destinatarioSeleccionado || !accessToken) return;
    setGuardandoCliente(true);
    setErrorGuardarCliente(null);
    try {
      const sucursalID = isSuperAdmin
        ? sucursalSeleccionadaId
        : Number(user?.sucursalID);

      const body = {
        sucursalID,
        numeroDocumento: destinatarioSeleccionado.numeroDocumento,
        razonSocialNombre: destinatarioSeleccionado.razonSocialNombre,
        nombreComercial: "",
        telefono: clienteNuevoTelefono,
        correo: clienteNuevoCorreo,
        tipoDocumentoId: destinatarioSeleccionado.tipoDocumento.tipoDocumentoId,
        direccion: destinatarioSeleccionado.direccion[0]
          ? {
              ubigeo: destinatarioSeleccionado.direccion[0].ubigeo,
              direccionLineal:
                destinatarioSeleccionado.direccion[0].direccionLineal,
              departamento: destinatarioSeleccionado.direccion[0].departamento,
              provincia: destinatarioSeleccionado.direccion[0].provincia,
              distrito: destinatarioSeleccionado.direccion[0].distrito,
              tipoDireccion: "fiscal",
            }
          : {
              ubigeo: "",
              direccionLineal: "",
              departamento: "",
              provincia: "",
              distrito: "",
              tipoDireccion: "fiscal",
            },
      };

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/Cliente`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(body),
        },
      );

      if (res.status === 409) {
        setErrorGuardarCliente("Este cliente ya está registrado.");
        return;
      }

      if (!res.ok) {
        setErrorGuardarCliente(
          "Ocurrió un error al guardar. Intenta de nuevo.",
        );
        return;
      }

      // Éxito — cerrar modal y limpiar
      setModalGuardarCliente(false);
      setClienteNuevoTelefono("");
      setClienteNuevoCorreo("");
      setErrorGuardarCliente(null);
      showToast("Cliente guardado correctamente.", "success");
      if (clienteNuevoTelefono) setTelefonoEnvio(clienteNuevoTelefono);
      if (clienteNuevoCorreo) setCorreoEnvio(clienteNuevoCorreo);
    } catch (err) {
      console.error("Error guardando cliente:", err);
      setErrorGuardarCliente("Error de conexión. Verifica tu red.");
    } finally {
      setGuardandoCliente(false);
    }
  };

  const mapearTipoDocSunat = (tipoDocumentoId: string): string => {
    const mapa: Record<string, string> = {
      "01": "1", // DNI
      "06": "6", // RUC
      "04": "4", // Carnet de extranjería
      "07": "7", // Pasaporte
      "00": "0", // Sin documento
    };
    return mapa[tipoDocumentoId] ?? tipoDocumentoId;
  };

  const handleNuevaGuia = () => {
    setGuiaEmitidaId(null);
    setTelefonoEnvio("");
    setCorreoEnvio("");
    setErrorEnvio(null);
    setErrorWhatsApp("");
    setErrorCorreo("");
    setEnvioExitoso(false);
    resetFormulario();
  };

  const handleEmitir = async () => {
    // ── Validaciones básicas ───────────────────────────────────────────
    if (!destinatarioSeleccionado) {
      setErrorEmision("Debes seleccionar un destinatario.");
      return;
    }
    if (bienes.length === 0) {
      setErrorEmision("Debes agregar al menos un bien.");
      return;
    }
    if (!puntoPartida) {
      setErrorEmision("Debes agregar el punto de partida.");
      return;
    }
    if (!puntoLlegada) {
      setErrorEmision("Debes agregar el punto de llegada.");
      return;
    }
    if (modalidad === "01" && !transportistaPublico && !vehiculoM1L) {
      setErrorEmision("Debes agregar el transportista.");
      return;
    }
    if (modalidad === "02" && !vehiculoM1L && vehiculos.length === 0) {
      setErrorEmision("Debes agregar al menos un vehículo.");
      return;
    }

    setErrorEmision(null);
    setEmitiendo(true);

    try {
      // ── Datos de la empresa ────────────────────────────────────────────
      const resEmpresa = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/companies/${user?.ruc}`,
        { headers: { accept: "*/*", Authorization: `Bearer ${accessToken}` } },
      );
      const empresa = await resEmpresa.json();

      // ── Conductor principal (transporte privado) ───────────────────────
      const conductorPrincipal = conductores[0] ?? null;
      const conductorSecundario = conductores[1] ?? null;
      const conductorSecundario2 = conductores[2] ?? null;

      // ── Documento relacionado (primer doc si existe) ───────────────────
      const docRel = documentosRelacionados[0] ?? null;

      // ── Peso total ─────────────────────────────────────────────────────
      const pesoTotal = bienes.reduce((acc, b) => acc + b.pesoKg, 0);

      // ── Validación peso ────────────────────────────────────────────────────
      if (pesoTotal === 0) {
        setErrorEmision("El peso bruto total debe ser mayor a 0 kg.");
        return;
      }

      // ── Placa M1/L ─────────────────────────────────────────────────────
      const placaM1LFinal = vehiculoM1L ? placaM1L : null;

      // ── Payload ────────────────────────────────────────────────────────
      const payload = {
        sucursalId: isSuperAdmin
          ? sucursalSeleccionadaId
          : Number(user?.sucursalID),
        version: 1,
        tipoDoc: tipoGuia === "remitente" ? "09" : "31",
        serie: serieActual ?? "",
        correlativo: String(correlativoActual ?? ""),
        fechaEmision: formatoFechaActual().fechaHora,

        company: {
          ruc: empresa.ruc,
          razonSocial: empresa.razonSocial,
          nombreComercial: empresa.nombreComercial ?? "",
          address: {
            ubigueo: empresa.ubigeo ?? "",
            direccion: empresa.direccion ?? "",
            provincia: empresa.provincia ?? "",
            departamento: empresa.departamento ?? "",
            distrito: empresa.distrito ?? "",
          },
        },

        destinatario: {
          tipoDoc: mapearTipoDocSunat(
            destinatarioSeleccionado.tipoDocumento.tipoDocumentoId,
          ),
          numDoc: destinatarioSeleccionado.numeroDocumento,
          rznSocial: destinatarioSeleccionado.razonSocialNombre,
        },

        // Tercero: en guía transportista es el remitente original
        tercero:
          tipoGuia === "transportista"
            ? {
                tipoDoc: "6",
                numDoc: empresa.ruc,
                rznSocial: empresa.razonSocial,
              }
            : null,

        observacion: observaciones || null,

        relDoc: docRel
          ? {
              tipoDoc: docRel.tipoDocumento,
              nroDoc: docRel.numeroCompleto,
            }
          : null,

        docBaja: null,

        envio: {
          codTraslado: motivoCodigo,
          desTraslado:
            MOTIVOS_TRASLADO.find((m) => m.codigo === motivoCodigo)?.label ??
            "",
          modTraslado: modalidad,
          fecTraslado: `${fechaTraslado}T00:00:00`,
          codPuerto: null,
          indTransbordo: transbordo,
          pesoTotal,
          undPesoTotal: "KGM",
          numContenedor: null,
          matPeligrosoClase: null,
          matPeligrosoNroONU: null,

          llegada: {
            ubigueo: puntoLlegada.ubigeo,
            direccion: puntoLlegada.direccionLineal,
            provincia: puntoLlegada.provincia,
            departamento: puntoLlegada.departamento,
            distrito: puntoLlegada.distrito,
          },

          partida: {
            ubigueo: puntoPartida.ubigeo,
            direccion: puntoPartida.direccionLineal,
            provincia: puntoPartida.provincia,
            departamento: puntoPartida.departamento,
            distrito: puntoPartida.distrito,
          },

          transportista: vehiculoM1L
            ? {
                // M1/L: solo placa, sin conductor
                tipoDoc: "",
                numDoc: "",
                rznSocial: "",
                indVehiculoM1L: vehiculoM1L,
                placa: placaM1LFinal?.replace(/-/g, "") ?? null,
                placaSecundaria1: null,
                placaSecundaria2: null,
                placaSecundaria3: null,
                choferTipoDoc: null,
                choferDoc: null,
                choferNombres: null,
                choferApellidos: null,
                choferLicencia: null,
                choferSecundarioTipoDoc: null,
                choferSecundarioDoc: null,
                choferSecundarioNombres: null,
                choferSecundarioApellidos: null,
                choferSecundarioLicencia: null,
                choferSecundario2TipoDoc: null,
                choferSecundario2Doc: null,
                choferSecundario2Nombres: null,
                choferSecundario2Apellidos: null,
                choferSecundario2Licencia: null,
              }
            : modalidad === "01"
              ? {
                  // Transporte público
                  tipoDoc: "6",
                  numDoc: transportistaPublico?.ruc ?? "",
                  rznSocial: transportistaPublico?.razonSocial ?? "",
                  registroMTC: transportistaPublico?.registroMTC ?? null,
                  placa: vehiculos[0]?.placa?.replace(/-/g, "") ?? null,
                  autorizacionVehiculoEntidad:
                    transportistaPublico?.entidadAutorizacion ?? null,
                  autorizacionVehiculoNumero:
                    transportistaPublico?.numeroAutorizacion ?? null,
                  placaSecundaria1:
                    vehiculos[1]?.placa?.replace(/-/g, "") ?? null,
                  placaSecundaria2:
                    vehiculos[2]?.placa?.replace(/-/g, "") ?? null,
                  placaSecundaria3:
                    vehiculos[3]?.placa?.replace(/-/g, "") ?? null,
                  choferTipoDoc: null,
                  choferDoc: null,
                  choferNombres: null,
                  choferApellidos: null,
                  choferLicencia: null,
                  choferSecundarioTipoDoc: null,
                  choferSecundarioDoc: null,
                  choferSecundarioNombres: null,
                  choferSecundarioApellidos: null,
                  choferSecundarioLicencia: null,
                  choferSecundario2TipoDoc: null,
                  choferSecundario2Doc: null,
                  choferSecundario2Nombres: null,
                  choferSecundario2Apellidos: null,
                  choferSecundario2Licencia: null,
                }
              : {
                  // Transporte privado
                  tipoDoc: null,
                  numDoc: null,
                  rznSocial: null,
                  placa: vehiculos[0]?.placa?.replace(/-/g, "") ?? null,
                  autorizacionVehiculoEntidad:
                    vehiculos[0]?.entidadAutorizacion ?? null,
                  autorizacionVehiculoNumero:
                    vehiculos[0]?.numeroAutorizacion ?? null,
                  placaSecundaria1:
                    vehiculos[1]?.placa?.replace(/-/g, "") ?? null,
                  placaSecundaria2:
                    vehiculos[2]?.placa?.replace(/-/g, "") ?? null,
                  placaSecundaria3:
                    vehiculos[3]?.placa?.replace(/-/g, "") ?? null,
                  choferTipoDoc: mapearTipoDocSunat(
                    conductorPrincipal?.tipoDocumento ?? "1",
                  ),
                  choferDoc: conductorPrincipal?.numeroDocumento ?? null,
                  choferNombres: conductorPrincipal?.nombres ?? null,
                  choferApellidos: conductorPrincipal?.apellidos ?? null,
                  choferLicencia: conductorPrincipal?.licencia ?? null,
                  choferSecundarioTipoDoc: conductorSecundario
                    ? mapearTipoDocSunat(conductorSecundario.tipoDocumento)
                    : null,
                  choferSecundarioDoc:
                    conductorSecundario?.numeroDocumento ?? null,
                  choferSecundarioNombres: conductorSecundario?.nombres ?? null,
                  choferSecundarioApellidos:
                    conductorSecundario?.apellidos ?? null,
                  choferSecundarioLicencia:
                    conductorSecundario?.licencia ?? null,
                  choferSecundario2TipoDoc: conductorSecundario2
                    ? mapearTipoDocSunat(conductorSecundario2.tipoDocumento)
                    : null,
                  choferSecundario2Doc:
                    conductorSecundario2?.numeroDocumento ?? null,
                  choferSecundario2Nombres:
                    conductorSecundario2?.nombres ?? null,
                  choferSecundario2Apellidos:
                    conductorSecundario2?.apellidos ?? null,
                  choferSecundario2Licencia:
                    conductorSecundario2?.licencia ?? null,
                },
        },

        details: bienes.map((b) => ({
          cantidad: b.cantidad,
          unidad: b.unidadMedida,
          descripcion: b.descripcion,
          codigo: b.codigo || "",
        })),
        clienteCorreo:
          enviarCorreo && correoEnvio.trim() ? correoEnvio.trim() : null,
        enviadoPorCorreo: enviarCorreo,
        clienteWhatsapp:
          enviarWhatsapp && telefonoEnvio.trim() ? telefonoEnvio.trim() : null,
        enviadoPorWhatsapp: enviarWhatsapp,
        usuarioCreacion: user?.id ?? 0,
      };

      // ── POST /api/guias — crear en DB ──────────────────────────────────
      const resCrear = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/guias`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (!resCrear.ok) {
        const err = await resCrear.json();
        setErrorEmision(err?.message ?? err?.title ?? JSON.stringify(err));
        return;
      }

      const guiaCreada = await resCrear.json();

      // ── POST /api/guias/{id}/send — enviar a SUNAT ─────────────────────
      const resEnviar = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/guias/${guiaCreada.guiaId}/send`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      const guiaEnviada = await resEnviar.json();
      setGuiaEmitida(guiaEnviada);
      if (guiaEnviada.estadoSunat === "ACEPTADO") {
        showToast(
          `✓ Guía ${guiaEnviada.numeroCompleto} aceptada por SUNAT`,
          "success",
        );
        setGuiaEmitidaId(guiaEnviada.guiaId);
      } else {
        showToast(
          `Guía ${guiaEnviada.numeroCompleto} — ${guiaEnviada.estadoSunat}`,
          "info",
        );
      }

      // — Envío automático por canales marcados
      const hayWhatsapp = enviarWhatsapp && telefonoEnvio.trim();
      const hayCorreo = enviarCorreo && correoEnvio.trim();

      if (hayWhatsapp || hayCorreo) {
        try {
          // reutiliza handleEnviar pero con el id recién creado
          await handleEnviarConId(guiaEnviada.guiaId, guiaEnviada);

          if (hayWhatsapp && hayCorreo) {
            showToast("Guía enviada por WhatsApp y correo", "success");
          } else if (hayWhatsapp) {
            showToast("Guía enviada por WhatsApp", "success");
          } else {
            showToast("Guía enviada por correo", "success");
          }
        } catch {
          showToast("Guía emitida, pero hubo un error al enviar", "info");
        }
      }
    } catch (err) {
      console.error("Error emitiendo guía:", err);
      setErrorEmision("Error de conexión. Verifica tu red.");
    } finally {
      setEmitiendo(false);
    }
  };

  const handleEnviarConId = async (idGuia: number, guiaData: any) => {
    const resPdf = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/guias/${idGuia}/pdf`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!resPdf.ok) throw new Error("No se pudo obtener el PDF");
    const pdfBlob = await resPdf.blob();
    const pdfFile = new File(
      [pdfBlob],
      `${guiaData?.numeroCompleto ?? idGuia}.pdf`,
      { type: "application/pdf" },
    );

    if (enviarCorreo && correoEnvio.trim()) {
      const correos = correoEnvio
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (correos.length > 0) {
        const guiaJsonStr = JSON.stringify({
          serieNumero: guiaData?.numeroCompleto ?? "",
          estadoSunat: guiaData?.estadoSunat ?? "EMITIDO",
          motivoTraslado: guiaData?.desTraslado ?? "",
          fechaTraslado: guiaData?.fecTraslado
            ? new Date(guiaData.fecTraslado).toLocaleDateString("es-PE")
            : "",
          direccionPartida: guiaData?.partidaDireccion ?? "",
          direccionLlegada: guiaData?.llegadaDireccion ?? "",
          bienes:
            guiaData?.details?.map((b: any) => ({
              descripcion: b.descripcion,
              cantidad: b.cantidad,
              unidad: b.unidad,
            })) ?? [],
        });

        const resultadosCorreo = await Promise.allSettled(
          correos.map((correo) => {
            const formData = new FormData();
            formData.append("toEmail", correo);
            formData.append(
              "toName",
              destinatarioSeleccionado?.razonSocialNombre ?? "",
            );
            formData.append(
              "subject",
              `Guía de Remisión ${guiaData?.numeroCompleto ?? ""}`,
            );
            formData.append(
              "body",
              "Se emitió la guía de remisión para el traslado de los bienes indicados.",
            );
            formData.append("tipo", "9");
            formData.append("guiaJson", guiaJsonStr);
            formData.append("adjunto", pdfFile);

            return fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/email/send`, {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}` },
              body: formData,
            }).then((res) => {
              if (!res.ok) throw new Error(`Error al enviar a ${correo}`);
            });
          }),
        );

        const fallidos = resultadosCorreo.filter(
          (r) => r.status === "rejected",
        );
        if (fallidos.length === correos.length)
          throw new Error("Error al enviar el correo");
      }
    }

    if (enviarWhatsapp && telefonoEnvio.trim()) {
      const telefonos = telefonoEnvio
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (telefonos.length > 0) {
        const whatsappApiKey = process.env.NEXT_PUBLIC_WHATSAPP_API_KEY!;
        const whatsappBase = "https://do.velsat.pe:8443/whatsapp";

        // ── Verificar estado de conexión WhatsApp ──────────────────────
        const resEstado = await fetch(`${whatsappBase}/api/status`, {
          headers: {
            "x-api-key": whatsappApiKey,
            "Content-Type": "application/json",
          },
        });
        if (!resEstado.ok)
          throw new Error("No se pudo verificar el estado de WhatsApp");

        const estadoData = await resEstado.json();
        if (!estadoData.exito || estadoData.datos?.estado !== "conectado") {
          throw new Error(
            estadoData.datos?.mensaje ?? "WhatsApp no está conectado",
          );
        }

        // ── Subir PDF ──────────────────────────────────────────────────
        const uploadForm = new FormData();
        uploadForm.append("file", pdfFile);
        const resUpload = await fetch(`${whatsappBase}/api/upload`, {
          method: "POST",
          headers: { "x-api-key": whatsappApiKey },
          body: uploadForm,
        });
        if (!resUpload.ok)
          throw new Error("No se pudo subir el PDF a WhatsApp");
        const uploadData = await resUpload.json();
        const fileUrl = uploadData.datos.url;

        // ── Enviar mensajes ─────────────────────────────────────────────
        const resultadosWsp = await Promise.allSettled(
          telefonos.map((num) => {
            const numeroFormateado = num.startsWith("51") ? num : `51${num}`;
            return fetch(`${whatsappBase}/api/send/single`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": whatsappApiKey,
              },
              body: JSON.stringify({
                phone: numeroFormateado,
                type: "documento",
                file_url: fileUrl,
                filename: `${guiaData?.numeroCompleto ?? idGuia}.pdf`,
                mime_type: "application/pdf",
                text: `Estimado(a) ${destinatarioSeleccionado?.razonSocialNombre ?? ""}, adjuntamos la guía de remisión electrónica ${guiaData?.numeroCompleto ?? ""}.`,
              }),
            }).then((res) => {
              if (!res.ok) throw new Error(`Error al enviar a ${num}`);
            });
          }),
        );

        const fallidos = resultadosWsp.filter((r) => r.status === "rejected");
        if (fallidos.length === telefonos.length)
          throw new Error("Error al enviar por WhatsApp");
      }
    }
  };

  const handleTelefonoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9,\s]/g, "");
    setTelefonoEnvio(val);
    setEnviarWhatsapp(false);

    if (!val.trim()) {
      setErrorWhatsApp("");
      return;
    }

    const numbers = val
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    let hasError = false;
    for (const num of numbers) {
      if (!/^[9]\d{8}$/.test(num)) {
        setErrorWhatsApp(
          `El número ${num} no es válido. Debe empezar con 9 y tener 9 dígitos.`,
        );
        hasError = true;
        break;
      }
    }
    if (!hasError) setErrorWhatsApp("");
  };

  const handleCorreoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCorreoEnvio(val);
    setEnviarCorreo(false);

    if (!val.trim()) {
      setErrorCorreo("");
      return;
    }

    const emails = val
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    let hasError = false;
    for (const email of emails) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setErrorCorreo(`El correo ${email} no es válido.`);
        hasError = true;
        break;
      }
    }
    if (!hasError) setErrorCorreo("");
  };

  const handleCheckWhatsapp = (checked: boolean) => {
    if (checked) {
      if (!telefonoEnvio.trim()) {
        setErrorWhatsApp("Debes ingresar al menos un número");
        setEnviarWhatsapp(false);
        return;
      }
      if (errorWhatsApp) {
        setEnviarWhatsapp(false);
        return;
      }
      setEnviarWhatsapp(true);
    } else {
      setEnviarWhatsapp(false);
    }
  };

  const handleCheckCorreo = (checked: boolean) => {
    if (checked) {
      if (!correoEnvio.trim()) {
        setErrorCorreo("Debes ingresar al menos un correo");
        setEnviarCorreo(false);
        return;
      }
      if (errorCorreo) {
        setEnviarCorreo(false);
        return;
      }
      setEnviarCorreo(true);
    } else {
      setEnviarCorreo(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4 ">
        <Button
          variant="ghost"
          onClick={() => router.push("/factufly/operaciones")}
          className="h-10 w-10 p-0 rounded-xl bg-gray-200 hover:bg-gray-300"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h3 className="text-xl font-bold text-gray-900">
            Nueva Guía de Remisión
          </h3>
          <p className="text-sm text-gray-500">
            Regresar a selección de comprobante
          </p>
        </div>
      </div>

      {/* ── Selector de tipo de guía ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setTipoGuia("remitente")}
          className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
            tipoGuia === "remitente"
              ? "border-brand-blue bg-brand-blue/5"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <div
            className={`p-2 rounded-lg ${
              tipoGuia === "remitente" ? "bg-brand-blue/10" : "bg-gray-100"
            }`}
          >
            <FileText
              className={`w-5 h-5 ${
                tipoGuia === "remitente" ? "text-brand-blue" : "text-gray-400"
              }`}
            />
          </div>
          <div>
            <p
              className={`text-sm font-bold ${
                tipoGuia === "remitente" ? "text-brand-blue" : "text-gray-700"
              }`}
            >
              Guía Remitente
            </p>
            <p className="text-xs text-gray-400">
              Serie T — Quien envía los bienes
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setTipoGuia("transportista");
            setModalidad("01");
            setVehiculoM1L(false);
            setVehiculos([]);
            setConductores([]);
          }}
          className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
            tipoGuia === "transportista"
              ? "border-brand-blue bg-brand-blue/5"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <div
            className={`p-2 rounded-lg ${
              tipoGuia === "transportista" ? "bg-brand-blue/10" : "bg-gray-100"
            }`}
          >
            <Truck
              className={`w-5 h-5 ${
                tipoGuia === "transportista"
                  ? "text-brand-blue"
                  : "text-gray-400"
              }`}
            />
          </div>
          <div>
            <p
              className={`text-sm font-bold ${
                tipoGuia === "transportista"
                  ? "text-brand-blue"
                  : "text-gray-700"
              }`}
            >
              Guía Transportista
            </p>
            <p className="text-xs text-gray-400">
              Serie V — Empresa transportista
            </p>
          </div>
        </button>
      </div>

      {/* ── Cuerpo principal ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card
            title="Datos del Traslado"
            subtitle="Completa la información requerida"
          >
            <form className="space-y-6">
              {/* Serie y número */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Select de sucursal — solo superadmin */}
                {isSuperAdmin && sucursales.length > 0 && (
                  <div className="space-y-1.5">
                    <label className={labelClass}>Sucursal</label>
                    <select
                      className={selectClass}
                      value={sucursalSeleccionadaId ?? ""}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        setSucursalSeleccionadaId(id);
                        const found = sucursales.find(
                          (s) => s.sucursalId === id,
                        );
                        if (found) {
                          setSucursal({
                            serieGuiaRemision: found.serieGuiaRemision,
                            correlativoGuiaRemision:
                              found.correlativoGuiaRemision,
                            serieGuiaTransportista:
                              found.serieGuiaTransportista,
                            correlativoGuiaTransportista:
                              found.correlativoGuiaTransportista,
                          });
                        }
                      }}
                    >
                      {sucursales.map((s) => (
                        <option key={s.sucursalId} value={s.sucursalId}>
                          {s.nombre} — {s.codEstablecimiento}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Serie y correlativo — siempre visible */}
                <div className="space-y-1.5">
                  <label className={labelClass}>Serie y Número</label>
                  <div className="flex gap-2">
                    <div
                      className={`w-1/3 py-2 px-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 font-mono text-sm flex items-center ${
                        loadingSucursal ? "animate-pulse" : ""
                      }`}
                    >
                      {loadingSucursal ? "..." : (serieActual ?? "—")}
                    </div>
                    <input
                      type="text"
                      disabled
                      value={
                        loadingSucursal ? "Cargando..." : correlativoFormateado
                      }
                      className="w-2/3 py-2 bg-gray-100 border border-gray-200 rounded-xl px-4 text-gray-500 font-mono"
                    />
                  </div>
                  {errorSucursal && (
                    <p className="text-xs text-red-500 mt-1">{errorSucursal}</p>
                  )}
                </div>

                {/* Fecha de traslado — fuera del grid, label dinámico según modalidad */}
                <div className="space-y-1.5">
                  <label className={labelClass}>
                    {modalidad === "01"
                      ? "Fecha de entrega al transportista"
                      : "Fecha de inicio de traslado"}
                  </label>
                  <input
                    type="date"
                    value={fechaTraslado}
                    onChange={(e) => setFechaTraslado(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Motivo + Modalidad */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelClass}>Motivo de Traslado</label>
                  <select
                    className={selectClass}
                    value={motivoCodigo}
                    onChange={(e) => setMotivoCodigo(e.target.value)}
                  >
                    {MOTIVOS_TRASLADO.map((m) => (
                      <option key={m.codigo} value={m.codigo}>
                        {m.codigo} - {m.label}
                      </option>
                    ))}
                  </select>
                  {/* Campo adicional solo cuando motivo = 13 (Otros) */}
                  {motivoCodigo === "13" && (
                    <input
                      type="text"
                      placeholder="Describa el motivo..."
                      maxLength={200}
                      className={`${inputClass} mt-2`}
                      value={motivoOtros}
                      onChange={(e) => setMotivoOtros(e.target.value)}
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className={labelClass}>Modalidad de Traslado</label>
                  <select
                    className={selectClass}
                    value={modalidad}
                    onChange={(e) => {
                      const nuevaModalidad = e.target
                        .value as ModalidadTraslado;
                      setModalidad(nuevaModalidad);
                      if (nuevaModalidad === "01") {
                        setVehiculoM1L(false);
                        setVehiculos([]);
                        setConductores([]);
                      }
                    }}
                  >
                    <option value="01">01 - Transporte público</option>
                    {/* Transporte privado solo para guía remitente */}
                    {tipoGuia === "remitente" && (
                      <option value="02">02 - Transporte privado</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Puntos de partida y llegada */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Partida */}
                <div className="space-y-1.5">
                  <label className={labelClass}>Punto de Partida</label>
                  {puntoPartida ? (
                    <div className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded-xl">
                      <p className="text-xs text-gray-700 leading-relaxed">
                        {puntoPartida.resumen}
                      </p>
                      <button
                        type="button"
                        onClick={() => setPuntoPartida(null)}
                        className="text-xs text-gray-400 hover:text-red-500 ml-3 shrink-0"
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setModalPartida(true)}
                      className="w-full py-2 px-4 text-sm text-gray-400 bg-gray-50 border border-dashed border-gray-300 rounded-xl hover:border-brand-blue hover:text-brand-blue transition-colors text-left"
                    >
                      + Agregar punto de partida
                    </button>
                  )}
                </div>

                {/* Llegada */}
                <div className="space-y-1.5">
                  <label className={labelClass}>Punto de Llegada</label>
                  {puntoLlegada ? (
                    <div className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded-xl">
                      <p className="text-xs text-gray-700 leading-relaxed">
                        {puntoLlegada.resumen}
                      </p>
                      <button
                        type="button"
                        onClick={() => setPuntoLlegada(null)}
                        className="text-xs text-gray-400 hover:text-red-500 ml-3 shrink-0"
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setModalLlegada(true)}
                      className="w-full py-2 px-4 text-sm text-gray-400 bg-gray-50 border border-dashed border-gray-300 rounded-xl hover:border-brand-blue hover:text-brand-blue transition-colors text-left"
                    >
                      + Agregar punto de llegada
                    </button>
                  )}
                </div>
              </div>

              {/* Checkboxes globales de transporte */}
              <div className="space-y-2">
                {/* Transbordo solo para guía remitente */}
                {tipoGuia === "remitente" && (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={transbordo}
                      onChange={(e) => setTransbordo(e.target.checked)}
                      className="accent-brand-blue w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">
                      Realiza transbordo programado
                    </span>
                  </label>
                )}

                {/* M1/L solo para transporte privado en guía remitente */}
                {tipoGuia === "remitente" && modalidad === "02" && (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={vehiculoM1L}
                      onChange={(e) => {
                        setVehiculoM1L(e.target.checked);
                        setVehiculos([]);
                        setConductores([]);
                        setTransportistaPublico(null);
                      }}
                      className="accent-brand-blue w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">
                      Traslado en vehículos de categoría M1 o L
                    </span>
                  </label>
                )}
              </div>

              {/* ── Sección Transporte ───────────────────────────────────── */}
              {vehiculoM1L ? (
                /* — M1/L: solo placa, sin importar modalidad — */
                <div className="space-y-1.5">
                  <label className={labelClass}>Número de placa</label>
                  <input
                    type="text"
                    placeholder="Ej. ABC-123"
                    value={placaM1L}
                    onChange={(e) => setPlacaM1L(e.target.value.toUpperCase())}
                    className={inputClass}
                  />
                  <p className="text-xs text-gray-400 pl-1">
                    Vehículo ligero (auto, SUV, moto) — no requiere datos de
                    conductor ni autorización MTC.
                  </p>
                </div>
              ) : modalidad === "02" ? (
                /* — TRANSPORTE PRIVADO — */
                <div className="space-y-4">
                  {/* Vehículos */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-500 uppercase">
                        Datos de vehículos
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 text-xs text-brand-blue"
                        onClick={() => setModalVehiculo(true)}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Agregar
                      </Button>
                    </div>
                    {vehiculos.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">
                        Sin vehículos agregados.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {vehiculos.map((v, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded-xl"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {v.placa}
                              </p>
                              {v.entidadAutorizacion && (
                                <p className="text-xs text-gray-500">
                                  Aut. especial: {v.entidadAutorizacion}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setVehiculos(
                                  vehiculos.filter((_, j) => j !== i),
                                )
                              }
                              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                            >
                              Quitar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Conductores */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-500 uppercase">
                        Datos de conductores
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 text-xs text-brand-blue"
                        onClick={() => setModalConductor(true)}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Agregar
                      </Button>
                    </div>
                    {conductores.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">
                        Sin conductores agregados.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {conductores.map((c, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded-xl"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {c.apellidos} {c.nombres}
                              </p>
                              <p className="text-xs text-gray-500">
                                Licencia: {c.licencia} · DNI:{" "}
                                {c.numeroDocumento}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setConductores(
                                  conductores.filter((_, j) => j !== i),
                                )
                              }
                              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                            >
                              Quitar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* — TRANSPORTE PÚBLICO — */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-500 uppercase">
                      Transportista
                    </p>
                    {!transportistaPublico && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 text-xs text-brand-blue"
                        onClick={() => setModalTransportistaPublico(true)}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Agregar
                      </Button>
                    )}
                  </div>
                  {transportistaPublico ? (
                    <div className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {transportistaPublico.razonSocial}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          RUC: {transportistaPublico.ruc}
                          {transportistaPublico.registroMTC && (
                            <> · MTC: {transportistaPublico.registroMTC}</>
                          )}
                        </p>
                        {/* Autorización especial */}
                        {transportistaPublico.entidadAutorizacion && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Aut. especial:{" "}
                            {transportistaPublico.entidadAutorizacion}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setTransportistaPublico(null)}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-4"
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">
                      Sin transportista agregado.
                    </p>
                  )}
                </div>
              )}

              {/* Destinatario */}
              <div className="space-y-1.5">
                <label className={labelClass}>Destinatario (RUC/DNI)</label>

                {destinatarioSeleccionado ? (
                  /* — Estado: cliente seleccionado — */
                  <div className="flex items-center justify-between px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {destinatarioSeleccionado.razonSocialNombre}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {
                          destinatarioSeleccionado.tipoDocumento
                            .tipoDocumentoNombre
                        }
                        : {destinatarioSeleccionado.numeroDocumento}
                        {destinatarioSeleccionado.direccion[0] && (
                          <>
                            {" "}
                            ·{" "}
                            {
                              destinatarioSeleccionado.direccion[0]
                                .direccionLineal
                            }
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4 shrink-0">
                      {/* Botón guardar — solo si vino de apisperu */}
                      {destinatarioSeleccionado.clienteId === 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setModalGuardarCliente(true);
                            setErrorGuardarCliente(null); // 👈
                          }}
                          className="text-xs text-brand-blue hover:underline transition-colors"
                        >
                          Guardar en sistema
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setDestinatarioSeleccionado(null);
                          setDestinatarioQuery("");
                          setDestinatarioSunatResultado(null);
                          setDestinatarioSunatHint(null);
                        }}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        Cambiar
                      </button>
                    </div>
                  </div>
                ) : (
                  /* — Búsqueda — */
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Buscar por nombre, RUC o DNI..."
                        value={destinatarioQuery}
                        onChange={(e) => {
                          setDestinatarioQuery(e.target.value);
                          // Limpiar resultado SUNAT previo al volver a escribir
                          setDestinatarioSunatResultado(null);
                          setDestinatarioSunatHint(null);
                        }}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all"
                      />
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />

                      {/* Dropdown resultados DB */}
                      {(destinatarioResultados.length > 0 ||
                        loadingDestinatario) && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                          {loadingDestinatario ? (
                            <div className="px-4 py-3 text-sm text-gray-400">
                              Buscando...
                            </div>
                          ) : (
                            destinatarioResultados.map((cliente) => (
                              <button
                                key={cliente.clienteId}
                                type="button"
                                onClick={() => {
                                  setDestinatarioSeleccionado(cliente);
                                  setDestinatarioQuery("");
                                  setDestinatarioResultados([]);
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                              >
                                <p className="text-sm font-medium text-gray-800">
                                  {cliente.razonSocialNombre}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {cliente.tipoDocumento.tipoDocumentoNombre}:{" "}
                                  {cliente.numeroDocumento}
                                </p>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Botón SUNAT — aparece solo si buscó y no encontró nada en DB */}
                    {destinatarioQuery.length >= 2 &&
                      !loadingDestinatario &&
                      destinatarioResultados.length === 0 && (
                        <button
                          type="button"
                          disabled={loadingSunat}
                          onClick={() =>
                            handleDestinatarioSunat(
                              destinatarioQuery.replace(/\D/g, ""),
                            )
                          }
                          className="w-full py-2 px-4 text-sm text-brand-blue border border-dashed border-brand-blue/40 rounded-xl hover:bg-brand-blue/5 transition-colors disabled:opacity-50"
                        >
                          {loadingSunat
                            ? "Consultando SUNAT..."
                            : `No registrado — Buscar "${destinatarioQuery}" en SUNAT`}
                        </button>
                      )}

                    {/* Resultado SUNAT encontrado */}
                    {destinatarioSunatResultado && (
                      <button
                        type="button"
                        onClick={() => {
                          setDestinatarioSeleccionado(
                            destinatarioSunatResultado,
                          );
                          setDestinatarioSunatResultado(null);
                          setDestinatarioSunatHint(null);
                          setDestinatarioQuery("");
                        }}
                        className="w-full text-left px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
                      >
                        <p className="text-sm font-medium text-gray-800">
                          {destinatarioSunatResultado.razonSocialNombre}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {
                            destinatarioSunatResultado.tipoDocumento
                              .tipoDocumentoNombre
                          }
                          : {destinatarioSunatResultado.numeroDocumento}
                        </p>
                        <p className="text-xs text-brand-blue mt-1">
                          Toca para seleccionar →
                        </p>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Contacto para envío */}
              {destinatarioSeleccionado && (
                <div className="space-y-3">
                  <label className={labelClass}>Enviar guía a</label>

                  {/* WhatsApp */}
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="chk-whatsapp"
                      checked={enviarWhatsapp}
                      onChange={(e) => handleCheckWhatsapp(e.target.checked)}
                      className="accent-brand-blue w-4 h-4 shrink-0 mt-2"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="relative">
                        <input
                          type="tel"
                          placeholder="Ej. 987654321, 912345678"
                          value={telefonoEnvio}
                          onChange={handleTelefonoChange}
                          className={`${inputClass} text-xs py-2 ${errorWhatsApp ? "border-red-500 focus:ring-red-200" : ""}`}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                          WhatsApp
                        </span>
                      </div>
                      {errorWhatsApp && (
                        <p className="text-xs text-red-500">{errorWhatsApp}</p>
                      )}
                    </div>
                  </div>

                  {/* Correo */}
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="chk-correo"
                      checked={enviarCorreo}
                      onChange={(e) => handleCheckCorreo(e.target.checked)}
                      className="accent-brand-blue w-4 h-4 shrink-0 mt-2"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="relative">
                        <input
                          type="email"
                          placeholder="Ej. uno@correo.com, dos@correo.com"
                          value={correoEnvio}
                          onChange={handleCorreoChange}
                          className={`${inputClass} text-xs py-2 ${errorCorreo ? "border-red-500 focus:ring-red-200" : ""}`}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                          Email
                        </span>
                      </div>
                      {errorCorreo && (
                        <p className="text-xs text-red-500">{errorCorreo}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Documentos relacionados */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>
                    Documentos relacionados
                    <span className="text-gray-400 normal-case font-normal ml-1">
                      (opcional)
                    </span>
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 text-xs text-brand-blue"
                    onClick={() => setModalDocumento(true)}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Agregar
                  </Button>
                </div>

                {/* Aviso SPOT/IVAP */}
                {avisoSpotVisible && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                    <p className="text-sm text-amber-800 leading-relaxed">
                      Le recordamos que si va a trasladar bienes afectos al{" "}
                      <strong>SPOT</strong> o al <strong>IVAP</strong> se debe
                      consignar los números de las Constancias de Depósito
                      respectivas en esta sección.
                    </p>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setAvisoSpotVisible(false)}
                        className="px-4 py-1.5 text-xs font-medium text-amber-800 bg-amber-100 border border-amber-300 rounded-lg hover:bg-amber-200 transition-colors"
                      >
                        Entendido
                      </button>
                    </div>
                  </div>
                )}

                {/* Lista de documentos agregados */}
                {documentosRelacionados.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">
                    Sin documentos relacionados.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {documentosRelacionados.map((doc, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded-xl"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {doc.numeroCompleto}
                          </p>
                          <p className="text-xs text-gray-500">
                            {doc.tipoDocumentoLabel}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 ml-4 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setDocumentosRelacionados(
                                documentosRelacionados.filter(
                                  (_, j) => j !== i,
                                ),
                              );
                              setBienesPreCargados([]);
                              setBienes([]);
                            }}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bienes a trasladar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>Bienes a Trasladar</label>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 text-xs text-brand-blue"
                    onClick={() => setModalBien(true)}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Agregar bien
                  </Button>
                </div>
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">
                          Código
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">
                          Descripción
                        </th>
                        <th className="px-4 py-2 text-center font-medium text-gray-500">
                          Cant.
                        </th>
                        <th className="px-4 py-2 text-center font-medium text-gray-500">
                          Unidad
                        </th>
                        <th className="px-4 py-2 text-right font-medium text-gray-500">
                          Peso (kg)
                        </th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {bienes.length === 0 ? (
                        <tr className="text-gray-400 italic">
                          <td className="px-4 py-4 text-center" colSpan={6}>
                            Agrega bienes usando el botón superior
                          </td>
                        </tr>
                      ) : (
                        bienes.map((b, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-xs text-gray-500">
                              {b.codigo || "—"}
                            </td>
                            <td className="px-4 py-3 text-gray-800">
                              {b.descripcion}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700">
                              {b.cantidad}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-500">
                              {b.unidadMedida}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={b.pesoKg}
                                onChange={(e) => {
                                  const nuevos = [...bienes];
                                  nuevos[i].pesoKg = Number(e.target.value);
                                  setBienes(nuevos);
                                }}
                                className="w-20 py-1 px-2 text-right text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-brand-blue"
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setBienes(bienes.filter((_, j) => j !== i))
                                }
                                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                              >
                                Quitar
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer del formulario */}
              <div className="flex justify-end items-end pt-4 border-t border-gray-100">
                <div className="space-y-2 text-right">
                  <div className="flex justify-end gap-8 text-sm text-gray-500">
                    <span>Total bultos:</span>
                    <span className="font-medium text-gray-900">
                      {bienes.reduce((acc, b) => acc + b.cantidad, 0)}
                    </span>
                  </div>
                  <div className="flex justify-end gap-8 text-lg font-bold text-brand-blue">
                    <span>Peso bruto total:</span>
                    <span>
                      {bienes.reduce((acc, b) => acc + b.pesoKg, 0).toFixed(2)}{" "}
                      kg
                    </span>
                  </div>
                </div>
              </div>

              {/* Observaciones */}
              <div className="space-y-1.5">
                <label className={labelClass}>
                  Observaciones{" "}
                  <span className="text-gray-400 normal-case font-normal">
                    (opcional)
                  </span>
                </label>
                <textarea
                  placeholder="Observaciones adicionales sobre el traslado..."
                  rows={3}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="w-full py-2 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all text-sm resize-none"
                />
              </div>
            </form>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card
            title="Vista Previa"
            subtitle="Representación gráfica de la guía"
          >
            {guiaEmitidaId ? (
              /* — PDF generado — */
              <div className="space-y-3">
                <iframe
                  src={`${process.env.NEXT_PUBLIC_API_URL}/api/guias/${guiaEmitidaId}/pdf`}
                  className="w-full rounded-lg border border-gray-200"
                  style={{ height: "420px" }}
                  title="Vista previa guía"
                />
                {/* Botón principal — Descargar PDF */}
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL}/api/guias/${guiaEmitidaId}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                >
                  <Button className="w-full py-3 text-base">
                    Descargar PDF
                  </Button>
                </a>
                {/* Botones secundarios */}
                <div className="space-y-3">
                  <div className="w-full py-3 text-base">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleNuevaGuia}
                    >
                      Nueva Guía
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              /* — Sin emitir aún — */
              <div className="space-y-3">
            <div className="h-68 bg-gray-50 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center p-4 text-center space-y-2">
                  <div className="p-4 rounded-full bg-white shadow-sm">
                    <Printer className="w-8 h-8 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Previsualización del PDF
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Se generará automáticamente al emitir
                    </p>
                  </div>
                </div>
                {errorEmision && (
                  <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm text-red-600">{errorEmision}</p>
                  </div>
                )}
                <Button
                  className="w-full py-3 text-base"
                  disabled={emitiendo}
                  onClick={handleEmitir}
                >
                  {emitiendo ? "Emitiendo..." : "Emitir Guía de Remisión"}
                </Button>
              </div>
            )}
          </Card>

          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-brand-blue shrink-0" />
            <p className="text-xs text-blue-800 leading-relaxed">
              Este comprobante será enviado automáticamente a la{" "}
              <strong>SUNAT</strong> y validado en tiempo real.
            </p>
          </div>
        </div>

        {/* Modales */}
        {modalPartida && (
          <ModalPuntoDireccion
            titulo="Punto de partida"
            mostrarRemitente={true}
            onAgregar={(dir) => setPuntoPartida(dir)}
            onCerrar={() => setModalPartida(false)}
          />
        )}
        {modalLlegada && (
          <ModalPuntoDireccion
            titulo="Punto de llegada"
            mostrarRemitente={false}
            onAgregar={(dir) => setPuntoLlegada(dir)}
            onCerrar={() => setModalLlegada(false)}
          />
        )}

        {/* Modal guardar cliente */}
        {modalGuardarCliente && destinatarioSeleccionado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
              {/* Header */}
              <div>
                <h4 className="text-base font-bold text-gray-900">
                  Guardar en mi sistema
                </h4>
                <p className="text-sm text-gray-500 mt-1">
                  Completa los datos opcionales para registrar este cliente.
                </p>
              </div>

              {/* Datos prellenados (solo lectura) */}
              <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                <p className="text-sm font-medium text-gray-800">
                  {destinatarioSeleccionado.razonSocialNombre}
                </p>
                <p className="text-xs text-gray-500">
                  {destinatarioSeleccionado.tipoDocumento.tipoDocumentoNombre}:{" "}
                  {destinatarioSeleccionado.numeroDocumento}
                </p>
                {destinatarioSeleccionado.direccion[0] && (
                  <p className="text-xs text-gray-500">
                    {destinatarioSeleccionado.direccion[0].direccionLineal}
                  </p>
                )}
              </div>

              {/* Teléfono */}
              <div className="space-y-1.5">
                <label className={labelClass}>
                  Teléfono{" "}
                  <span className="text-gray-400 normal-case font-normal">
                    (opcional)
                  </span>
                </label>
                <input
                  type="tel"
                  placeholder="Ej. 987654321"
                  value={clienteNuevoTelefono}
                  onChange={(e) => setClienteNuevoTelefono(e.target.value)}
                  className={inputClass}
                />
              </div>

              {/* Correo */}
              <div className="space-y-1.5">
                <label className={labelClass}>
                  Correo electrónico{" "}
                  <span className="text-gray-400 normal-case font-normal">
                    (opcional)
                  </span>
                </label>
                <input
                  type="email"
                  placeholder="Ej. contacto@empresa.com"
                  value={clienteNuevoCorreo}
                  onChange={(e) => setClienteNuevoCorreo(e.target.value)}
                  className={inputClass}
                />
              </div>

              {errorGuardarCliente && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-600">{errorGuardarCliente}</p>
                </div>
              )}

              {/* Acciones */}
              <div className="flex gap-3 pt-1">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setModalGuardarCliente(false);
                    setClienteNuevoTelefono("");
                    setClienteNuevoCorreo("");
                    setErrorGuardarCliente(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleGuardarClienteNuevo}
                  disabled={guardandoCliente}
                >
                  {guardandoCliente ? "Guardando..." : "Guardar cliente"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modales de transporte */}
        {modalVehiculo && (
          <ModalVehiculo
            onAgregar={(v) => setVehiculos([...vehiculos, v])}
            onCerrar={() => setModalVehiculo(false)}
          />
        )}
        {modalConductor && (
          <ModalConductor
            onAgregar={(c) => setConductores([...conductores, c])}
            onCerrar={() => setModalConductor(false)}
          />
        )}
        {modalTransportistaPublico && (
          <ModalTransportistaPublico
            onAgregar={(t) => setTransportistaPublico(t)}
            onCerrar={() => setModalTransportistaPublico(false)}
          />
        )}

        {/* Modal documento relacionado */}
        {modalDocumento && (
          <ModalDocumentoRelacionado
            ruc={user?.ruc ?? ""}
            accessToken={accessToken ?? ""}
            userRol={user?.rol ?? ""}
            sucursalID={Number(user?.sucursalID ?? 1)}
            onAgregar={(doc) => {
              setDocumentosRelacionados([...documentosRelacionados, doc]);
              // Precargar bienes si el comprobante tiene detalles
              if (doc.detalles && doc.detalles.length > 0) {
                setBienesPreCargados((prev) => [...prev, ...doc.detalles!]);
              }
            }}
            onCerrar={() => setModalDocumento(false)}
          />
        )}

        {modalBien && (
          <ModalBienGuia
            sucursalID={
              isSuperAdmin
                ? (sucursalSeleccionadaId ?? user?.sucursalID ?? 1)
                : (user?.sucursalID ?? 1)
            }
            accessToken={accessToken ?? ""}
            onAgregar={(b) => setBienes([...bienes, b])}
            onCerrar={() => setModalBien(false)}
          />
        )}
      </div>
    </div>
  );
}

export default function GuiaRemisionPage() {
  return (
    <Suspense fallback={null}>
      <GuiaRemisionContent />
    </Suspense>
  );
}

