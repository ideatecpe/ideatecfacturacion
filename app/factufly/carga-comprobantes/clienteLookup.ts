/**
 * clienteLookup.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Lookup de RUC/DNI con prioridad:
 *   1. API local de clientes  →  trae razonSocial + correo + whatsapp
 *   2. json.pe (fallback)     →  solo razonSocial
 *
 * Los clientes locales se cachean en memoria por RUC de empresa para no
 * repetir la llamada en cada keystroke.
 */

import axios from "axios";
import { consultaDni } from "@/app/components/apiConsultasJsonPe/consultaDni";
import { consultaRuc }  from "@/app/components/apiConsultasJsonPe/consultaRuc";

export type LookupResult = {
  razonSocial: string;
  correo:      string | null;
  whatsapp:    string | null;
  /** true si vino de la base local, false si vino de json.pe */
  fromLocal:   boolean;
};

// ─── Cache en memoria ─────────────────────────────────────────────────────────
type ClienteLocal = {
  numeroDocumento:  string;
  razonSocialNombre: string;
  correo:           string | null;
  telefono:         string | null;
};

const _cache        = new Map<string, ClienteLocal[]>();
const _loadingPromise = new Map<string, Promise<void>>();

async function _cargarLocales(userRuc: string, accessToken: string): Promise<void> {
  if (_cache.has(userRuc)) return;
  try {
    const res = await axios.get<ClienteLocal[]>(
      `${process.env.NEXT_PUBLIC_API_URL}/api/Cliente/ruc/${userRuc}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    _cache.set(userRuc, res.data ?? []);
  } catch {
    _cache.set(userRuc, []); // en error → no bloquear, igual hace fallback a json.pe
  }
}

async function _getLocales(userRuc: string, accessToken: string): Promise<ClienteLocal[]> {
  if (!_cache.has(userRuc)) {
    // Deduplica: si ya hay una petición en curso para este ruc, espera la misma
    if (!_loadingPromise.has(userRuc)) {
      _loadingPromise.set(userRuc, _cargarLocales(userRuc, accessToken));
    }
    await _loadingPromise.get(userRuc);
    _loadingPromise.delete(userRuc);
  }
  return _cache.get(userRuc) ?? [];
}

// ─── Función principal ────────────────────────────────────────────────────────
/**
 * Busca un RUC o DNI.
 * Primero en clientes locales; si no está, consulta json.pe.
 */
export async function buscarDocumento(
  numdoc:      string,
  accessToken: string,
  userRuc:     string,
): Promise<LookupResult> {
  const nd = numdoc.trim();
  if (nd.length !== 8 && nd.length !== 11) {
    return { razonSocial: "", correo: null, whatsapp: null, fromLocal: false };
  }

  // 1️⃣  Buscar en clientes locales
  const locales = await _getLocales(userRuc, accessToken);
  const local   = locales.find((c) => c.numeroDocumento === nd);

  if (local) {
    return {
      razonSocial: local.razonSocialNombre ?? "",
      correo:      local.correo   ?? null,
      whatsapp:    local.telefono ?? null,
      fromLocal:   true,
    };
  }

  // 2️⃣  Fallback: json.pe (solo razonSocial, sin correo/whatsapp)
  try {
    if (nd.length === 11) {
      const ruc = await consultaRuc(nd);
      return { razonSocial: ruc?.razonSocial ?? "", correo: null, whatsapp: null, fromLocal: false };
    } else {
      const dni = await consultaDni(nd);
      return { razonSocial: dni?.nombreCompleto ?? "", correo: null, whatsapp: null, fromLocal: false };
    }
  } catch {
    return { razonSocial: "", correo: null, whatsapp: null, fromLocal: false };
  }
}

/**
 * Invalida el cache de una empresa (útil tras agregar/editar un cliente).
 */
export function invalidarCacheClientes(userRuc: string): void {
  _cache.delete(userRuc);
  _loadingPromise.delete(userRuc);
}
