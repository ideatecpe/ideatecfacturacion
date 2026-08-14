"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { scanImageData } from "@undecaf/zbar-wasm";
import { CameraOff, X } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Se llama con el código detectado. Tras esto el escáner se cierra solo.
  onDetectado: (codigo: string) => void;
  titulo?: string;
}

// Escáner de código de barras con cámara (celular/web). Usa el detector nativo
// del navegador (BarcodeDetector) cuando existe y cae a ZBar-WASM en el resto
// (iOS Safari / Firefox). Es autocontenido: se abre como overlay y devuelve el
// código por onDetectado.
export default function EscanerCodigoBarras({
  isOpen,
  onClose,
  onDetectado,
  titulo = "Escanear código de barras",
}: Props) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const cerrar = useCallback(() => {
    stopCamera();
    setCameraError(null);
    onClose();
  }, [stopCamera, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    let cerrado = false;
    setCameraError(null);

    const t = setTimeout(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError("Tu navegador no soporta el uso de la cámara.");
          return;
        }

        const stream = await navigator.mediaDevices
          .getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 },
              frameRate: { ideal: 60, min: 30 },
              advanced: [{ focusMode: "continuous" }] as unknown as MediaTrackConstraintSet[],
            },
          })
          .catch(() => navigator.mediaDevices.getUserMedia({ video: true }));

        if (cerrado) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }

        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const detectado = (codigo: string) => {
          const c = codigo.trim();
          if (!c) return;
          stopCamera();
          onDetectado(c);
          onClose();
        };

        // 1. Detector nativo (Chrome/Android/Edge)
        if ("BarcodeDetector" in window) {
          try {
            const BarcodeDetectorClass = (
              window as unknown as {
                BarcodeDetector: new (options?: { formats: string[] }) => {
                  detect: (src: HTMLVideoElement) => Promise<{ rawValue?: string }[]>;
                };
              }
            ).BarcodeDetector;
            const detector = new BarcodeDetectorClass({
              formats: ["ean_13", "code_128", "qr_code", "upc_a", "ean_8", "itf"],
            });
            let scanned = false;
            const loop = async () => {
              if (scanned || !videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
              try {
                if (videoRef.current.readyState >= 2) {
                  const barcodes = await detector.detect(videoRef.current);
                  if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                    scanned = true;
                    detectado(barcodes[0].rawValue);
                    return;
                  }
                }
              } catch {
                // Silencioso por fotograma
              }
              animFrameRef.current = requestAnimationFrame(loop);
            };
            loop();
            return;
          } catch {
            // cae a ZBar
          }
        }

        // 2. ZBar-WASM (iOS Safari / Firefox)
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        let scannedZbar = false;
        const loopZbar = async () => {
          if (scannedZbar || !videoRef.current || videoRef.current.paused || videoRef.current.ended || !ctx) return;
          try {
            if (videoRef.current.readyState >= 2) {
              const vWidth = videoRef.current.videoWidth || 640;
              const vHeight = videoRef.current.videoHeight || 480;
              if (canvas.width !== vWidth || canvas.height !== vHeight) {
                canvas.width = vWidth;
                canvas.height = vHeight;
              }
              ctx.drawImage(videoRef.current, 0, 0, vWidth, vHeight);
              const imgData = ctx.getImageData(0, 0, vWidth, vHeight);
              const symbols = await scanImageData(imgData);
              if (symbols && symbols.length > 0) {
                const decodedText = symbols[0].decode();
                if (decodedText) {
                  scannedZbar = true;
                  detectado(decodedText);
                  return;
                }
              }
            }
          } catch {
            // Silencioso por fotograma
          }
          animFrameRef.current = requestAnimationFrame(loopZbar);
        };
        loopZbar();
      } catch (err: unknown) {
        const errorName = (err as { name?: string })?.name;
        if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
          setCameraError("No se detectó ninguna cámara conectada en este equipo.");
        } else if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
          setCameraError("Permiso de cámara denegado en tu navegador.");
        } else {
          setCameraError("No se pudo acceder a la cámara de este dispositivo.");
        }
      }
    }, 50);

    return () => {
      cerrado = true;
      clearTimeout(t);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-bold text-gray-800">{titulo}</span>
          <button
            type="button"
            onClick={cerrar}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">
          <div className="relative w-full aspect-square mx-auto bg-black rounded-2xl overflow-hidden border border-gray-200 shadow-xl flex items-center justify-center">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
            {cameraError ? (
              <div className="absolute inset-0 z-20 bg-gray-950/95 flex flex-col items-center justify-center text-center p-4 text-white">
                <CameraOff className="w-9 h-9 text-gray-400 mb-2" />
                <p className="text-xs font-semibold text-gray-200">{cameraError}</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  Puedes escribir el código manualmente o usar un lector USB.
                </p>
              </div>
            ) : (
              <div className="pointer-events-none absolute inset-3 border-2 border-white/20 rounded-xl flex items-center justify-center overflow-hidden z-10">
                <div className="w-full h-0.5 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.95)] animate-pulse" />
              </div>
            )}
          </div>
          <p className="text-center text-[11px] text-gray-500 mt-3">
            Apunta la cámara al código de barras del producto.
          </p>
        </div>
      </div>
    </div>
  );
}
