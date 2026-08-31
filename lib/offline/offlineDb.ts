import { openDB, DBSchema, IDBPDatabase } from "idb";
import { ProductoSucursal } from "@/app/factufly/productos/gestioProductos/Producto";
import {
  BoletaCliente,
  BoletaCompany,
  Sucursal,
} from "@/app/factufly/operaciones/boleta/gestionBoletas/Boleta";
import { Configuracion } from "@/hooks/useConfiguracion";

const DB_NAME = "factufly-offline";
const DB_VERSION = 2;

export type EstadoVentaPendiente = "pendiente" | "sincronizando" | "error";

export interface VentaPendienteTicketItem {
  descripcion: string;
  cantidad: number;
  precioVenta: number;
}

// "comprobante": Boleta o Factura, vía GenerarXml + enviar-sunat (numeración SUNAT).
// "notaventa": documento de control interno, vía /api/NotaVenta (sin SUNAT).
export type TipoVentaPendiente = "comprobante" | "notaventa";

export interface VentaPendiente {
  id: string;
  tipo: TipoVentaPendiente;
  createdAt: string;
  /**
   * Usuario que hizo la venta (según su sesión al momento de guardarla offline).
   * La cola es del navegador, no del usuario: si otro cajero entra en la misma
   * PC y hay pendientes ajenos, procesarCola los deja en espera hasta que su
   * dueño vuelva a loguearse, para no imputarlos al turno del que sí está.
   */
  usuarioId: number;
  payload: Record<string, unknown>;
  stockItems: { sucursalProductoId: number; cantidad: number; item?: number }[];
  resumenTicket: {
    clienteNombre: string;
    items: VentaPendienteTicketItem[];
    total: number;
    moneda: string;
    medioPago: string;
  };
  estado: EstadoVentaPendiente;
  intentos: number;
  ultimoError?: string;
}

interface ProductosCacheEntry {
  sucursalId: number;
  productos: ProductoSucursal[];
  updatedAt: string;
}

interface ClienteCacheEntry {
  docKey: string;
  cliente: Partial<BoletaCliente>;
  cachedAt: string;
}

interface ConfigCacheEntry {
  ruc: string;
  config: Configuracion;
  updatedAt: string;
}

interface SucursalCacheEntry {
  sucursalId: number;
  sucursal: Sucursal;
  updatedAt: string;
}

interface EmpresaCacheEntry {
  ruc: string;
  empresa: BoletaCompany;
  updatedAt: string;
}

interface FactuFlyOfflineDB extends DBSchema {
  productos_cache: {
    key: number;
    value: ProductosCacheEntry;
  };
  clientes_cache: {
    key: string;
    value: ClienteCacheEntry;
  };
  ventas_pendientes: {
    key: string;
    value: VentaPendiente;
    indexes: { createdAt: string };
  };
  config_cache: {
    key: string;
    value: ConfigCacheEntry;
  };
  sucursal_cache: {
    key: number;
    value: SucursalCacheEntry;
  };
  empresa_cache: {
    key: string;
    value: EmpresaCacheEntry;
  };
}

let dbPromise: Promise<IDBPDatabase<FactuFlyOfflineDB>> | null = null;

function getDb() {
  if (typeof window === "undefined") {
    throw new Error("offlineDb solo puede usarse en el cliente");
  }
  if (!dbPromise) {
    dbPromise = openDB<FactuFlyOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("productos_cache")) {
          db.createObjectStore("productos_cache", { keyPath: "sucursalId" });
        }
        if (!db.objectStoreNames.contains("clientes_cache")) {
          db.createObjectStore("clientes_cache", { keyPath: "docKey" });
        }
        if (!db.objectStoreNames.contains("ventas_pendientes")) {
          const store = db.createObjectStore("ventas_pendientes", {
            keyPath: "id",
          });
          store.createIndex("createdAt", "createdAt");
        }
        if (!db.objectStoreNames.contains("config_cache")) {
          db.createObjectStore("config_cache", { keyPath: "ruc" });
        }
        if (!db.objectStoreNames.contains("sucursal_cache")) {
          db.createObjectStore("sucursal_cache", { keyPath: "sucursalId" });
        }
        if (!db.objectStoreNames.contains("empresa_cache")) {
          db.createObjectStore("empresa_cache", { keyPath: "ruc" });
        }
      },
    });
  }
  return dbPromise;
}

// ── Productos ────────────────────────────────────────────────
export async function cacheProductos(
  sucursalId: number,
  productos: ProductoSucursal[],
) {
  const db = await getDb();
  await db.put("productos_cache", {
    sucursalId,
    productos,
    updatedAt: new Date().toISOString(),
  });
}

export async function getProductosCache(sucursalId: number) {
  const db = await getDb();
  return db.get("productos_cache", sucursalId);
}

// ── Clientes ─────────────────────────────────────────────────
export function buildDocKey(tipoDocumento: string, numeroDocumento: string) {
  return `${tipoDocumento}-${numeroDocumento}`;
}

export async function cacheCliente(
  tipoDocumento: string,
  numeroDocumento: string,
  cliente: Partial<BoletaCliente>,
) {
  const db = await getDb();
  await db.put("clientes_cache", {
    docKey: buildDocKey(tipoDocumento, numeroDocumento),
    cliente,
    cachedAt: new Date().toISOString(),
  });
}

export async function getClienteCache(
  tipoDocumento: string,
  numeroDocumento: string,
) {
  const db = await getDb();
  return db.get("clientes_cache", buildDocKey(tipoDocumento, numeroDocumento));
}

// ── Configuración ────────────────────────────────────────────
export async function cacheConfig(ruc: string, config: Configuracion) {
  const db = await getDb();
  await db.put("config_cache", { ruc, config, updatedAt: new Date().toISOString() });
}

export async function getConfigCache(ruc: string) {
  const db = await getDb();
  return db.get("config_cache", ruc);
}

// ── Sucursal (serie/correlativo) ─────────────────────────────
export async function cacheSucursal(sucursalId: number, sucursal: Sucursal) {
  const db = await getDb();
  await db.put("sucursal_cache", { sucursalId, sucursal, updatedAt: new Date().toISOString() });
}

export async function getSucursalCache(sucursalId: number) {
  const db = await getDb();
  return db.get("sucursal_cache", sucursalId);
}

// ── Empresa emisora ──────────────────────────────────────────
export async function cacheEmpresa(ruc: string, empresa: BoletaCompany) {
  const db = await getDb();
  await db.put("empresa_cache", { ruc, empresa, updatedAt: new Date().toISOString() });
}

export async function getEmpresaCache(ruc: string) {
  const db = await getDb();
  return db.get("empresa_cache", ruc);
}

// ── Ventas pendientes ────────────────────────────────────────
export async function enqueueVentaPendiente(
  venta: Omit<VentaPendiente, "estado" | "intentos">,
) {
  const db = await getDb();
  const registro: VentaPendiente = {
    ...venta,
    estado: "pendiente",
    intentos: 0,
  };
  await db.put("ventas_pendientes", registro);
  return registro;
}

export async function listVentasPendientes() {
  const db = await getDb();
  return db.getAllFromIndex("ventas_pendientes", "createdAt");
}

export async function updateVentaPendiente(
  id: string,
  cambios: Partial<VentaPendiente>,
) {
  const db = await getDb();
  const actual = await db.get("ventas_pendientes", id);
  if (!actual) return;
  await db.put("ventas_pendientes", { ...actual, ...cambios });
}

export async function deleteVentaPendiente(id: string) {
  const db = await getDb();
  await db.delete("ventas_pendientes", id);
}
