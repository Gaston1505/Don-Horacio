import React, { useMemo, useState } from "react";
import { Plus, Sprout, ArrowLeft, Pencil, FlaskConical, Wheat, Tractor, Trash2, BookOpen, Repeat } from "lucide-react";
import { useCol, useDocSub, agregar, actualizar, borrar, escribir, fijar, nuevoId } from "../backend";
import { useApp, Tarjeta, Boton, Encabezado, Modal, Campo, Input, Select, Area, Vacio, Dato, confirmar } from "../ui";
import { USOS, nombreUso, haPotrero, fmtNum, fmtFecha, hoy, diasEntre, esVerdeo } from "../logica";
import { nombrePotrero } from "../acciones";

// ---------- Datos fijos ----------
export const TIPOS_CICLO = ["verdeo_invierno", "verdeo_verano", "pradera", "mejoramiento", "agricola"];

export const TIPOS_ITEM = {
  quimico: { nombre: "Químico", icono: FlaskConical, unidades: ["L/ha", "kg/ha", "cc/ha", "g/ha"] },
  semilla: { nombre: "Semilla", icono: Sprout, unidades: ["kg/ha"] },
  fertilizante: { nombre: "Fertilizante", icono: Wheat, unidades: ["kg/ha", "L/ha"] },
  labor: { nombre: "Labor / servicio", icono: Tractor, unidades: ["ha"] },
};
export const MOMENTOS = {
  quimico: ["1ª quemada", "2ª quemada", "Preemergente", "Postemergente", "Insecticida", "Otro"],
  semilla: ["Siembra", "Resiembra / intersiembra"],
  fertilizante: ["A la siembra", "Refertilización post-pastoreo", "Refertilización en fecha fija", "Mantenimiento anual"],
  labor: ["Siembra", "Pulverización", "Fertilización", "Laboreo", "Otro"],
};

// Tabla de referencia inicial. Son rangos generales para arrancar; se ajustan según el estado de
// la chacra (enmalezamiento, antecesor, análisis de suelo) y se editan desde la app.
const REFERENCIA = [
  { tipo: "quimico", nombre: "Glifosato 66,2% (sal potásica)", droga: "Glifosato", dosisMin: 2, dosisMax: 3, unidad: "L/ha", usos: ["verdeo_invierno", "verdeo_verano", "pradera"], notas: "Quemada de barbecho" },
  { tipo: "quimico", nombre: "Glifosato 48%", droga: "Glifosato", dosisMin: 3, dosisMax: 4, unidad: "L/ha", usos: ["verdeo_invierno", "verdeo_verano", "pradera"], notas: "Quemada de barbecho" },
  { tipo: "quimico", nombre: "2,4-D amina 60%", droga: "2,4-D", dosisMin: 0.8, dosisMax: 1.2, unidad: "L/ha", usos: ["verdeo_invierno", "verdeo_verano"], notas: "Latifoliadas. No en praderas con leguminosas" },
  { tipo: "quimico", nombre: "Flumetsulam 12%", droga: "Flumetsulam", dosisMin: 0.3, dosisMax: 0.4, unidad: "L/ha", usos: ["pradera"], notas: "Latifoliadas en praderas con leguminosas" },
  { tipo: "quimico", nombre: "Cletodim 24%", droga: "Cletodim", dosisMin: 0.5, dosisMax: 0.8, unidad: "L/ha", usos: ["pradera"], notas: "Gramíneas en leguminosas puras" },
  { tipo: "quimico", nombre: "Coadyuvante / aceite", droga: "Aceite", dosisMin: 0.5, dosisMax: 1, unidad: "L/ha", usos: ["verdeo_invierno", "verdeo_verano", "pradera"], notas: "" },
  { tipo: "semilla", nombre: "Avena", droga: "Avena byzantina / sativa", dosisMin: 80, dosisMax: 100, unidad: "kg/ha", usos: ["verdeo_invierno"], notas: "" },
  { tipo: "semilla", nombre: "Raigrás anual", droga: "Lolium multiflorum", dosisMin: 20, dosisMax: 25, unidad: "kg/ha", usos: ["verdeo_invierno"], notas: "Puro; en mezcla con avena 10-15" },
  { tipo: "semilla", nombre: "Sorgo forrajero", droga: "Sorghum", dosisMin: 20, dosisMax: 25, unidad: "kg/ha", usos: ["verdeo_verano"], notas: "" },
  { tipo: "semilla", nombre: "Moha", droga: "Setaria italica", dosisMin: 20, dosisMax: 25, unidad: "kg/ha", usos: ["verdeo_verano"], notas: "" },
  { tipo: "semilla", nombre: "Festuca", droga: "Festuca arundinacea", dosisMin: 12, dosisMax: 15, unidad: "kg/ha", usos: ["pradera"], notas: "" },
  { tipo: "semilla", nombre: "Dactylis", droga: "Dactylis glomerata", dosisMin: 8, dosisMax: 10, unidad: "kg/ha", usos: ["pradera"], notas: "" },
  { tipo: "semilla", nombre: "Trébol blanco", droga: "Trifolium repens", dosisMin: 2, dosisMax: 3, unidad: "kg/ha", usos: ["pradera", "mejoramiento"], notas: "Inoculado" },
  { tipo: "semilla", nombre: "Trébol rojo", droga: "Trifolium pratense", dosisMin: 6, dosisMax: 8, unidad: "kg/ha", usos: ["pradera"], notas: "Inoculado" },
  { tipo: "semilla", nombre: "Lotus corniculatus", droga: "Lotus corniculatus", dosisMin: 8, dosisMax: 10, unidad: "kg/ha", usos: ["pradera", "mejoramiento"], notas: "Inoculado" },
  { tipo: "semilla", nombre: "Alfalfa", droga: "Medicago sativa", dosisMin: 12, dosisMax: 15, unidad: "kg/ha", usos: ["pradera"], notas: "Inoculada" },
  { tipo: "fertilizante", nombre: "Fosfato diamónico (18-46-0)", droga: "DAP", dosisMin: 80, dosisMax: 120, unidad: "kg/ha", usos: ["verdeo_invierno", "verdeo_verano", "pradera"], notas: "A la siembra" },
  { tipo: "fertilizante", nombre: "Urea (46-0-0)", droga: "Urea", dosisMin: 50, dosisMax: 100, unidad: "kg/ha", usos: ["verdeo_invierno", "verdeo_verano"], notas: "Refertilización post-pastoreo" },
  { tipo: "fertilizante", nombre: "Superfosfato (0-21/23-0)", droga: "Superfosfato", dosisMin: 100, dosisMax: 200, unidad: "kg/ha", usos: ["pradera", "mejoramiento"], notas: "Mantenimiento de leguminosas" },
];

const PLAN_DEFECTO = { verdeosAntesDePradera: 4, aniosPradera: 5, texto: "" };

// ---------- Cálculos ----------
export function costoItem(item, ha, precio) {
  const p = Number(precio) || 0;
  if (!p) return 0;
  if (item.tipo === "labor") return p * ha;
  return (Number(item.dosis) || 0) * ha * p;
}
export function costoCiclo(ciclo, costos) {
  const ha = Number(ciclo.hectareas) || 0;
  const precios = costos?.precios || {};
  const total = (ciclo.items || []).reduce((s, it) => s + costoItem(it, ha, precios[it.id]), 0);
  return { total, porHa: ha ? total / ha : 0, sinPrecio: (ciclo.items || []).filter((it) => !Number(precios[it.id])).length };
}
const anios = (desde, hasta = hoy()) => diasEntre(desde, hasta) / 365;

// Recomendación según el plan de rotación: cuenta verdeos seguidos desde la última pradera y la
// edad de la pradera actual.
export function recomendacionRotacion(potrero, ciclos, plan) {
  const propios = ciclos.filter((c) => c.potreroId === potrero.id).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const activo = propios.find((c) => !c.fin);
  let verdeosSeguidos = 0;
  for (let i = propios.length - 1; i >= 0; i--) {
    if (esVerdeo(propios[i].tipo)) verdeosSeguidos++;
    else if (propios[i].tipo === "pradera") break;
  }
  const N = Number(plan.verdeosAntesDePradera) || PLAN_DEFECTO.verdeosAntesDePradera;
  const vida = Number(plan.aniosPradera) || PLAN_DEFECTO.aniosPradera;
  if (activo?.tipo === "pradera") {
    const edad = anios(activo.inicio);
    if (edad >= vida) return { nivel: "alerta", texto: `La pradera tiene ${fmtNum(edad, 1)} años (vida útil ${vida}). Evaluar pasarla a campo natural mejorado o volver a verdeo.` };
    return { nivel: "ok", texto: `Pradera de ${fmtNum(edad, 1)} años: mantenimiento (refertilización fosfatada, control de malezas).` };
  }
  if (verdeosSeguidos >= N) return { nivel: "alerta", texto: `Lleva ${verdeosSeguidos} verdeos seguidos. Toca pradera con leguminosas para recuperar el suelo.` };
  if (verdeosSeguidos > 0) return { nivel: "info", texto: `${verdeosSeguidos} de ${N} verdeos antes de pasar a pradera.` };
  return null;
}

// ---------- Vista ----------
export default function Chacras() {
  const { param } = useApp();
  return param ? <FichaCiclo id={param} /> : <Lista />;
}

function Lista() {
  const { puede, ir } = useApp();
  const ciclos = useCol("ciclos");
  const potreros = useCol("potreros");
  const costosLista = useCol("costosCiclo", puede("dinero"));
  const [tab, setTab] = useState("ciclos");
  const [nuevo, setNuevo] = useState(false);
  const costos = Object.fromEntries(costosLista.map((c) => [c.id, c]));
  const ordenados = [...ciclos].sort((a, b) => (!a.fin === !b.fin ? b.inicio.localeCompare(a.inicio) : a.fin ? 1 : -1));
  return (
    <div>
      <Encabezado titulo="Chacras" sub="Verdeos, praderas y mejoramientos: insumos, fechas y costos de cada ciclo">
        {puede("editar") && <Boton onClick={() => setNuevo(true)}><Plus size={18} /> Nuevo ciclo</Boton>}
      </Encabezado>
      <div className="flex gap-1 mb-4 bg-stone-200/70 p-1 rounded-xl w-fit flex-wrap">
        {[["ciclos", "Ciclos"], ["plan", "Plan de rotación"], ["insumos", "Recomendaciones"]].map(([k, n]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${tab === k ? "bg-white shadow" : "text-stone-600"}`}>{n}</button>
        ))}
      </div>
      {tab === "ciclos" && (
        !ordenados.length ? (
          <Tarjeta><Vacio icono={Sprout} titulo="Sin ciclos cargados" texto="Cada vez que se arma un verdeo, una pradera o un mejoramiento, creá un ciclo: ahí van las quemadas, la siembra, las fertilizaciones y el costo." /></Tarjeta>
        ) : (
          <Tarjeta className="divide-y divide-stone-100">
            {ordenados.map((c) => {
              const p = potreros.find((x) => x.id === c.potreroId);
              const cc = puede("dinero") ? costoCiclo(c, costos[c.id]) : null;
              return (
                <button key={c.id} onClick={() => ir("chacras", c.id)} className="w-full text-left px-4 py-3 hover:bg-stone-50 flex justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold">{nombrePotrero(p)} · {nombreUso(c.tipo)}</div>
                    <div className="text-sm text-stone-500 truncate">{c.nombre ? c.nombre + " · " : ""}{fmtFecha(c.inicio)} → {c.fin ? fmtFecha(c.fin) : "en curso"} · {fmtNum(c.hectareas, 1)} ha · {(c.items || []).length} registros</div>
                  </div>
                  <div className="text-right shrink-0">
                    {!c.fin && <span className="text-xs font-semibold text-green-700 bg-green-100 rounded-full px-2 py-0.5">En curso</span>}
                    {cc && cc.total > 0 && <div className="text-sm font-semibold mt-1">USD {fmtNum(cc.porHa)}/ha</div>}
                  </div>
                </button>
              );
            })}
          </Tarjeta>
        )
      )}
      {tab === "plan" && <PlanRotacion />}
      {tab === "insumos" && <Insumos />}
      {nuevo && <FormCiclo onCerrar={() => setNuevo(false)} onCreado={(id) => ir("chacras", id)} />}
    </div>
  );
}

export function FormCiclo({ ciclo, potreroId, onCerrar, onCreado }) {
  const { puede } = useApp();
  const potreros = useCol("potreros");
  const [d, setD] = useState(ciclo || { potreroId: potreroId || "", tipo: "verdeo_invierno", nombre: "", inicio: hoy(), fin: "", hectareas: "", notas: "" });
  const [cambiarAptitud, setCambiarAptitud] = useState(!ciclo);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const p = potreros.find((x) => x.id === d.potreroId);
  const guardar = () => {
    const data = { potreroId: d.potreroId, tipo: d.tipo, nombre: d.nombre, inicio: d.inicio, fin: d.fin || null, hectareas: Number(d.hectareas) || haPotrero(p), notas: d.notas };
    if (ciclo) { actualizar("ciclos", ciclo.id, data); onCerrar(); return; }
    const id = nuevoId("ciclos");
    const ops = [{ op: "set", col: "ciclos", id, data: { ...data, items: [], creadoEn: new Date().toISOString() } }];
    if (cambiarAptitud) ops.push({ op: "update", col: "potreros", id: d.potreroId, data: { uso: d.tipo, fechaImplantacion: d.inicio } });
    escribir(ops);
    onCerrar(); onCreado?.(id);
  };
  const ordenados = [...potreros].sort((a, b) => nombrePotrero(a).localeCompare(nombrePotrero(b), "es", { numeric: true }));
  return (
    <Modal titulo={ciclo ? "Editar ciclo" : "Nuevo ciclo de chacra"} onCerrar={onCerrar}
      pie={<>
        {ciclo && puede("borrar") && <Boton variante="peligro" className="mr-auto" onClick={() => { if (confirmar("¿Borrar este ciclo con todos sus registros?")) { escribir([{ op: "delete", col: "ciclos", id: ciclo.id }, { op: "delete", col: "costosCiclo", id: ciclo.id }]); onCerrar(); window.location.hash = "/chacras"; } }}>Borrar</Boton>}
        <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={guardar} disabled={!d.potreroId || !d.inicio}>Guardar</Boton>
      </>}>
      <Campo label="Potrero">
        <Select value={d.potreroId} onChange={set("potreroId")} disabled={!!ciclo}>
          <option value="">Elegir…</option>
          {ordenados.map((x) => <option key={x.id} value={x.id}>{nombrePotrero(x)} · {fmtNum(haPotrero(x), 1)} ha · hoy {nombreUso(x.uso).toLowerCase()}</option>)}
        </Select>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Tipo"><Select value={d.tipo} onChange={set("tipo")}>{TIPOS_CICLO.map((t) => <option key={t} value={t}>{nombreUso(t)}</option>)}</Select></Campo>
        <Campo label="Hectáreas" ayuda={p ? `Potrero: ${fmtNum(haPotrero(p), 1)} ha` : null}><Input type="number" step="0.1" value={d.hectareas} placeholder={p ? haPotrero(p).toFixed(1) : ""} onChange={set("hectareas")} /></Campo>
        <Campo label="Inicio (1ª quemada o siembra)"><Input type="date" value={d.inicio} onChange={set("inicio")} /></Campo>
        <Campo label="Fin" ayuda="Vacío = en curso"><Input type="date" value={d.fin || ""} onChange={set("fin")} /></Campo>
      </div>
      <Campo label="Nombre (opcional)"><Input value={d.nombre} onChange={set("nombre")} placeholder="Ej: Avena + raigrás 2026" /></Campo>
      {!ciclo && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="w-5 h-5" checked={cambiarAptitud} onChange={(e) => setCambiarAptitud(e.target.checked)} /> Cambiar la aptitud del potrero a "{nombreUso(d.tipo)}" (color del borde en el mapa)</label>}
      <Campo label="Notas"><Area value={d.notas} onChange={set("notas")} placeholder="Antecesor, estado de la chacra, enmalezamiento…" /></Campo>
    </Modal>
  );
}

function FichaCiclo({ id }) {
  const { puede, ir } = useApp();
  const ciclos = useCol("ciclos");
  const potreros = useCol("potreros");
  const costosDoc = useDocSub("costosCiclo", puede("dinero") ? id : null);
  const [modal, setModal] = useState(null);
  const c = ciclos.find((x) => x.id === id);
  if (!c) return <div><Boton variante="fantasma" onClick={() => ir("chacras")}><ArrowLeft size={18} /> Chacras</Boton><p className="mt-4 text-stone-500">Ciclo no encontrado.</p></div>;
  const p = potreros.find((x) => x.id === c.potreroId);
  const ha = Number(c.hectareas) || 0;
  const precios = costosDoc.data?.precios || {};
  const cc = costoCiclo(c, costosDoc.data);
  const items = [...(c.items || [])].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
  const quitarItem = (it) => {
    if (!confirmar("¿Borrar este registro?")) return;
    actualizar("ciclos", c.id, { items: (c.items || []).filter((x) => x.id !== it.id) });
  };
  const porTipo = Object.keys(TIPOS_ITEM).map((t) => ({ t, total: items.filter((i) => i.tipo === t).reduce((s, i) => s + costoItem(i, ha, precios[i.id]), 0) })).filter((x) => x.total > 0);
  return (
    <div>
      <Boton variante="fantasma" className="-ml-2 mb-2" onClick={() => ir("chacras")}><ArrowLeft size={18} /> Chacras</Boton>
      <Encabezado titulo={`${nombrePotrero(p)} · ${nombreUso(c.tipo)}`} sub={`${c.nombre ? c.nombre + " · " : ""}${fmtFecha(c.inicio)} → ${c.fin ? fmtFecha(c.fin) : "en curso"} · ${fmtNum(ha, 1)} ha`}>
        {puede("registrar") && <Boton onClick={() => setModal({ t: "item" })}><Plus size={18} /> Registrar</Boton>}
        {puede("editar") && <Boton variante="secundario" onClick={() => setModal({ t: "ciclo" })}><Pencil size={18} /> Editar</Boton>}
      </Encabezado>

      {puede("dinero") && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Tarjeta className="p-4"><Dato label="Costo total" valor={`USD ${fmtNum(cc.total)}`} sub={cc.sinPrecio ? `${cc.sinPrecio} registro(s) sin precio` : "Todos con precio"} /></Tarjeta>
          <Tarjeta className="p-4"><Dato label="Costo por hectárea" valor={`USD ${fmtNum(cc.porHa)}`} /></Tarjeta>
          {porTipo.slice(0, 2).map((x) => <Tarjeta key={x.t} className="p-4"><Dato label={TIPOS_ITEM[x.t].nombre} valor={`USD ${fmtNum(x.total)}`} sub={`USD ${fmtNum(ha ? x.total / ha : 0)}/ha`} /></Tarjeta>)}
        </div>
      )}

      <Tarjeta className="divide-y divide-stone-100">
        {!items.length && <Vacio titulo="Sin registros" texto="Cargá la 1ª y 2ª quemada, la siembra (semilla, variedad, proveedor, densidad), la fertilización a la siembra y las refertilizaciones después de cada pastoreo." />}
        {items.map((it) => {
          const T = TIPOS_ITEM[it.tipo] || TIPOS_ITEM.labor;
          const precio = precios[it.id];
          return (
            <div key={it.id} className="px-4 py-3 flex gap-3 justify-between">
              <div className="flex gap-3 min-w-0">
                <T.icono size={20} className="text-campo-700 shrink-0 mt-0.5" />
                <div className="min-w-0 text-sm">
                  <div><b>{it.producto || T.nombre}</b>{it.droga ? <span className="text-stone-500"> ({it.droga})</span> : null} · {it.momento}</div>
                  <div className="text-stone-600">
                    {fmtFecha(it.fecha)}
                    {it.dosis ? ` · ${fmtNum(it.dosis, 2)} ${it.unidad}` : ""}
                    {it.dosis && it.tipo !== "labor" ? ` · total ${fmtNum(it.dosis * ha, 0)} ${(it.unidad || "").replace("/ha", "")}` : ""}
                    {it.variedad ? ` · var. ${it.variedad}` : ""}{it.proveedor ? ` · ${it.proveedor}` : ""}
                  </div>
                  {puede("dinero") && precio ? <div className="text-stone-500">USD {fmtNum(precio, 2)} {it.tipo === "labor" ? "/ha" : `/${(it.unidad || "").replace("/ha", "")}`} → USD {fmtNum(costoItem(it, ha, precio))}</div> : null}
                  {it.notas && <div className="text-stone-500">{it.notas}</div>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {puede("editar") && <button className="p-2 text-stone-400 hover:text-stone-700" onClick={() => setModal({ t: "item", item: it })}><Pencil size={16} /></button>}
                {puede("borrar") && <button className="p-2 text-stone-400 hover:text-red-600" onClick={() => quitarItem(it)}><Trash2 size={16} /></button>}
              </div>
            </div>
          );
        })}
      </Tarjeta>
      {c.notas && <p className="text-sm text-stone-600 mt-3 whitespace-pre-wrap">{c.notas}</p>}

      {modal?.t === "ciclo" && <FormCiclo ciclo={c} onCerrar={() => setModal(null)} />}
      {modal?.t === "item" && <FormItem ciclo={c} item={modal.item} precio={modal.item ? precios[modal.item.id] : ""} onCerrar={() => setModal(null)} />}
    </div>
  );
}

function FormItem({ ciclo, item, precio: precioInicial, onCerrar }) {
  const { puede } = useApp();
  const insumos = useCol("insumos");
  const preciosInsumos = useCol("preciosInsumos", puede("dinero"));
  const [d, setD] = useState(item || { tipo: "quimico", momento: MOMENTOS.quimico[0], fecha: hoy(), producto: "", droga: "", variedad: "", proveedor: "", dosis: "", unidad: "L/ha", notas: "" });
  const [precio, setPrecio] = useState(precioInicial ?? "");
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const cambiarTipo = (t) => setD({ ...d, tipo: t, momento: MOMENTOS[t][0], unidad: TIPOS_ITEM[t].unidades[0] });
  const sugeridos = insumos.filter((x) => x.tipo === d.tipo && (!x.usos?.length || x.usos.includes(ciclo.tipo)));
  const elegirInsumo = (id) => {
    const x = insumos.find((i) => i.id === id);
    if (!x) return;
    const dosis = x.dosisMin && x.dosisMax ? (Number(x.dosisMin) + Number(x.dosisMax)) / 2 : x.dosisMin || "";
    setD({ ...d, producto: x.nombre, droga: x.droga || "", unidad: x.unidad || d.unidad, dosis, proveedor: d.proveedor || x.proveedor || "" });
    const pr = preciosInsumos.find((p) => p.id === id)?.precio;
    if (pr && !precio) setPrecio(pr);
  };
  const ha = Number(ciclo.hectareas) || 0;
  const guardar = () => {
    const it = { ...d, id: item?.id || nuevoId("ciclos"), dosis: d.dosis === "" ? null : Number(d.dosis) };
    const items = item ? (ciclo.items || []).map((x) => (x.id === item.id ? it : x)) : [...(ciclo.items || []), it];
    const ops = [{ op: "update", col: "ciclos", id: ciclo.id, data: { items } }];
    if (puede("dinero") && precio !== "" && precio != null) ops.push({ op: "set", col: "costosCiclo", id: ciclo.id, data: { precios: { [it.id]: Number(precio) } }, merge: true });
    escribir(ops);
    onCerrar();
  };
  const T = TIPOS_ITEM[d.tipo];
  return (
    <Modal titulo={item ? "Editar registro" : "Registrar en el ciclo"} onCerrar={onCerrar}
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar} disabled={!d.fecha || (d.tipo !== "labor" && !d.producto)}>Guardar</Boton></>}>
      <div className="grid grid-cols-4 gap-1.5">
        {Object.entries(TIPOS_ITEM).map(([k, t]) => (
          <button key={k} type="button" onClick={() => cambiarTipo(k)} className={`rounded-xl border py-2 text-xs font-medium flex flex-col items-center gap-1 ${d.tipo === k ? "bg-campo-700 text-white border-campo-700" : "bg-white border-stone-300"}`}>
            <t.icono size={18} />{t.nombre}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Momento"><Select value={d.momento} onChange={set("momento")}>{MOMENTOS[d.tipo].map((m) => <option key={m}>{m}</option>)}</Select></Campo>
        <Campo label="Fecha"><Input type="date" value={d.fecha} onChange={set("fecha")} /></Campo>
      </div>
      {sugeridos.length > 0 && (
        <Campo label="Elegir de la tabla de recomendaciones" ayuda="Completa nombre, droga y una dosis de referencia; ajustala a la chacra.">
          <Select value="" onChange={(e) => elegirInsumo(e.target.value)}>
            <option value="">—</option>
            {sugeridos.map((x) => <option key={x.id} value={x.id}>{x.nombre} · {fmtNum(x.dosisMin, 2)}{x.dosisMax ? `–${fmtNum(x.dosisMax, 2)}` : ""} {x.unidad}</option>)}
          </Select>
        </Campo>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Campo label={d.tipo === "quimico" ? "Nombre comercial" : d.tipo === "semilla" ? "Especie / semilla" : d.tipo === "labor" ? "Labor" : "Fertilizante"} className={d.tipo === "labor" ? "col-span-2" : ""}>
          <Input value={d.producto} onChange={set("producto")} placeholder={d.tipo === "quimico" ? "Ej: Roundup Full II" : d.tipo === "semilla" ? "Ej: Raigrás anual" : d.tipo === "labor" ? "Ej: Siembra directa contratada" : "Ej: Urea"} />
        </Campo>
        {d.tipo === "quimico" && <Campo label="Droga (principio activo)"><Input value={d.droga} onChange={set("droga")} placeholder="Ej: Glifosato 66,2%" /></Campo>}
        {d.tipo === "semilla" && <Campo label="Variedad / cultivar"><Input value={d.variedad} onChange={set("variedad")} placeholder="Ej: INIA Titán" /></Campo>}
        {d.tipo === "fertilizante" && <Campo label="Fórmula"><Input value={d.droga} onChange={set("droga")} placeholder="Ej: 46-0-0" /></Campo>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {d.tipo !== "labor" && (
          <Campo label={d.tipo === "semilla" ? "Densidad" : "Dosis"} ayuda={d.dosis && ha ? `Total: ${fmtNum(d.dosis * ha, 0)} ${d.unidad.replace("/ha", "")} para ${fmtNum(ha, 1)} ha` : null}>
            <div className="flex gap-2">
              <Input type="number" step="0.01" inputMode="decimal" value={d.dosis ?? ""} onChange={set("dosis")} />
              <select className="rounded-xl border border-stone-300 bg-white px-2" value={d.unidad} onChange={set("unidad")}>{T.unidades.map((u) => <option key={u}>{u}</option>)}</select>
            </div>
          </Campo>
        )}
        <Campo label="Proveedor"><Input value={d.proveedor} onChange={set("proveedor")} placeholder="A quién se le compró" /></Campo>
        {puede("dinero") && (
          <Campo label={d.tipo === "labor" ? "Precio (USD/ha)" : `Precio (USD/${(d.unidad || "").replace("/ha", "")})`} ayuda={precio && ha ? `Costo: USD ${fmtNum(costoItem({ ...d, dosis: Number(d.dosis) }, ha, precio))}` : "Solo lo ven administrador y encargado"}>
            <Input type="number" step="0.01" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} />
          </Campo>
        )}
      </div>
      <Campo label="Notas"><Input value={d.notas} onChange={set("notas")} placeholder="Condiciones, malezas objetivo, quién aplicó…" /></Campo>
    </Modal>
  );
}

function PlanRotacion() {
  const { puede, ir } = useApp();
  const planDoc = useDocSub("config", "planRotacion");
  const plan = { ...PLAN_DEFECTO, ...(planDoc.data || {}) };
  const potreros = useCol("potreros");
  const ciclos = useCol("ciclos");
  const [edit, setEdit] = useState(null);
  const filas = potreros
    .map((p) => ({ p, r: recomendacionRotacion(p, ciclos, plan), n: ciclos.filter((c) => c.potreroId === p.id).length }))
    .filter((x) => x.n > 0 || ["pradera", "verdeo_invierno", "verdeo_verano"].includes(x.p.uso))
    .sort((a, b) => ({ alerta: 0, info: 1, ok: 2 }[a.r?.nivel] ?? 3) - ({ alerta: 0, info: 1, ok: 2 }[b.r?.nivel] ?? 3));
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Tarjeta className="p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Repeat size={18} /> Plan</h2>
        {edit ? (
          <>
            <Campo label="Verdeos seguidos antes de pasar a pradera"><Input type="number" value={edit.verdeosAntesDePradera} onChange={(e) => setEdit({ ...edit, verdeosAntesDePradera: e.target.value })} /></Campo>
            <Campo label="Vida útil de la pradera (años)"><Input type="number" value={edit.aniosPradera} onChange={(e) => setEdit({ ...edit, aniosPradera: e.target.value })} /></Campo>
            <Campo label="Descripción del plan"><Area rows={6} value={edit.texto} onChange={(e) => setEdit({ ...edit, texto: e.target.value })} placeholder="Secuencia, especies, criterios…" /></Campo>
            <div className="flex gap-2"><Boton variante="secundario" onClick={() => setEdit(null)}>Cancelar</Boton><Boton onClick={() => { fijar("config", "planRotacion", { verdeosAntesDePradera: Number(edit.verdeosAntesDePradera), aniosPradera: Number(edit.aniosPradera), texto: edit.texto }); setEdit(null); }}>Guardar</Boton></div>
          </>
        ) : (
          <>
            <p className="text-sm">Después de <b>{plan.verdeosAntesDePradera}</b> verdeos seguidos → <b>pradera con leguminosas</b>, que se mantiene unos <b>{plan.aniosPradera}</b> años. Al terminar su vida útil queda como <b>campo natural mejorado</b> o vuelve a verdeo.</p>
            {plan.texto && <p className="text-sm text-stone-600 whitespace-pre-wrap">{plan.texto}</p>}
            {puede("editar") && <Boton chico variante="secundario" onClick={() => setEdit(plan)}><Pencil size={16} /> Editar plan</Boton>}
          </>
        )}
      </Tarjeta>
      <Tarjeta className="p-4 lg:col-span-2">
        <h2 className="font-semibold mb-3">Qué toca en cada potrero</h2>
        {!filas.length && <p className="text-sm text-stone-500">Cuando haya ciclos cargados, acá aparece la recomendación de cada potrero según el plan.</p>}
        <div className="divide-y divide-stone-100">
          {filas.map(({ p, r, n }) => (
            <button key={p.id} onClick={() => ir("potreros", p.id)} className="w-full text-left py-2.5">
              <div className="flex justify-between gap-2"><b>{nombrePotrero(p)}</b><span className="text-xs text-stone-500">{nombreUso(p.uso)} · {n} ciclo(s)</span></div>
              {r && <div className={`text-sm ${r.nivel === "alerta" ? "text-amber-700 font-medium" : "text-stone-600"}`}>{r.texto}</div>}
            </button>
          ))}
        </div>
      </Tarjeta>
    </div>
  );
}

function Insumos() {
  const { puede } = useApp();
  const insumos = useCol("insumos");
  const precios = useCol("preciosInsumos", puede("dinero"));
  const [modal, setModal] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const cargarReferencia = () => {
    const ops = REFERENCIA.map((r) => ({ op: "set", col: "insumos", id: nuevoId("insumos"), data: r }));
    escribir(ops);
  };
  const lista = insumos.filter((x) => filtro === "todos" || x.tipo === filtro).sort((a, b) => a.tipo.localeCompare(b.tipo) || a.nombre.localeCompare(b.nombre));
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        {["todos", ...Object.keys(TIPOS_ITEM).filter((t) => t !== "labor")].map((t) => (
          <button key={t} onClick={() => setFiltro(t)} className={`text-sm rounded-full px-3 py-1 border ${filtro === t ? "bg-stone-900 text-white border-stone-900" : "bg-white border-stone-300"}`}>{t === "todos" ? "Todos" : TIPOS_ITEM[t].nombre}</button>
        ))}
        {puede("editar") && <Boton chico className="ml-auto" onClick={() => setModal({})}><Plus size={16} /> Agregar</Boton>}
      </div>
      {!insumos.length && (
        <Tarjeta><Vacio icono={BookOpen} titulo="Tabla de recomendaciones vacía" texto="Es la lista de químicos, semillas y fertilizantes con su dosis por hectárea, para elegir rápido al registrar en un ciclo."
          accion={puede("editar") && <Boton onClick={cargarReferencia}>Cargar tabla de referencia</Boton>} /></Tarjeta>
      )}
      {insumos.length > 0 && (
        <Tarjeta className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-stone-500 border-b"><th className="p-3">Producto</th><th className="p-3">Droga / especie</th><th className="p-3 text-right">Dosis</th><th className="p-3">Para</th>{puede("dinero") && <th className="p-3 text-right">Precio</th>}</tr></thead>
            <tbody>
              {lista.map((x) => {
                const pr = precios.find((p) => p.id === x.id)?.precio;
                return (
                  <tr key={x.id} className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer" onClick={() => puede("editar") && setModal({ insumo: x, precio: pr })}>
                    <td className="p-3"><div className="font-medium">{x.nombre}</div><div className="text-xs text-stone-500">{TIPOS_ITEM[x.tipo]?.nombre}{x.notas ? ` · ${x.notas}` : ""}</div></td>
                    <td className="p-3 text-stone-600">{x.droga}</td>
                    <td className="p-3 text-right whitespace-nowrap">{fmtNum(x.dosisMin, 2)}{x.dosisMax ? `–${fmtNum(x.dosisMax, 2)}` : ""} {x.unidad}</td>
                    <td className="p-3 text-xs text-stone-500">{(x.usos || []).map(nombreUso).join(", ")}</td>
                    {puede("dinero") && <td className="p-3 text-right">{pr ? `USD ${fmtNum(pr, 2)}` : "—"}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-stone-500 p-3">Rangos de referencia general: ajustar según enmalezamiento, antecesor y análisis de suelo.</p>
        </Tarjeta>
      )}
      {modal && <FormInsumo insumo={modal.insumo} precio={modal.precio} onCerrar={() => setModal(null)} />}
    </div>
  );
}

function FormInsumo({ insumo, precio: precioInicial, onCerrar }) {
  const { puede } = useApp();
  const [d, setD] = useState(insumo || { tipo: "quimico", nombre: "", droga: "", dosisMin: "", dosisMax: "", unidad: "L/ha", usos: [], notas: "", proveedor: "" });
  const [precio, setPrecio] = useState(precioInicial ?? "");
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const guardar = () => {
    const { id: _id, ...resto } = d;
    const data = { ...resto, dosisMin: d.dosisMin === "" ? null : Number(d.dosisMin), dosisMax: d.dosisMax === "" ? null : Number(d.dosisMax) };
    const id = insumo?.id || nuevoId("insumos");
    const ops = [{ op: "set", col: "insumos", id, data }];
    if (puede("dinero") && precio !== "") ops.push({ op: "set", col: "preciosInsumos", id, data: { precio: Number(precio) } });
    escribir(ops);
    onCerrar();
  };
  const toggleUso = (u) => setD({ ...d, usos: d.usos?.includes(u) ? d.usos.filter((x) => x !== u) : [...(d.usos || []), u] });
  return (
    <Modal titulo={insumo ? "Editar insumo" : "Nuevo insumo"} onCerrar={onCerrar}
      pie={<>
        {insumo && puede("borrar") && <Boton variante="peligro" className="mr-auto" onClick={() => { if (confirmar("¿Borrar de la tabla?")) { borrar("insumos", insumo.id); onCerrar(); } }}>Borrar</Boton>}
        <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar} disabled={!d.nombre}>Guardar</Boton>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Tipo"><Select value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value, unidad: TIPOS_ITEM[e.target.value].unidades[0] })}>{Object.entries(TIPOS_ITEM).filter(([k]) => k !== "labor").map(([k, t]) => <option key={k} value={k}>{t.nombre}</option>)}</Select></Campo>
        <Campo label="Unidad"><Select value={d.unidad} onChange={set("unidad")}>{TIPOS_ITEM[d.tipo].unidades.map((u) => <option key={u}>{u}</option>)}</Select></Campo>
        <Campo label="Nombre comercial / especie" className="col-span-2"><Input value={d.nombre} onChange={set("nombre")} /></Campo>
        <Campo label={d.tipo === "semilla" ? "Nombre científico" : "Droga / fórmula"} className="col-span-2"><Input value={d.droga} onChange={set("droga")} /></Campo>
        <Campo label="Dosis mínima"><Input type="number" step="0.01" value={d.dosisMin ?? ""} onChange={set("dosisMin")} /></Campo>
        <Campo label="Dosis máxima"><Input type="number" step="0.01" value={d.dosisMax ?? ""} onChange={set("dosisMax")} /></Campo>
        {puede("dinero") && <Campo label={`Precio (USD/${d.unidad.replace("/ha", "")})`}><Input type="number" step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} /></Campo>}
        <Campo label="Proveedor habitual"><Input value={d.proveedor || ""} onChange={set("proveedor")} /></Campo>
      </div>
      <div>
        <div className="text-sm font-medium text-stone-700 mb-1">Se usa en</div>
        <div className="flex flex-wrap gap-2">{TIPOS_CICLO.map((u) => <button key={u} type="button" onClick={() => toggleUso(u)} className={`text-sm rounded-full px-3 py-1 border ${d.usos?.includes(u) ? "bg-campo-700 text-white border-campo-700" : "bg-white border-stone-300"}`}>{nombreUso(u)}</button>)}</div>
      </div>
      <Campo label="Notas"><Input value={d.notas} onChange={set("notas")} /></Campo>
    </Modal>
  );
}

// Lista de ciclos de un potrero, para su ficha.
export function CiclosDePotrero({ potrero }) {
  const { puede, ir } = useApp();
  const ciclos = useCol("ciclos");
  const planDoc = useDocSub("config", "planRotacion");
  const costosLista = useCol("costosCiclo", puede("dinero"));
  const [nuevo, setNuevo] = useState(false);
  const propios = ciclos.filter((c) => c.potreroId === potrero.id).sort((a, b) => b.inicio.localeCompare(a.inicio));
  const r = recomendacionRotacion(potrero, ciclos, { ...PLAN_DEFECTO, ...(planDoc.data || {}) });
  return (
    <div className="space-y-3">
      {r && <Tarjeta className={`p-4 text-sm ${r.nivel === "alerta" ? "bg-amber-50 border-amber-300 text-amber-900" : ""}`}><b>Plan de rotación:</b> {r.texto}</Tarjeta>}
      <div className="flex justify-end">{puede("editar") && <Boton chico onClick={() => setNuevo(true)}><Plus size={16} /> Nuevo ciclo</Boton>}</div>
      {!propios.length ? <Tarjeta><Vacio icono={Sprout} titulo="Sin ciclos" texto="Verdeos, praderas o mejoramientos hechos en este potrero, con sus insumos y costos." /></Tarjeta> : (
        <Tarjeta className="divide-y divide-stone-100">
          {propios.map((c) => {
            const cc = puede("dinero") ? costoCiclo(c, costosLista.find((x) => x.id === c.id)) : null;
            return (
              <button key={c.id} onClick={() => ir("chacras", c.id)} className="w-full text-left px-4 py-3 hover:bg-stone-50 flex justify-between gap-2">
                <div><div className="font-medium">{nombreUso(c.tipo)}{c.nombre ? ` · ${c.nombre}` : ""}</div><div className="text-sm text-stone-500">{fmtFecha(c.inicio)} → {c.fin ? fmtFecha(c.fin) : "en curso"} · {(c.items || []).length} registros</div></div>
                {cc && cc.total > 0 && <div className="text-sm font-semibold">USD {fmtNum(cc.porHa)}/ha</div>}
              </button>
            );
          })}
        </Tarjeta>
      )}
      {nuevo && <FormCiclo potreroId={potrero.id} onCerrar={() => setNuevo(false)} onCreado={(id) => ir("chacras", id)} />}
    </div>
  );
}
