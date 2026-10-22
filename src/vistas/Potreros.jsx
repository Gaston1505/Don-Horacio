import React, { useMemo, useRef, useState } from "react";
import { Plus, Pencil, Printer, Download, ArrowLeft, Map as MapIcon, ClipboardPlus, ArrowRightLeft, LayoutGrid, Search } from "lucide-react";
import { useCol, actualizar, agregar, borrar } from "../backend";
import { useApp, Tarjeta, Boton, BadgeEstado, Encabezado, Dato, Vacio, Modal, Input, Area, confirmar } from "../ui";
import { estadoPotrero, estadisticasPotrero, haPotrero, fmtNum, fmtFecha, nombreUso, USOS, POTENCIAL, nombreEvento, hoy, sumarDias, diasEntre, nombreFuente, AGUA_SECA, alertaAgua } from "../logica";
import { lados, perimetro, fmtMetros, superficieHa } from "../geo";
import { Croquis, descargarSvg, imprimirCroquis } from "../Croquis";
import { MoverLote, NuevoEvento, EditarOcupacion, potrerosOrdenados, nombrePotrero } from "../acciones";
import FormPotrero from "../FormPotrero";
import { CiclosDePotrero } from "./Chacras";

export default function Potreros() {
  const { param } = useApp();
  return param ? <Ficha id={param} /> : <Lista />;
}

function Lista() {
  const { config, ir, puede } = useApp();
  const potreros = useCol("potreros");
  const ocupaciones = useCol("ocupaciones");
  const [form, setForm] = useState(false);
  const [croquis, setCroquis] = useState(false);
  const [q, setQ] = useState("");
  const [orden, setOrden] = useState("numero");
  const lista = useMemo(() => {
    let l = potrerosOrdenados(potreros, ocupaciones, config);
    if (orden === "numero") l = [...l].sort((a, b) => nombrePotrero(a.p).localeCompare(nombrePotrero(b.p), "es", { numeric: true }));
    if (q) l = l.filter((x) => nombrePotrero(x.p).toLowerCase().includes(q.toLowerCase()));
    return l;
  }, [potreros, ocupaciones, config, orden, q]);
  const haTotal = potreros.reduce((s, p) => s + haPotrero(p), 0);
  const porUso = USOS.map((u) => ({ ...u, ha: potreros.filter((p) => p.uso === u.id).reduce((s, p) => s + haPotrero(p), 0) })).filter((u) => u.ha > 0);
  return (
    <div>
      <Encabezado titulo="Potreros" sub={`${potreros.length} potreros · ${fmtNum(haTotal, 1)} ha`}>
        <Boton variante="secundario" onClick={() => setCroquis(true)} disabled={!potreros.some((p) => p.geometria)}><LayoutGrid size={18} /> Croquis del campo</Boton>
        {puede("editar") && <Boton onClick={() => setForm(true)}><Plus size={18} /> Nuevo</Boton>}
      </Encabezado>
      {porUso.length > 0 && (
        <Tarjeta className="p-4 mb-4">
          <div className="flex h-3 rounded-full overflow-hidden mb-2">{porUso.map((u) => <div key={u.id} style={{ width: (u.ha / haTotal) * 100 + "%", background: u.color }} title={u.nombre} />)}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">{porUso.map((u) => <span key={u.id} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ background: u.color }} />{u.nombre}: <b>{fmtNum(u.ha, 1)} ha</b> ({fmtNum((u.ha / haTotal) * 100)}%)</span>)}</div>
        </Tarjeta>
      )}
      {!potreros.length ? (
        <Tarjeta><Vacio icono={MapIcon} titulo="Sin potreros" texto="La forma más completa es dibujarlos en el mapa: así se calculan solas las hectáreas y los metros de alambrado." accion={<Boton onClick={() => ir("mapa")}>Ir al mapa</Boton>} /></Tarjeta>
      ) : (
        <>
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1"><Search size={18} className="absolute left-3 top-3 text-stone-400" /><input className="w-full rounded-xl border border-stone-300 pl-10 pr-3 py-2.5" placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <select className="rounded-xl border border-stone-300 px-3 bg-white" value={orden} onChange={(e) => setOrden(e.target.value)}><option value="numero">Por número</option><option value="estado">Por estado</option></select>
          </div>
          <Tarjeta className="divide-y divide-stone-100">
            {lista.map(({ p, e }) => (
              <button key={p.id} onClick={() => ir("potreros", p.id)} className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-stone-50">
                <div className="min-w-0">
                  <div className="font-semibold">{nombrePotrero(p)}</div>
                  <div className="text-sm text-stone-500 truncate">{fmtNum(haPotrero(p), 1)} ha · {nombreUso(p.uso)}{p.geometria ? ` · ${fmtMetros(perimetro(p.geometria))} de perímetro` : " · sin dibujar"}</div>
                </div>
                <div className="text-right shrink-0">
                  <BadgeEstado estado={e.estado} />
                  <div className="text-xs text-stone-500 mt-0.5">{e.estado === "ocupado" ? `${e.diasOcupado} d ocupado` : e.diasDescanso != null ? `${e.diasDescanso} d descanso` : ""}</div>
                </div>
              </button>
            ))}
          </Tarjeta>
        </>
      )}
      {form && <FormPotrero onCerrar={() => setForm(false)} onGuardado={(id) => ir("potreros", id)} />}
      {croquis && <CroquisCampo potreros={potreros} onCerrar={() => setCroquis(false)} />}
    </div>
  );
}

function CroquisCampo({ potreros, onCerrar }) {
  const { config } = useApp();
  const ref = useRef(null);
  const [conLados, setConLados] = useState(true);
  const conGeo = potreros.filter((p) => p.geometria?.length >= 3).sort((a, b) => nombrePotrero(a).localeCompare(nombrePotrero(b), "es", { numeric: true }));
  const pols = conGeo.map((p) => ({ id: p.id, nombre: nombrePotrero(p), puntos: p.geometria, color: USOS.find((u) => u.id === p.uso)?.color }));
  const titulo = `Croquis general · ${config.nombreCampo || "Don Horacio"}`;
  const tabla = `<table><tr><th>Potrero</th><th>Uso</th><th>Hectáreas</th><th>Perímetro</th></tr>${conGeo.map((p) => `<tr><td>${nombrePotrero(p)}</td><td>${nombreUso(p.uso)}</td><td>${fmtNum(superficieHa(p.geometria), 2)}</td><td>${fmtMetros(perimetro(p.geometria))}</td></tr>`).join("")}<tr><th>Total</th><th></th><th>${fmtNum(conGeo.reduce((s, p) => s + superficieHa(p.geometria), 0), 2)}</th><th></th></tr></table>`;
  return (
    <Modal titulo="Croquis del campo" onCerrar={onCerrar} ancho="max-w-5xl"
      pie={<>
        <label className="flex items-center gap-2 text-sm mr-auto"><input type="checkbox" checked={conLados} onChange={(e) => setConLados(e.target.checked)} /> Medidas de lados</label>
        <Boton variante="secundario" onClick={() => descargarSvg(ref.current, "croquis-don-horacio")}><Download size={16} /> SVG</Boton>
        <Boton onClick={() => imprimirCroquis(ref.current, titulo, tabla)}><Printer size={16} /> Imprimir / PDF</Boton>
      </>}>
      <div className="rounded-xl overflow-hidden border"><Croquis ref={ref} poligonos={pols} conLados={conLados} titulo={titulo} alto={600} /></div>
    </Modal>
  );
}

function Ficha({ id }) {
  const { config, ir, puede } = useApp();
  const potreros = useCol("potreros");
  const ocupaciones = useCol("ocupaciones");
  const eventos = useCol("eventos");
  const lluvias = useCol("lluvias");
  const lotes = useCol("lotes");
  const [tab, setTab] = useState("resumen");
  const [modal, setModal] = useState(null);
  const p = potreros.find((x) => x.id === id);
  if (!p) return <div><Boton variante="fantasma" onClick={() => ir("potreros")}><ArrowLeft size={18} /> Potreros</Boton><p className="mt-4 text-stone-500">Potrero no encontrado.</p></div>;
  const e = estadoPotrero(p, ocupaciones, config);
  const ha = haPotrero(p);
  const est = estadisticasPotrero(p, ocupaciones, sumarDias(hoy(), -365));
  const desdeLluvia = e.ultimaSalida || e.desde;
  const mmDesde = desdeLluvia ? lluvias.filter((l) => l.fecha > desdeLluvia).reduce((s, l) => s + (Number(l.mm) || 0), 0) : null;
  const propias = ocupaciones.filter((o) => o.potreroId === p.id);
  const ultima = [...propias].sort((a, b) => b.entrada.localeCompare(a.entrada))[0];

  return (
    <div>
      <Boton variante="fantasma" className="-ml-2 mb-2" onClick={() => ir("potreros")}><ArrowLeft size={18} /> Potreros</Boton>
      <Encabezado titulo={nombrePotrero(p)} sub={`${fmtNum(ha, 2)} ha · ${nombreUso(p.uso)}`}>
        {puede("registrar") && <Boton variante="secundario" onClick={() => setModal({ t: "evento" })}><ClipboardPlus size={18} /> Novedad</Boton>}
        {puede("registrar") && <Boton variante="secundario" onClick={() => setModal({ t: "mover", potreroId: e.estado === "ocupado" ? undefined : p.id, loteId: e.abiertas?.[0]?.loteId })}><ArrowRightLeft size={18} /> {e.estado === "ocupado" ? "Mover lote" : "Meter lote"}</Boton>}
        {puede("editar") && <Boton onClick={() => setModal({ t: "editar" })}><Pencil size={18} /> Editar</Boton>}
      </Encabezado>
      <div className="flex gap-1 mb-4 bg-stone-200/70 p-1 rounded-xl w-fit max-w-full overflow-x-auto">
        {[["resumen", "Resumen"], ["chacras", "Chacras"], ["croquis", "Croquis y alambrados"], ["historial", "Historial"]].map(([k, n]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${tab === k ? "bg-white shadow" : "text-stone-600"}`}>{n}</button>
        ))}
      </div>

      {tab === "resumen" && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Tarjeta className="p-4 space-y-3">
            <BadgeEstado estado={e.estado} />
            {e.estado === "ocupado" && (
              <div className="text-sm space-y-1">
                {e.abiertas.map((o) => <div key={o.id}><b>{lotes.find((l) => l.id === o.loteId)?.nombre || o.loteNombre}</b> desde el {fmtFecha(o.entrada)} ({diasEntre(o.entrada)} días){o.alturaEntrada ? ` · entró con ${o.alturaEntrada} cm` : ""}</div>)}
                <div className="text-stone-500">Ocupación máxima sugerida: {e.ocupMax} días</div>
              </div>
            )}
            {e.diasDescanso != null && e.estado !== "ocupado" && (
              <div className="text-sm">Descansa hace <b>{e.diasDescanso} días</b> (objetivo {e.objetivo}). {e.listoEl ? <>Listo el <b>{fmtFecha(e.listoEl)}</b>.</> : "Ya está listo."}</div>
            )}
            {mmDesde != null && <div className="text-sm">Llovió <b>{fmtNum(mmDesde)} mm</b> desde {e.estado === "ocupado" ? "que entraron" : "la última salida"}.</div>}
            {ultima?.alturaSalida != null && <div className="text-sm">Último remanente al salir: <b>{ultima.alturaSalida} cm</b>.</div>}
          </Tarjeta>
          <Tarjeta className="p-4 lg:col-span-2">
            <h2 className="font-semibold mb-3">Últimos 12 meses</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Dato label="Pastoreos" valor={est.pastoreos} />
              <Dato label="Días ocupado" valor={fmtNum(est.diasOcup)} sub={`${fmtNum((est.diasOcup / 365) * 100)}% del año`} />
              <Dato label="Descanso promedio" valor={est.descansoPromedio != null ? `${fmtNum(est.descansoPromedio)} d` : "—"} />
              <Dato label="Producción (EV·día/ha)" valor={est.evDiasHa != null ? fmtNum(est.evDiasHa) : "—"} sub="Carga acumulada" />
            </div>
          </Tarjeta>
          <Tarjeta className="p-4 lg:col-span-3">
            <h2 className="font-semibold mb-3">Datos del potrero</h2>
            <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">
              <Fila k="Uso" v={nombreUso(p.uso)} />
              <Fila k="Hectáreas" v={`${fmtNum(ha, 2)}${p.hectareas && p.geometria ? ` (mapa: ${fmtNum(superficieHa(p.geometria), 2)})` : ""}`} />
              <Fila k="Perímetro" v={p.geometria ? fmtMetros(perimetro(p.geometria)) : "Sin dibujar"} />
              {p.especies && <Fila k="Especies" v={p.especies} />}
              {p.fechaImplantacion && <Fila k="Implantación" v={`${fmtFecha(p.fechaImplantacion)} (${fmtNum(diasEntre(p.fechaImplantacion) / 365, 1)} años)`} />}
              <Fila k="Aguada" v={(p.fuentesAgua || []).map(nombreFuente).join(", ") || p.aguada || "Sin cargar"} />
              <Fila k="Agua en seca" v={p.aguaSeca ? <span style={{ color: AGUA_SECA[p.aguaSeca].color }} className="font-semibold">{AGUA_SECA[p.aguaSeca].nombre}</span> : "Sin calificar"} />
              <Fila k="Descanso objetivo" v={`${e.objetivo} días`} />
              <Fila k="En rotación" v={p.enRotacion === false ? "No" : "Sí"} />
              <Fila k="Potencial" v={p.potencial ? <Potencial n={p.potencial} /> : "Sin calificar"} />
            </dl>
            {p.notas && <p className="text-sm text-stone-600 mt-3 whitespace-pre-wrap">{p.notas}</p>}
          </Tarjeta>
          <AguaPotrero p={p} />
          <Comentarios potreroId={p.id} />
        </div>
      )}

      {tab === "chacras" && <CiclosDePotrero potrero={p} />}
      {tab === "croquis" && <CroquisPotrero p={p} eventos={eventos} />}

      {tab === "historial" && (
        <Historial p={p} ocupaciones={propias} eventos={eventos.filter((x) => x.potreroId === p.id)} onOcup={(o) => setModal({ t: "ocup", o })} onEvento={(ev) => setModal({ t: "evento", evento: ev })} />
      )}

      {modal?.t === "editar" && <FormPotrero potrero={p} onCerrar={() => setModal(null)} />}
      {modal?.t === "evento" && <NuevoEvento potreroId={p.id} evento={modal.evento} onCerrar={() => setModal(null)} />}
      {modal?.t === "mover" && <MoverLote potreroId={modal.potreroId} loteId={modal.loteId} onCerrar={() => setModal(null)} />}
      {modal?.t === "ocup" && <EditarOcupacion ocupacion={modal.o} onCerrar={() => setModal(null)} />}
    </div>
  );
}

export function Potencial({ n }) {
  const c = POTENCIAL[n];
  if (!c) return null;
  return (
    <span className="inline-flex items-center gap-1.5" title={`Potencial ${n} de 5 · ${c.nombre}`}>
      <span className="inline-flex gap-0.5">{[1, 2, 3, 4, 5].map((i) => <span key={i} className="w-2 h-3 rounded-sm" style={{ background: i <= n ? c.color : "#E7E5E4" }} />)}</span>
      <span>{n} · {c.nombre}</span>
    </span>
  );
}

// Comentarios con fecha: el historial de lo que se fue observando en el potrero.
export const TEMAS_COMENTARIO = { general: "General", agua: "💧 Agua", pasto: "🌱 Pasto", alambrado: "Alambrado", malezas: "Malezas" };

// Bloque de agua de la ficha: fuentes, cómo aguanta en seca, el detalle y los últimos comentarios
// con tema Agua.
function AguaPotrero({ p }) {
  const { config } = useApp();
  const lluvias = useCol("lluvias");
  const comentarios = useCol("comentarios");
  const deAgua = comentarios.filter((c) => c.potreroId === p.id && c.tema === "agua").sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 3);
  const al = alertaAgua(p, config, lluvias);
  const q = AGUA_SECA[p.aguaSeca];
  return (
    <Tarjeta className="p-4 lg:col-span-3 border-sky-200">
      <h2 className="font-semibold mb-2">💧 Agua</h2>
      <div className="text-sm space-y-1">
        <div>{(p.fuentesAgua || []).length ? (p.fuentesAgua || []).map(nombreFuente).join(" · ") : <span className="text-stone-500">Sin fuentes cargadas (Editar → Agua)</span>}</div>
        <div>En seca: {q ? <b style={{ color: q.color }}>{q.nombre} — {q.desc.toLowerCase()}</b> : <span className="text-stone-500">sin calificar</span>}</div>
        {p.aguada && <div className="text-stone-600">{p.aguada}</div>}
        {al && al.nivel !== "sin_dato" && <div className="text-amber-800 bg-amber-50 rounded-lg px-3 py-2">Época de seca ({al.motivo}): chequear el agua antes de meter un lote.</div>}
      </div>
      {deAgua.length > 0 && (
        <div className="mt-3 space-y-1">
          {deAgua.map((c) => <div key={c.id} className="text-sm"><b>{fmtFecha(c.fecha)}</b>{c.autor ? <span className="text-stone-500"> · {c.autor}</span> : null}: {c.texto}</div>)}
        </div>
      )}
    </Tarjeta>
  );
}

function Comentarios({ potreroId }) {
  const { perfil, puede } = useApp();
  const todos = useCol("comentarios");
  const [texto, setTexto] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [tema, setTema] = useState("general");
  const lista = todos.filter((c) => c.potreroId === potreroId).sort((a, b) => (b.fecha + (b.creadoEn || "")).localeCompare(a.fecha + (a.creadoEn || "")));
  const guardar = () => {
    if (!texto.trim()) return;
    agregar("comentarios", { potreroId, fecha, texto: texto.trim(), autor: perfil.nombre, tema });
    setTexto(""); setFecha(hoy()); setTema("general");
  };
  return (
    <Tarjeta className="p-4 lg:col-span-3">
      <h2 className="font-semibold mb-3">Comentarios</h2>
      {puede("registrar") && (
        <div className="space-y-2 mb-3">
          <Area value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="¿Qué viste en el potrero? (pasto, malezas, agua, alambrado…)" />
          <div className="flex gap-2 items-center flex-wrap">
            <input type="date" className="rounded-xl border border-stone-300 px-3 py-2" value={fecha} max={hoy()} onChange={(e) => setFecha(e.target.value)} />
            <select className="rounded-xl border border-stone-300 px-3 py-2 bg-white" value={tema} onChange={(e) => setTema(e.target.value)}>
              {Object.entries(TEMAS_COMENTARIO).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
            <Boton onClick={guardar} disabled={!texto.trim()}>Agregar comentario</Boton>
          </div>
        </div>
      )}
      {!lista.length && <p className="text-sm text-stone-500">Sin comentarios todavía.</p>}
      <div className="divide-y divide-stone-100">
        {lista.map((c) => (
          <div key={c.id} className="py-2 flex gap-3 justify-between">
            <div className="min-w-0">
              <div className="text-xs text-stone-500"><b className="text-stone-700">{fmtFecha(c.fecha)}</b>{c.autor ? ` · ${c.autor}` : ""}{c.tema && c.tema !== "general" ? ` · ${TEMAS_COMENTARIO[c.tema] || c.tema}` : ""}</div>
              <div className="text-sm whitespace-pre-wrap">{c.texto}</div>
            </div>
            {puede("borrar") && <button className="text-xs text-stone-400 hover:text-red-600 shrink-0" onClick={() => confirmar("¿Borrar este comentario?") && borrar("comentarios", c.id)}>Borrar</button>}
          </div>
        ))}
      </div>
    </Tarjeta>
  );
}

const Fila = ({ k, v }) => <div className="flex justify-between gap-3 border-b border-stone-100 py-1"><dt className="text-stone-500">{k}</dt><dd className="font-medium text-right">{v}</dd></div>;

function CroquisPotrero({ p, eventos }) {
  const { puede, ir } = useApp();
  const ref = useRef(null);
  const [editLado, setEditLado] = useState(null);
  const [texto, setTexto] = useState("");
  if (!p.geometria || p.geometria.length < 3) return (
    <Tarjeta><Vacio icono={MapIcon} titulo="Sin contorno" texto="Dibujá este potrero en el mapa (o recorré sus esquinas con el GPS) para tener el croquis con las medidas de cada alambrado." accion={<Boton onClick={() => ir("mapa")}>Ir al mapa</Boton>} /></Tarjeta>
  );
  const ls = lados(p.geometria);
  const notas = p.ladosNotas || {};
  const alambrados = eventos.filter((e) => e.potreroId === p.id && e.tipo === "alambrado");
  const titulo = `Potrero ${nombrePotrero(p)} · ${fmtNum(superficieHa(p.geometria), 2)} ha · perímetro ${fmtMetros(perimetro(p.geometria))}`;
  const tabla = `<table><tr><th>Lado</th><th>De → a</th><th>Metros</th><th>Rumbo</th><th>Notas</th></tr>${ls.map((l) => `<tr><td>L${l.i + 1}</td><td>V${l.i + 1} → V${((l.i + 1) % ls.length) + 1}</td><td>${Math.round(l.metros)}</td><td>${l.cardinal} (${Math.round(l.rumbo)}°)</td><td>${notas[l.i] || ""}</td></tr>`).join("")}<tr><th colspan="2">Total</th><th>${Math.round(perimetro(p.geometria))}</th><th colspan="2"></th></tr></table>`;
  return (
    <div className="grid lg:grid-cols-5 gap-4">
      <Tarjeta className="lg:col-span-3 overflow-hidden">
        <Croquis ref={ref} poligonos={[{ id: p.id, nombre: nombrePotrero(p), puntos: p.geometria, color: USOS.find((u) => u.id === p.uso)?.color }]} alto={460} />
        <div className="flex gap-2 p-3 border-t">
          <Boton chico variante="secundario" onClick={() => descargarSvg(ref.current, `croquis-potrero-${nombrePotrero(p)}`)}><Download size={16} /> SVG</Boton>
          <Boton chico onClick={() => imprimirCroquis(ref.current, titulo, tabla)}><Printer size={16} /> Imprimir / PDF</Boton>
        </div>
      </Tarjeta>
      <Tarjeta className="lg:col-span-2 p-4">
        <h2 className="font-semibold mb-1">Lados (alambrados)</h2>
        <p className="text-xs text-stone-500 mb-2">Medidos sobre el mapa. Anotá el estado de cada alambrado para tener la historia.</p>
        <div className="divide-y divide-stone-100">
          {ls.map((l) => {
            const hist = alambrados.filter((a) => String(a.lado) === String(l.i));
            return (
              <div key={l.i} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <div><b>L{l.i + 1}</b> <span className="text-stone-500 text-sm">V{l.i + 1}→V{((l.i + 1) % ls.length) + 1} · {l.cardinal}</span></div>
                  <div className="font-semibold">{fmtMetros(l.metros)}</div>
                </div>
                {editLado === l.i ? (
                  <div className="flex gap-2 mt-1">
                    <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej: 5 hilos, postes de quebracho 2019" autoFocus />
                    <Boton chico onClick={() => { actualizar("potreros", p.id, { [`ladosNotas.${l.i}`]: texto }); setEditLado(null); }}>OK</Boton>
                  </div>
                ) : (
                  <button className="text-sm text-stone-600 text-left w-full mt-0.5" disabled={!puede("registrar")} onClick={() => { setEditLado(l.i); setTexto(notas[l.i] || ""); }}>
                    {notas[l.i] || <span className="text-stone-400">{puede("registrar") ? "+ agregar nota" : ""}</span>}
                  </button>
                )}
                {hist.map((h) => <div key={h.id} className="text-xs text-stone-500">🔧 {fmtFecha(h.fecha)}: {h.descripcion}</div>)}
              </div>
            );
          })}
          <div className="py-2 flex justify-between font-semibold"><span>Perímetro total</span><span>{fmtMetros(perimetro(p.geometria))}</span></div>
        </div>
      </Tarjeta>
    </div>
  );
}

function Historial({ ocupaciones, eventos, onOcup, onEvento }) {
  const items = [
    ...ocupaciones.map((o) => ({ fecha: o.entrada, tipo: "ocup", o })),
    ...eventos.map((ev) => ({ fecha: ev.fecha, tipo: "ev", ev })),
  ].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  if (!items.length) return <Tarjeta><Vacio titulo="Sin historial" texto="Acá van a aparecer los pastoreos, siembras, fertilizaciones, aforos y todo lo que se registre de este potrero." /></Tarjeta>;
  return (
    <Tarjeta className="divide-y divide-stone-100">
      {items.map((it) => it.tipo === "ocup" ? (
        <button key={"o" + it.o.id} onClick={() => onOcup(it.o)} className="w-full text-left px-4 py-3 hover:bg-stone-50">
          <div className="text-sm"><span className="inline-block w-2 h-2 rounded-full bg-blue-600 mr-2" /><b>Pastoreo</b> · {it.o.loteNombre} · {it.o.cabezas} cab.</div>
          <div className="text-sm text-stone-600 ml-4">
            {fmtFecha(it.o.entrada)} → {it.o.salida ? fmtFecha(it.o.salida) : "sigue"} ({diasEntre(it.o.entrada, it.o.salida || hoy())} días)
            {it.o.alturaEntrada != null && ` · entró ${it.o.alturaEntrada} cm`}{it.o.alturaSalida != null && ` · salió ${it.o.alturaSalida} cm`}
          </div>
          {it.o.notas && <div className="text-sm text-stone-500 ml-4">{it.o.notas}</div>}
        </button>
      ) : (
        <button key={"e" + it.ev.id} onClick={() => onEvento(it.ev)} className="w-full text-left px-4 py-3 hover:bg-stone-50">
          <div className="text-sm"><span className="inline-block w-2 h-2 rounded-full bg-amber-600 mr-2" /><b>{nombreEvento(it.ev.tipo)}</b> · {fmtFecha(it.ev.fecha)}</div>
          <div className="text-sm text-stone-600 ml-4">
            {[it.ev.producto, it.ev.dosis, it.ev.altura && `${it.ev.altura} cm`, it.ev.kgms && `${it.ev.kgms} kg MS/ha`, it.ev.lado !== "" && it.ev.lado != null && `Lado ${Number(it.ev.lado) + 1}`].filter(Boolean).join(" · ")}
          </div>
          {it.ev.descripcion && <div className="text-sm text-stone-500 ml-4 whitespace-pre-wrap">{it.ev.descripcion}</div>}
        </button>
      ))}
    </Tarjeta>
  );
}
