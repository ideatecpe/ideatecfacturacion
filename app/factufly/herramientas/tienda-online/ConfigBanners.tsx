"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/app/components/ui/Toast";
import { BannerTienda, MAX_BANNERS } from "@/lib/pedidosOnline";

const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 4;

/** Borra una imagen de Cloudflare; si falla no se bloquea nada (queda huérfana). */
export async function borrarImagenBanner(imageId: string) {
  try {
    await fetch("/api/upload-imagen", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId }),
    });
  } catch {
    /* sin red: la imagen queda en Cloudflare, no afecta a la tienda */
  }
}

interface Props {
  banners: BannerTienda[];
  onChange: (banners: BannerTienda[]) => void;
  /** Ids ya guardados: esos se borran de Cloudflare recién al guardar, no al quitarlos. */
  idsGuardados: ReadonlySet<string>;
  disabled: boolean;
}

/**
 * Imágenes del encabezado de la tienda online. Con más de una pasan solas, como un
 * slider; sin ninguna, la tienda muestra su imagen de siempre.
 */
export default function ConfigBanners({ banners, onChange, idsGuardados, disabled }: Props) {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(0);
  // Lo último que hay en la lista mientras se suben varias a la vez.
  const actuales = useRef(banners);
  actuales.current = banners;

  const lleno = banners.length + subiendo >= MAX_BANNERS;

  const subir = async (archivos: File[]) => {
    const libres = MAX_BANNERS - actuales.current.length - subiendo;
    if (archivos.length > libres) showToast(`Puedes poner hasta ${MAX_BANNERS} imágenes.`, "error");
    const validos = archivos.slice(0, Math.max(0, libres)).filter((f) => {
      if (!TIPOS.includes(f.type)) {
        showToast(`"${f.name}": solo se permiten imágenes JPG, PNG o WebP.`, "error");
        return false;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        showToast(`"${f.name}": la imagen no debe superar ${MAX_MB} MB.`, "error");
        return false;
      }
      return true;
    });
    if (validos.length === 0) return;

    setSubiendo((n) => n + validos.length);
    await Promise.all(
      validos.map(async (archivo) => {
        try {
          const fd = new FormData();
          fd.append("file", archivo);
          const res = await fetch("/api/upload-imagen", { method: "POST", body: fd });
          const datos = (await res.json()) as { ok?: boolean; url?: string; imageId?: string; error?: string };
          if (datos.ok && datos.url) {
            // Se actualiza la referencia al instante: otra subida puede terminar antes del próximo render.
            const nuevos = [...actuales.current, { url: datos.url, imageId: datos.imageId ?? null }];
            actuales.current = nuevos;
            onChange(nuevos);
          } else {
            showToast(`No se pudo subir "${archivo.name}".`, "error");
          }
        } catch {
          showToast(`Sin conexión: no se pudo subir "${archivo.name}".`, "error");
        } finally {
          setSubiendo((n) => n - 1);
        }
      }),
    );
  };

  const quitar = (i: number) => {
    const quitado = banners[i];
    onChange(banners.filter((_, j) => j !== i));
    // Recién subida y aún sin guardar: nadie más la usa, se borra ya.
    if (quitado.imageId && !idsGuardados.has(quitado.imageId)) void borrarImagenBanner(quitado.imageId);
  };

  const mover = (i: number, paso: -1 | 1) => {
    const j = i + paso;
    if (j < 0 || j >= banners.length) return;
    const copia = [...banners];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    onChange(copia);
  };

  return (
    <div className="px-4 py-4 bg-white space-y-3">
      <div>
        <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-brand-blue" /> Banner de tu tienda
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          Las imágenes grandes de arriba de tu tienda. Si pones más de una, pasan solas cada pocos segundos. Sin
          imágenes, se muestra la de siempre.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {banners.map((b, i) => (
          <div key={`${b.url}-${i}`} className="group relative aspect-[3/2] rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.url} alt={`Banner ${i + 1}`} className="w-full h-full object-cover" />
            <span className="absolute top-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
              {i + 1}
            </span>
            {!disabled && (
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 p-1.5 bg-gradient-to-t from-black/70 to-transparent">
                <div className="flex gap-1">
                  <BotonImagen titulo="Mover antes" onClick={() => mover(i, -1)} disabled={i === 0}>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </BotonImagen>
                  <BotonImagen titulo="Mover después" onClick={() => mover(i, 1)} disabled={i === banners.length - 1}>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </BotonImagen>
                </div>
                <BotonImagen titulo="Quitar imagen" onClick={() => quitar(i)} peligro>
                  <Trash2 className="w-3.5 h-3.5" />
                </BotonImagen>
              </div>
            )}
          </div>
        ))}

        {Array.from({ length: subiendo }, (_, i) => (
          <div key={`subiendo-${i}`} className="aspect-[3/2] rounded-lg border border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-1.5 text-[11px] text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Subiendo…
          </div>
        ))}

        {!lleno && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className="aspect-[3/2] rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-1.5 text-xs font-semibold text-gray-500 hover:border-brand-blue hover:text-brand-blue disabled:opacity-50 disabled:hover:border-gray-300 disabled:hover:text-gray-500"
          >
            <ImagePlus className="w-5 h-5" />
            Agregar imagen
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={TIPOS.join(",")}
        multiple
        className="hidden"
        onChange={(e) => {
          const archivos = Array.from(e.target.files ?? []);
          e.target.value = "";
          void subir(archivos);
        }}
      />
      <p className="text-[11px] text-gray-400">
        Horizontal, ideal 1200 × 800 px. JPG, PNG o WebP de hasta {MAX_MB} MB. Hasta {MAX_BANNERS} imágenes; con las flechas
        eliges el orden. Los cambios se ven en la tienda al guardar.
      </p>
    </div>
  );
}

function BotonImagen({
  titulo,
  onClick,
  disabled,
  peligro,
  children,
}: {
  titulo: string;
  onClick: () => void;
  disabled?: boolean;
  peligro?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-md bg-white/90 shadow disabled:opacity-40 ${
        peligro ? "text-rose-600 hover:bg-rose-50" : "text-gray-700 hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}
