import React, { createContext, useContext, useEffect } from "react";
import { X } from "lucide-react";
import { ESTADOS } from "./logica";

// Contexto con lo que todas las pantallas necesitan: perfil, config y helpers de permisos.
export const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function Boton({ variante = "primario", className = "", chico, ...props }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none";
  const tam = chico ? "px-3 py-1.5 text-sm" : "px-4 py-2.5";
  const v = {
    primario: "bg-campo-700 text-white hover:bg-campo-900",
    secundario: "bg-white border border-stone-300 text-stone-800 hover:bg-stone-50",
    peligro: "bg-red-600 text-white hover:bg-red-700",
    fantasma: "text-stone-700 hover:bg-stone-100",
  }[variante];
  return <button type="button" className={`${base} ${tam} ${v} ${className}`} {...props} />;
}

export function Tarjeta({ className = "", ...props }) {
  return <div className={`bg-white rounded-2xl border border-stone-200 shadow-sm ${className}`} {...props} />;
}

export function Campo({ label, children, ayuda, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-medium text-stone-700 mb-1">{label}</span>
      {children}
      {ayuda && <span className="block text-xs text-stone-500 mt-1">{ayuda}</span>}
    </label>
  );
}
const inputCls = "w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-campo-500";
export const Input = (props) => <input className={inputCls} {...props} />;
export const Select = ({ children, ...props }) => <select className={inputCls} {...props}>{children}</select>;
export const Area = (props) => <textarea rows={3} className={inputCls} {...props} />;

export function Modal({ titulo, onCerrar, children, ancho = "max-w-lg", pie }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCerrar]);
  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/40 no-print" onClick={onCerrar}>
      <div className={`bg-campo-50 w-full ${ancho} max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-lg font-semibold text-stone-900">{titulo}</h2>
          <button onClick={onCerrar} className="p-2 rounded-full hover:bg-stone-200" aria-label="Cerrar"><X size={20} /></button>
        </div>
        <div className="px-5 pb-4 overflow-y-auto space-y-4">{children}</div>
        {pie && <div className="px-5 py-3 border-t border-stone-200 flex gap-2 justify-end safe-bottom">{pie}</div>}
      </div>
    </div>
  );
}

export function BadgeEstado({ estado, children }) {
  const e = ESTADOS[estado] || ESTADOS.sin_datos;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap" style={{ color: e.color, background: e.bg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: e.color }} />
      {children || e.nombre}
    </span>
  );
}

export function Vacio({ icono: I, titulo, texto, accion }) {
  return (
    <div className="text-center py-10 px-4">
      {I && <I className="mx-auto text-stone-400 mb-3" size={40} />}
      <p className="font-semibold text-stone-800">{titulo}</p>
      {texto && <p className="text-sm text-stone-500 mt-1 max-w-sm mx-auto">{texto}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}

export function Encabezado({ titulo, sub, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{titulo}</h1>
        {sub && <p className="text-sm text-stone-500">{sub}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function Dato({ label, valor, sub }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-stone-500">{label}</div>
      <div className="text-xl font-bold text-stone-900">{valor}</div>
      {sub && <div className="text-xs text-stone-500">{sub}</div>}
    </div>
  );
}

export const confirmar = (msg) => window.confirm(msg);
