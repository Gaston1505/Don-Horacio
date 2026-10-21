// Ventas a frigorífico y simulador de negocio. Solo para quien puede ver plata (administrador y
// encargado); las reglas de Firestore también lo restringen.
import React, { useMemo, useState } from "react";
import { Plus, Calculator, Settings2, Trash2, ArrowLeft, Pencil } from "lucide-react";
import { useCol, useDocSub, escribir, fijar, nuevoId, inc } from "../backend";
import { useApp, Tarjeta, Boton, Encabezado, Campo, Input, Select, Area, Vacio, Dato, confirmar } from "../ui";
import { CATEGORIAS, nombreCategoria, fmtNum, fmtFecha, hoy, diasEntre } from "../logica";

const FIRMAS_DEFECTO = ["María del Rosario Arredondo", "Gastón Gibernau"];

// Cómo se calcula cada descuento de la liquidación (tomado de una liquidación real de Campo
// Mercado, venta a frigorífico Las Moras, 09/2026):
//  - "comision": % sobre la comisión (IVA de la comisión)
//  - "dentro": % incluido en el importe bruto. IMEBA, INIA y MEVIR se calculan sobre
//    bruto / (1 + suma de esos %), por eso IMEBA 2% da 1,949% del bruto
//  - "bruto": % sobre el importe bruto
//  - "cabeza": USD por animal (MGAP-TCF, SEP)
//  - "fijo": USD por venta (certificado sanitario)
export const TIPOS_DESCUENTO = {
  comision: { nombre: "% sobre la comisión", pct: true },
  dentro: { nombre: "% incluido en el bruto", pct: true },
  bruto: { nombre: "% sobre el bruto", pct: true },
  cabeza: { nombre: "USD por cabeza", pct: false },
  fijo: { nombre: "USD fijo por venta", pct: false },
};
const IMPUESTOS_DEFECTO = [
  { nombre: "IVA s/comisión", tipo: "comision", valor: 22 },
  { nombre: "IMEBA", tipo: "dentro", valor: 2 },
  { nombre: "INIA", tipo: "dentro", valor: 0.4 },
  { nombre: "MEVIR", tipo: "dentro", valor: 0.2 },
  { nombre: "MGAP - TCF", tipo: "cabeza", valor: 4.8 },
  { nombre: "SEP", tipo: "cabeza", valor: 2 },
  { nombre: "Cert. sanit. 19.355", tipo: "fijo", valor: 5.27 },
];
const CONFIG_DEFECTO = { firmas: FIRMAS_DEFECTO, comisionPct: 1.5, impuestos: IMPUESTOS_DEFECTO, consignatario: "Campo Mercado" };
// Impuestos guardados con el formato anterior ({ nombre, pct }) se toman como % sobre el bruto.
const normalizarImp = (i) => ({ nombre: i.nombre, tipo: i.tipo || "bruto", valor: Number(i.valor ?? i.pct) || 0 });
const etiquetaImp = (i, cabezas) => {
  if (i.tipo === "cabeza") return `${i.nombre} USD ${fmtNum(i.valor, 2)} × ${cabezas}`;
  if (i.tipo === "fijo") return i.nombre;
  return `${i.nombre} ${fmtNum(i.valor, 3)}%`;
};

export function calcularVenta(v) {
  const lineas = (v.lineas || []).map((l) => {
    const kgVivo = Number(l.kgVivo) || 0;
    const rend = Number(l.rendimiento) || 0;
    const kgCarcasa = Number(l.kgCarcasa) || (kgVivo * rend) / 100;
    const bruto = kgCarcasa * (Number(l.precio) || 0);
    return { ...l, kgVivo, kgCarcasa, bruto, cabezas: Number(l.cabezas) || 0 };
  });
  const bruto = lineas.reduce((s, l) => s + l.bruto, 0);
  const comision = Math.round(bruto * (Number(v.comisionPct) || 0)) / 100;
  const cabezas = lineas.reduce((s, l) => s + l.cabezas, 0);
  const lista = (v.impuestos || []).map(normalizarImp);
  const sumaDentro = lista.filter((i) => i.tipo === "dentro").reduce((s, i) => s + i.valor, 0);
  const baseDentro = bruto / (1 + sumaDentro / 100);
  const impuestos = lista.map((i) => {
    const r = (x) => Math.round(x * 100) / 100; // la liquidación redondea cada renglón al centavo
    const monto = i.tipo === "comision" ? r((comision * i.valor) / 100)
      : i.tipo === "dentro" ? r((baseDentro * i.valor) / 100)
      : i.tipo === "bruto" ? r((bruto * i.valor) / 100)
      : i.tipo === "cabeza" ? r(i.valor * cabezas)
      : r(i.valor);
    return { ...i, monto };
  });
  const totalImp = impuestos.reduce((s, i) => s + i.monto, 0);
  const neto = bruto - comision - totalImp;
  const kgVivo = lineas.reduce((s, l) => s + l.kgVivo, 0);
  const kgCarcasa = lineas.reduce((s, l) => s + l.kgCarcasa, 0);
  return {
    lineas, bruto, comision, impuestos, totalImp, neto, cabezas, kgVivo, kgCarcasa,
    porCabeza: cabezas ? neto / cabezas : 0,
    equivPie: kgVivo ? neto / kgVivo : 0,
    rendProm: kgVivo ? (kgCarcasa / kgVivo) * 100 : 0,
  };
}

export default function Ventas() {
  const { puede, param, ir } = useApp();
  const [tab, setTab] = useState("ventas");
  if (!puede("dinero")) return <Tarjeta><Vacio titulo="Sin acceso" texto="Esta sección es solo para el administrador y el encargado." /></Tarjeta>;
  if (param) return <EditorVenta id={param} />;
  return (
    <div>
      <Encabezado titulo="Ventas" sub="Frigorífico: liquidaciones y simulación de negocios">
        <Boton onClick={() => ir("ventas", "nueva")}><Plus size={18} /> Nueva venta</Boton>
      </Encabezado>
      <div className="flex gap-1 mb-4 bg-stone-200/70 p-1 rounded-xl w-fit">
        {[["ventas", "Ventas"], ["simulador", "Simulador"], ["config", "Firmas e impuestos"]].map(([k, n]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${tab === k ? "bg-white shadow" : "text-stone-600"}`}>{n}</button>
        ))}
      </div>
      {tab === "ventas" && <ListaVentas />}
      {tab === "simulador" && <EditorVenta simulacion />}
      {tab === "config" && <ConfigFrigorifico />}
    </div>
  );
}

// Liquidaciones que Gastón pasó para dejar cargadas en el historial. Se cargan con un botón
// (con id fijo, así no se duplican) la primera vez que alguien con acceso a plata abre Ventas.
const LIQUIDACIONES_RECIBIDAS = [
  {
    id: "liq-50327",
    fecha: "2026-09-09", fechaCobro: "2026-10-23", firma: "María del Rosario Arredondo",
    consignatario: "Campo Mercado", frigorifico: "Chiadel SA Frigorífico Las Moras", nroLiquidacion: "50327",
    estado: "cerrada", comisionPct: 1.5, impuestos: IMPUESTOS_DEFECTO, descontado: true, cobrada: false,
    notas: "e-Factura A 17081 · Neg. N° 6320 · Guía consig. D424023 · Tropa 1836 · Cotización 40,216 · Venta a crédito",
    lineas: [
      { id: "l1", categoria: "novillo", cabezas: 18, kgVivo: 11105, rendimiento: 55.34, kgCarcasa: 6145.2, precio: 6.0963, loteId: "" },
      { id: "l2", categoria: "vaca", cabezas: 15, kgVivo: 8475, rendimiento: 53.22, kgCarcasa: 4510.1, precio: 5.82, loteId: "" },
      { id: "l3", categoria: "vaquillona", cabezas: 1, kgVivo: 420, rendimiento: 51.64, kgCarcasa: 216.9, precio: 5.65, loteId: "" },
    ],
  },
];

export function estadoCobro(v) {
  if (v.estado === "simulacion") return { texto: "Simulación", color: "#6B7280" };
  if (v.cobrada) return { texto: "Cobrada", color: "#15803D" };
  if (!v.fechaCobro) return { texto: "Sin fecha de cobro", color: "#6B7280" };
  const d = diasEntre(hoy(), v.fechaCobro);
  if (d < 0) return { texto: `Vencida hace ${-d} d`, color: "#B91C1C" };
  if (d === 0) return { texto: "Se cobra hoy", color: "#B45309" };
  return { texto: `Se cobra en ${d} d (${fmtFecha(v.fechaCobro, false)})`, color: "#B45309" };
}

function ListaVentas() {
  const { ir } = useApp();
  const ventas = useCol("ventas");
  const anios = [...new Set([hoy().slice(0, 4), ...ventas.map((v) => v.fecha.slice(0, 4))])].sort().reverse();
  const [anio, setAnio] = useState(anios[0]);
  const reales = ventas.filter((v) => v.estado !== "simulacion");
  const delAnio = ventas.filter((v) => v.fecha.startsWith(anio)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const calc = delAnio.filter((v) => v.estado !== "simulacion").map(calcularVenta);
  const t = calc.reduce((s, c) => ({ neto: s.neto + c.neto, bruto: s.bruto + c.bruto, desc: s.desc + c.comision + c.totalImp, cab: s.cab + c.cabezas, kgV: s.kgV + c.kgVivo, kgC: s.kgC + c.kgCarcasa }), { neto: 0, bruto: 0, desc: 0, cab: 0, kgV: 0, kgC: 0 });
  const porCobrar = reales.filter((v) => !v.cobrada && v.fechaCobro).sort((a, b) => a.fechaCobro.localeCompare(b.fechaCobro));
  const sinCargar = LIQUIDACIONES_RECIBIDAS.filter((l) => !ventas.some((v) => v.id === l.id || (v.nroLiquidacion && v.nroLiquidacion === l.nroLiquidacion)));
  const cargar = () => escribir(sinCargar.map(({ id, ...data }) => ({ op: "set", col: "ventas", id, data })));
  return (
    <div className="space-y-4">
      {sinCargar.length > 0 && (
        <Tarjeta className="p-4 border-blue-300 bg-blue-50 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-blue-900">
            <b>Liquidaciones recibidas para cargar:</b>{" "}
            {sinCargar.map((l) => `N° ${l.nroLiquidacion} · ${fmtFecha(l.fecha)} · ${l.firma} · ${l.lineas.reduce((s, x) => s + x.cabezas, 0)} cab.`).join(" / ")}
          </div>
          <Boton onClick={cargar}>Cargar en el historial</Boton>
        </Tarjeta>
      )}
      {porCobrar.length > 0 && (
        <Tarjeta className="p-4">
          <h2 className="font-semibold mb-2">Por cobrar</h2>
          {porCobrar.map((v) => {
            const ec = estadoCobro(v);
            return (
              <button key={v.id} onClick={() => ir("ventas", v.id)} className="w-full flex justify-between gap-2 text-sm py-1 text-left">
                <span>{v.firma} · liq. {v.nroLiquidacion || "—"} · {v.frigorifico}</span>
                <span className="text-right"><b>USD {fmtNum(calcularVenta(v).neto, 2)}</b> <span style={{ color: ec.color }}>· {ec.texto}</span></span>
              </button>
            );
          })}
        </Tarjeta>
      )}
      {!ventas.length && !sinCargar.length && <Tarjeta><Vacio icono={Calculator} titulo="Sin ventas cargadas" texto="Cargá cada venta a frigorífico con la firma, las categorías, los kilos, el rendimiento y el precio. La app calcula comisión, impuestos y neto." /></Tarjeta>}
      {ventas.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <select className="border rounded-lg px-2 py-1 text-sm" value={anio} onChange={(e) => setAnio(e.target.value)}>{anios.map((a) => <option key={a}>{a}</option>)}</select>
            <span className="text-sm text-stone-500">{calc.length} venta(s)</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tarjeta className="p-4"><Dato label={`Neto ${anio}`} valor={`USD ${fmtNum(t.neto)}`} sub={`Bruto USD ${fmtNum(t.bruto)} · descuentos USD ${fmtNum(t.desc)}`} /></Tarjeta>
            <Tarjeta className="p-4"><Dato label="Cabezas" valor={fmtNum(t.cab)} sub={t.cab ? `USD ${fmtNum(t.neto / t.cab)} netos por cabeza` : null} /></Tarjeta>
            <Tarjeta className="p-4"><Dato label="Kg carcasa" valor={fmtNum(t.kgC)} sub={t.kgV ? `Rendimiento promedio ${fmtNum((t.kgC / t.kgV) * 100, 2)}%` : null} /></Tarjeta>
            <Tarjeta className="p-4"><Dato label="Precio promedio" valor={t.kgC ? `USD ${fmtNum(t.bruto / t.kgC, 3)}` : "—"} sub={t.kgV ? `por kg carcasa · USD ${fmtNum(t.neto / t.kgV, 3)} neto por kg en pie` : null} /></Tarjeta>
          </div>
          <Tarjeta className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums" style={{ minWidth: 820 }}>
              <thead>
                <tr className="text-left text-stone-500 border-b">
                  <th className="p-3">Fecha / firma</th><th className="p-3">Categorías</th><th className="p-3 text-right">Cab.</th>
                  <th className="p-3 text-right">Kg pie</th><th className="p-3 text-right">Kg carc.</th><th className="p-3 text-right">Rend.</th>
                  <th className="p-3 text-right">USD/kg</th><th className="p-3 text-right">Bruto</th><th className="p-3 text-right">Comisión + imp.</th>
                  <th className="p-3 text-right">Neto</th><th className="p-3">Cobro</th>
                </tr>
              </thead>
              <tbody>
                {delAnio.map((v) => {
                  const c = calcularVenta(v);
                  const ec = estadoCobro(v);
                  return (
                    <tr key={v.id} className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer align-top" onClick={() => ir("ventas", v.id)}>
                      <td className="p-3"><div className="font-semibold">{fmtFecha(v.fecha)}</div><div className="text-xs text-stone-500">{v.firma}{v.nroLiquidacion ? ` · liq. ${v.nroLiquidacion}` : ""}</div><div className="text-xs text-stone-500">{v.frigorifico}</div></td>
                      <td className="p-3 text-xs">{c.lineas.map((l) => <div key={l.id}>{l.cabezas} {nombreCategoria(l.categoria).toLowerCase()} · {fmtNum(l.kgVivo ? (l.kgCarcasa / l.kgVivo) * 100 : 0, 2)}% · USD {fmtNum(l.precio, 4)}</div>)}</td>
                      <td className="p-3 text-right">{c.cabezas}</td>
                      <td className="p-3 text-right">{fmtNum(c.kgVivo)}</td>
                      <td className="p-3 text-right">{fmtNum(c.kgCarcasa, 1)}</td>
                      <td className="p-3 text-right">{fmtNum(c.rendProm, 2)}%</td>
                      <td className="p-3 text-right">{c.kgCarcasa ? fmtNum(c.bruto / c.kgCarcasa, 3) : "—"}</td>
                      <td className="p-3 text-right">{fmtNum(c.bruto, 2)}</td>
                      <td className="p-3 text-right">− {fmtNum(c.comision + c.totalImp, 2)}</td>
                      <td className="p-3 text-right font-bold">{fmtNum(c.neto, 2)}</td>
                      <td className="p-3 text-xs" style={{ color: ec.color }}>{ec.texto}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Tarjeta>
        </>
      )}
    </div>
  );
}

function ConfigFrigorifico() {
  const cfg = useDocSub("configDinero", "frigorifico");
  const datos = { ...CONFIG_DEFECTO, ...(cfg.data || {}) };
  datos.impuestos = datos.impuestos.map(normalizarImp);
  const [d, setD] = useState(null);
  const e = d || datos;
  const setImp = (i, k, v) => setD({ ...e, impuestos: e.impuestos.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
  return (
    <Tarjeta className="p-4 space-y-4 max-w-2xl">
      <div>
        <h2 className="font-semibold mb-2">Firmas (razón social)</h2>
        {e.firmas.map((f, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <Input value={f} onChange={(ev) => setD({ ...e, firmas: e.firmas.map((x, j) => (j === i ? ev.target.value : x)) })} />
            <button className="p-2 text-stone-400 hover:text-red-600" onClick={() => setD({ ...e, firmas: e.firmas.filter((_, j) => j !== i) })}><Trash2 size={16} /></button>
          </div>
        ))}
        <Boton chico variante="secundario" onClick={() => setD({ ...e, firmas: [...e.firmas, ""] })}><Plus size={16} /> Firma</Boton>
      </div>
      <Campo label="Comisión habitual (%)" ayuda="Se puede cambiar en cada venta."><Input type="number" step="0.01" value={e.comisionPct} onChange={(ev) => setD({ ...e, comisionPct: ev.target.value })} /></Campo>
      <div>
        <h2 className="font-semibold mb-1">Impuestos y retenciones fijas</h2>
        <p className="text-xs text-stone-500 mb-2">Porcentaje sobre el importe bruto, tal como figuran en la liquidación del frigorífico.</p>
        {!e.impuestos.length && <p className="text-sm text-stone-500 mb-2">Todavía no hay impuestos cargados.</p>}
        {e.impuestos.map((x, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto_6rem_auto] gap-2 mb-2 items-center">
            <Input value={x.nombre} placeholder="Nombre (ej: IMEBA)" onChange={(ev) => setImp(i, "nombre", ev.target.value)} />
            <select className="rounded-xl border border-stone-300 bg-white px-2 py-2.5 text-sm" value={x.tipo} onChange={(ev) => setImp(i, "tipo", ev.target.value)}>
              {Object.entries(TIPOS_DESCUENTO).map(([k, t]) => <option key={k} value={k}>{t.nombre}</option>)}
            </select>
            <Input type="number" step="0.001" value={x.valor} placeholder={TIPOS_DESCUENTO[x.tipo]?.pct ? "%" : "USD"} onChange={(ev) => setImp(i, "valor", ev.target.value)} />
            <button className="p-2 text-stone-400 hover:text-red-600" onClick={() => setD({ ...e, impuestos: e.impuestos.filter((_, j) => j !== i) })}><Trash2 size={16} /></button>
          </div>
        ))}
        <Boton chico variante="secundario" onClick={() => setD({ ...e, impuestos: [...e.impuestos, { nombre: "", tipo: "bruto", valor: "" }] })}><Plus size={16} /> Impuesto</Boton>
      </div>
      <Campo label="Consignatario habitual"><Input value={e.consignatario || ""} onChange={(ev) => setD({ ...e, consignatario: ev.target.value })} /></Campo>
      {d && <Boton onClick={() => { fijar("configDinero", "frigorifico", { firmas: d.firmas.filter(Boolean), comisionPct: Number(d.comisionPct) || 0, consignatario: d.consignatario || "", impuestos: d.impuestos.filter((x) => x.nombre).map((x) => ({ nombre: x.nombre, tipo: x.tipo, valor: Number(x.valor) || 0 })) }); setD(null); }}>Guardar</Boton>}
      <p className="text-xs text-stone-500">Cargado según la liquidación de Campo Mercado del 09/09/2026: comisión 1,5% + IVA 22% sobre la comisión; IMEBA 2%, INIA 0,4% y MEVIR 0,2% incluidos en el bruto; MGAP-TCF USD 4,80 y SEP USD 2 por cabeza; certificado sanitario USD 5,27.</p>
    </Tarjeta>
  );
}

function lineaVacia() { return { id: nuevoId("ventas"), categoria: "novillo", cabezas: "", kgVivo: "", rendimiento: "", kgCarcasa: "", precio: "", loteId: "" }; }

function EditorVenta({ id, simulacion }) {
  const { ir } = useApp();
  const ventas = useCol("ventas");
  const lotes = useCol("lotes");
  const cfg = useDocSub("configDinero", "frigorifico");
  const datos = { ...CONFIG_DEFECTO, ...(cfg.data || {}) };
  datos.impuestos = datos.impuestos.map(normalizarImp);
  const existente = id && id !== "nueva" ? ventas.find((v) => v.id === id) : null;
  const [v, setV] = useState(null);
  const base = existente || { fecha: hoy(), firma: datos.firmas[0] || "", frigorifico: "", consignatario: datos.consignatario || "", nroLiquidacion: "", fechaCobro: "", estado: simulacion ? "simulacion" : "cerrada", comisionPct: datos.comisionPct, impuestos: datos.impuestos, lineas: [lineaVacia()], notas: "", descontado: false };
  const e = v || base;
  const c = useMemo(() => calcularVenta(e), [e]);
  const set = (k) => (ev) => setV({ ...e, [k]: ev.target.value });
  const setL = (i, k, val) => setV({ ...e, lineas: e.lineas.map((l, j) => (j === i ? { ...l, [k]: val } : l)) });
  if (id && id !== "nueva" && !existente) return <p className="text-stone-500">Cargando…</p>;

  const guardar = (descontar, extra = {}) => {
    const vid = existente?.id || nuevoId("ventas");
    const data = { ...e, ...extra, comisionPct: Number(e.comisionPct) || 0, impuestos: (e.impuestos || []).map(normalizarImp), descontado: e.descontado || !!descontar };
    delete data.id;
    const ops = [{ op: "set", col: "ventas", id: vid, data }];
    // Al cerrar, descontar los animales de cada lote y dejar el movimiento en Hacienda.
    if (descontar) {
      for (const l of e.lineas) {
        const n = Number(l.cabezas) || 0;
        const lote = lotes.find((x) => x.id === l.loteId);
        if (!lote || !n) continue;
        ops.push({ op: "set", col: "movHacienda", id: nuevoId("movHacienda"), data: { loteId: lote.id, loteNombre: lote.nombre, fecha: e.fecha, tipo: "venta", categoria: l.categoria, cantidad: n, kg: Number(l.kgVivo) || null, notas: `Frigorífico ${e.frigorifico || ""} · ${e.firma}`.trim(), ventaId: vid, creadoEn: new Date().toISOString() } });
        ops.push({ op: "update", col: "lotes", id: lote.id, data: { [`composicion.${l.categoria}`]: inc(-n) } });
      }
    }
    escribir(ops);
    if (simulacion) ir("ventas", vid); else ir("ventas");
  };
  const puedeDescontar = !e.descontado && e.estado === "cerrada" && e.lineas.some((l) => l.loteId && Number(l.cabezas));

  return (
    <div>
      {!simulacion && <Boton variante="fantasma" className="-ml-2 mb-2" onClick={() => ir("ventas")}><ArrowLeft size={18} /> Ventas</Boton>}
      {!simulacion && <Encabezado titulo={existente ? "Venta a frigorífico" : "Nueva venta"} />}
      {simulacion && <p className="text-sm text-stone-600 mb-3">Probá precios y rendimientos antes de cerrar: el cálculo usa la comisión y los impuestos de "Firmas e impuestos". Si cerrás el negocio, guardalo como venta.</p>}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Tarjeta className="p-4 grid grid-cols-2 gap-3">
            <Campo label="Fecha"><Input type="date" value={e.fecha} onChange={set("fecha")} /></Campo>
            <Campo label="Firma"><Select value={e.firma} onChange={set("firma")}>{datos.firmas.map((f) => <option key={f}>{f}</option>)}</Select></Campo>
            <Campo label="Frigorífico (comprador)"><Input value={e.frigorifico} onChange={set("frigorifico")} placeholder="Ej: Frigorífico Las Moras" /></Campo>
            <Campo label="Consignatario"><Input value={e.consignatario || ""} onChange={set("consignatario")} placeholder="Ej: Campo Mercado" /></Campo>
            <Campo label="Comisión (%)"><Input type="number" step="0.01" value={e.comisionPct} onChange={set("comisionPct")} /></Campo>
            {!simulacion && <Campo label="N° de liquidación"><Input value={e.nroLiquidacion || ""} onChange={set("nroLiquidacion")} /></Campo>}
            {!simulacion && <Campo label="Fecha de cobro"><Input type="date" value={e.fechaCobro || ""} onChange={set("fechaCobro")} /></Campo>}
            {!simulacion && e.estado === "cerrada" && (
              <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" className="w-5 h-5" checked={!!e.cobrada} onChange={(ev) => setV({ ...e, cobrada: ev.target.checked })} /> Cobrada</label>
            )}
            {!simulacion && (
              <Campo label="Estado" className="col-span-2">
                <Select value={e.estado} onChange={set("estado")}><option value="cerrada">Cerrada</option><option value="simulacion">Simulación / a confirmar</option></Select>
              </Campo>
            )}
          </Tarjeta>
          {e.lineas.map((l, i) => {
            const cl = c.lineas[i];
            return (
              <Tarjeta key={l.id} className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <b className="text-sm">Categoría {i + 1}</b>
                  {e.lineas.length > 1 && <button className="text-stone-400 hover:text-red-600" onClick={() => setV({ ...e, lineas: e.lineas.filter((_, j) => j !== i) })}><Trash2 size={16} /></button>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Campo label="Categoría"><Select value={l.categoria} onChange={(ev) => setL(i, "categoria", ev.target.value)}>{CATEGORIAS.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</Select></Campo>
                  <Campo label="Cabezas"><Input type="number" inputMode="numeric" value={l.cabezas} onChange={(ev) => setL(i, "cabezas", ev.target.value)} /></Campo>
                  <Campo label="Kg en pie (total)" ayuda={cl.cabezas && cl.kgVivo ? `${fmtNum(cl.kgVivo / cl.cabezas)} kg/cab.` : null}><Input type="number" inputMode="decimal" value={l.kgVivo} onChange={(ev) => setL(i, "kgVivo", ev.target.value)} /></Campo>
                  <Campo label="Rendimiento (%)"><Input type="number" step="0.1" inputMode="decimal" value={l.rendimiento} onChange={(ev) => setL(i, "rendimiento", ev.target.value)} /></Campo>
                  <Campo label="Kg 2ª balanza (carcasa)" ayuda={!l.kgCarcasa && cl.kgCarcasa ? `Calculado: ${fmtNum(cl.kgCarcasa, 1)}` : cl.cabezas && cl.kgCarcasa ? `${fmtNum(cl.kgCarcasa / cl.cabezas, 1)} kg/cab.` : "Si lo sabés, pisa el cálculo"}><Input type="number" inputMode="decimal" value={l.kgCarcasa} placeholder={cl.kgCarcasa ? String(Math.round(cl.kgCarcasa)) : ""} onChange={(ev) => setL(i, "kgCarcasa", ev.target.value)} /></Campo>
                  <Campo label="Precio (USD/kg carcasa)"><Input type="number" step="0.0001" inputMode="decimal" value={l.precio} onChange={(ev) => setL(i, "precio", ev.target.value)} /></Campo>
                  {!simulacion && (
                    <Campo label="Sale del lote" className="col-span-2 sm:col-span-3">
                      <Select value={l.loteId} onChange={(ev) => setL(i, "loteId", ev.target.value)}><option value="">—</option>{lotes.filter((x) => x.activo !== false).map((x) => <option key={x.id} value={x.id}>{x.nombre} ({x.composicion?.[l.categoria] || 0} {nombreCategoria(l.categoria).toLowerCase()})</option>)}</Select>
                    </Campo>
                  )}
                </div>
                <div className="text-sm text-stone-600 mt-2">Bruto: <b>USD {fmtNum(cl.bruto)}</b></div>
              </Tarjeta>
            );
          })}
          <Boton variante="secundario" onClick={() => setV({ ...e, lineas: [...e.lineas, lineaVacia()] })}><Plus size={16} /> Otra categoría</Boton>
          {!simulacion && <Campo label="Notas"><Area value={e.notas} onChange={set("notas")} placeholder="N° de tropa, guía, condiciones de pago…" /></Campo>}
        </div>

        <Tarjeta className="p-4 space-y-2 h-fit lg:sticky lg:top-4">
          <h2 className="font-semibold">Liquidación estimada</h2>
          <Linea k="Kg en pie" v={fmtNum(c.kgVivo)} />
          <Linea k="Kg carcasa" v={`${fmtNum(c.kgCarcasa)} (${fmtNum(c.rendProm, 1)}%)`} />
          <Linea k="Importe bruto" v={`USD ${fmtNum(c.bruto, 2)}`} fuerte />
          <Linea k={`Comisión ${fmtNum(e.comisionPct, 2)}%`} v={`− USD ${fmtNum(c.comision, 2)}`} />
          {c.impuestos.map((i) => <Linea key={i.nombre} k={etiquetaImp(i, c.cabezas)} v={`− USD ${fmtNum(i.monto, 2)}`} />)}
          {c.impuestos.length > 0 && <Linea k="Total descuentos" v={`− USD ${fmtNum(c.comision + c.totalImp, 2)}`} />}
          {!c.impuestos.length && <p className="text-xs text-amber-700">Sin impuestos cargados (Firmas e impuestos).</p>}
          <div className="border-t pt-2"><Linea k="Neto" v={`USD ${fmtNum(c.neto, 2)}`} fuerte /></div>
          <Linea k="Por cabeza" v={`USD ${fmtNum(c.porCabeza, 2)}`} />
          <Linea k="Equivalente en pie" v={`USD ${fmtNum(c.equivPie, 3)}/kg`} />
          <div className="pt-2 flex flex-col gap-2">
            {simulacion ? (
              <Boton onClick={() => guardar(false, { estado: "cerrada" })} disabled={!c.bruto}>Guardar como venta</Boton>
            ) : (
              <>
                {puedeDescontar && <Boton onClick={() => guardar(true)}>Guardar y descontar del stock</Boton>}
                <Boton variante={puedeDescontar ? "secundario" : "primario"} onClick={() => guardar(false)}>Guardar</Boton>
                {existente && <Boton variante="peligro" onClick={() => { if (confirmar("¿Borrar esta venta? (No devuelve los animales al lote)")) { escribir([{ op: "delete", col: "ventas", id: existente.id }]); ir("ventas"); } }}>Borrar</Boton>}
                {e.descontado && <p className="text-xs text-stone-500">Los animales ya se descontaron del stock.</p>}
              </>
            )}
          </div>
        </Tarjeta>
      </div>
    </div>
  );
}

const Linea = ({ k, v, fuerte }) => <div className={`flex justify-between gap-2 text-sm ${fuerte ? "font-bold text-base" : ""}`}><span className="text-stone-600">{k}</span><span className="tabular-nums">{v}</span></div>;
