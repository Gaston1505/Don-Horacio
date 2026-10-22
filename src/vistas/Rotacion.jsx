import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, Info } from "lucide-react";
import { useCol } from "../backend";
import { useApp, Tarjeta, Boton, BadgeEstado, Encabezado, Vacio } from "../ui";
import { estadoPotrero, ESTADOS, haPotrero, fmtNum, fmtFecha, hoy, sumarDias, diasEntre, evLote, cabezasLote, alertaAgua, AGUA_SECA } from "../logica";
import { MoverLote, EditarOcupacion, potrerosOrdenados, nombrePotrero } from "../acciones";

const PALETA = ["#2563EB", "#D97706", "#7C3AED", "#DB2777", "#0891B2", "#65A30D", "#DC2626", "#4F46E5", "#0D9488", "#A16207"];
export function colorLote(id, lotes) {
  const i = lotes.findIndex((l) => l.id === id);
  return PALETA[(i < 0 ? 0 : i) % PALETA.length];
}

export default function Rotacion() {
  const { config, ir } = useApp();
  const potreros = useCol("potreros");
  const lotes = useCol("lotes");
  const ocupaciones = useCol("ocupaciones");
  const lluvias = useCol("lluvias");
  const [modal, setModal] = useState(null);
  const [vista, setVista] = useState("tablero");
  const [filtro, setFiltro] = useState("todos");
  const ordenados = useMemo(() => potrerosOrdenados(potreros, ocupaciones, config), [potreros, ocupaciones, config]);
  const lotesOrd = useMemo(() => [...lotes].sort((a, b) => (a.creadoEn || "").localeCompare(b.creadoEn || "")), [lotes]);

  if (!potreros.length) return (
    <div><Encabezado titulo="Rotación" />
      <Tarjeta><Vacio icono={ArrowRightLeft} titulo="Todavía no hay potreros" texto="Cargalos desde el Mapa o desde Potreros para empezar a registrar la rotación." accion={<Boton onClick={() => ir("mapa")}>Ir al mapa</Boton>} /></Tarjeta>
    </div>
  );

  const visibles = ordenados.filter((x) => filtro === "todos" || x.e.estado === filtro);
  return (
    <div>
      <Encabezado titulo="Rotación" sub="Ocupación y descanso de cada potrero">
        <Boton onClick={() => setModal({ t: "mover" })}><ArrowRightLeft size={18} /> Mover lote</Boton>
      </Encabezado>
      <div className="flex gap-1 mb-4 bg-stone-200/70 p-1 rounded-xl w-fit">
        {[["tablero", "Tablero"], ["linea", "Línea de tiempo"], ["plan", "Planificación"]].map(([id, n]) => (
          <button key={id} onClick={() => setVista(id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${vista === id ? "bg-white shadow" : "text-stone-600"}`}>{n}</button>
        ))}
      </div>

      {vista === "tablero" && (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            {["todos", "ocupado", "listo", "recuperando", "reciente", "sin_datos", "fuera"].map((k) => {
              const n = k === "todos" ? ordenados.length : ordenados.filter((x) => x.e.estado === k).length;
              if (!n && k !== "todos") return null;
              return (
                <button key={k} onClick={() => setFiltro(k)} className={`text-sm rounded-full px-3 py-1 border ${filtro === k ? "bg-stone-900 text-white border-stone-900" : "bg-white border-stone-300"}`}>
                  {k === "todos" ? "Todos" : ESTADOS[k].nombre} ({n})
                </button>
              );
            })}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibles.map(({ p, e }) => <TarjetaPotrero key={p.id} p={p} e={e} lotes={lotes} config={config} alAgua={alertaAgua(p, config, lluvias)} onMover={(loteId) => setModal({ t: "mover", loteId, potreroId: loteId ? undefined : p.id })} onVer={() => ir("potreros", p.id)} />)}
          </div>
        </>
      )}
      {vista === "linea" && <LineaDeTiempo potreros={ordenados.map((x) => x.p)} ocupaciones={ocupaciones} lotes={lotesOrd} onOcupacion={(o) => setModal({ t: "ocup", o })} />}
      {vista === "plan" && <Planificacion ordenados={ordenados} lotes={lotes} config={config} onVer={(id) => ir("potreros", id)} />}

      {modal?.t === "mover" && <MoverLote loteId={modal.loteId} potreroId={modal.potreroId} onCerrar={() => setModal(null)} />}
      {modal?.t === "ocup" && <EditarOcupacion ocupacion={modal.o} onCerrar={() => setModal(null)} />}
    </div>
  );
}

function TarjetaPotrero({ p, e, lotes, config, alAgua, onMover, onVer }) {
  const est = ESTADOS[e.estado];
  const ha = haPotrero(p);
  const pct = e.diasDescanso != null ? Math.min(100, (e.diasDescanso / e.objetivo) * 100) : e.estado === "ocupado" ? Math.min(100, (e.diasOcupado / e.ocupMax) * 100) : 0;
  return (
    <Tarjeta className="p-4 border-l-4" style={{ borderLeftColor: est.color }}>
      <div className="flex items-start justify-between gap-2">
        <button className="text-left" onClick={onVer}>
          <div className="font-semibold text-lg leading-tight">{nombrePotrero(p)}</div>
          <div className="text-sm text-stone-500">{fmtNum(ha, 1)} ha</div>
        </button>
        <BadgeEstado estado={e.estado} />
      </div>
      {e.estado === "ocupado" && (
        <div className="mt-2 space-y-1">
          {e.abiertas.map((o) => {
            const l = lotes.find((x) => x.id === o.loteId);
            return (
              <div key={o.id} className="flex items-center justify-between text-sm">
                <span><b>{l?.nombre || o.loteNombre}</b> · {l ? cabezasLote(l) : o.cabezas} cab.{ha && l ? ` · ${fmtNum(evLote(l, config) / ha, 2)} EV/ha` : ""}</span>
                <Boton chico variante="secundario" onClick={() => onMover(o.loteId)}>Mover</Boton>
              </div>
            );
          })}
          <div className="text-sm text-stone-600">{e.diasOcupado} días ocupado (máx. {e.ocupMax}) · desde {fmtFecha(e.desde, false)}</div>
        </div>
      )}
      {["listo", "recuperando", "reciente"].includes(e.estado) && (
        <div className="mt-2 text-sm text-stone-600">
          {e.diasDescanso} días de descanso de {e.objetivo}
          {e.listoEl && <> · listo el <b>{fmtFecha(e.listoEl, false)}</b></>}
        </div>
      )}
      {e.estado === "sin_datos" && <div className="mt-2 text-sm text-stone-500">Sin pastoreos registrados.</div>}
      {alAgua && ["mala", "regular"].includes(alAgua.nivel) && e.estado !== "fuera" && (
        <div className="mt-2 text-xs font-semibold" style={{ color: AGUA_SECA[alAgua.nivel].color }}>💧 Agua {AGUA_SECA[alAgua.nivel].nombre.toLowerCase()} en seca: chequear antes de entrar</div>
      )}
      {e.estado !== "fuera" && (
        <div className="h-1.5 bg-stone-100 rounded-full mt-3 overflow-hidden"><div className="h-full rounded-full" style={{ width: pct + "%", background: est.color }} /></div>
      )}
      {e.estado !== "ocupado" && e.estado !== "fuera" && (
        <Boton chico variante="fantasma" className="mt-2 -ml-2" onClick={() => onMover(null)}>Meter un lote acá</Boton>
      )}
    </Tarjeta>
  );
}

function LineaDeTiempo({ potreros, ocupaciones, lotes, onOcupacion }) {
  const [dias, setDias] = useState(120);
  const scrollRef = useRef(null);
  // En pantallas angostas el gráfico se desplaza: arrancar mostrando lo más reciente (hoy).
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth; }, [dias]);
  const fin = sumarDias(hoy(), 1);
  const ini = sumarDias(fin, -dias);
  const ANCHO_NOMBRE = 120;
  const x = (f) => (Math.max(0, Math.min(dias, diasEntre(ini, f))) / dias) * 100;
  // Marcas de inicio de cada mes
  const meses = [];
  for (let d = ini; d <= fin; d = sumarDias(d, 1)) if (d.endsWith("-01")) meses.push(d);
  return (
    <Tarjeta className="p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <p className="text-sm text-stone-500 flex items-center gap-1"><Info size={14} /> Cada barra es un pastoreo. Tocala para ver o corregir.</p>
        <select className="border rounded-lg px-2 py-1 text-sm" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
          <option value={60}>Últimos 2 meses</option><option value={120}>Últimos 4 meses</option><option value={365}>Último año</option><option value={730}>Últimos 2 años</option>
        </select>
      </div>
      <div ref={scrollRef} className="overflow-x-auto"><div style={{ minWidth: 640 }}>
        <div className="relative h-5 text-[11px] text-stone-500" style={{ marginLeft: ANCHO_NOMBRE }}>
          {meses.map((m) => <span key={m} className="absolute" style={{ left: x(m) + "%" }}>{fmtFecha(m).split(" ").slice(1).join(" ")}</span>)}
        </div>
        {potreros.map((p) => {
          const propias = ocupaciones.filter((o) => o.potreroId === p.id && (o.salida || fin) >= ini);
          return (
            <div key={p.id} className="flex items-center h-8 border-t border-stone-100">
              <div className="text-sm truncate pr-2 font-medium" style={{ width: ANCHO_NOMBRE }}>{nombrePotrero(p)}</div>
              <div className="relative flex-1 h-full">
                {meses.map((m) => <div key={m} className="absolute top-0 bottom-0 border-l border-stone-100" style={{ left: x(m) + "%" }} />)}
                {propias.map((o) => {
                  const a = x(o.entrada), b = x(o.salida || fin);
                  return (
                    <button key={o.id} onClick={() => onOcupacion(o)} title={`${o.loteNombre}: ${fmtFecha(o.entrada)} → ${o.salida ? fmtFecha(o.salida) : "hoy"}`}
                      className={`absolute top-1.5 bottom-1.5 rounded ${o.salida ? "" : "animate-pulse"}`}
                      style={{ left: a + "%", width: Math.max(b - a, 0.8) + "%", background: colorLote(o.loteId, lotes) }} />
                  );
                })}
                <div className="absolute top-0 bottom-0 border-l-2 border-red-500" style={{ left: x(hoy()) + "%" }} />
              </div>
            </div>
          );
        })}
        <div className="flex flex-wrap gap-3 mt-3 text-xs" style={{ marginLeft: ANCHO_NOMBRE }}>
          {lotes.map((l) => <span key={l.id} className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: colorLote(l.id, lotes) }} />{l.nombre}</span>)}
        </div>
      </div></div>
    </Tarjeta>
  );
}

// Orden en que los potreros van a ir quedando disponibles según su descanso objetivo, y cuántos
// días de pastoreo ofrece la rotación con la hacienda actual.
function Planificacion({ ordenados, lotes, config, onVer }) {
  const enRot = ordenados.filter((x) => x.e.estado !== "fuera");
  const proximos = enRot.filter((x) => x.e.estado !== "ocupado").map((x) => ({ ...x, fecha: x.e.listoEl || hoy() })).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const nLotes = lotes.filter((l) => l.activo !== false && cabezasLote(l) > 0).length || 1;
  const objetivoProm = enRot.length ? enRot.reduce((s, x) => s + x.e.objetivo, 0) / enRot.length : 45;
  const ocupProm = enRot.length ? enRot.reduce((s, x) => s + x.e.ocupMax, 0) / enRot.length : 7;
  // Regla clásica de pastoreo rotativo: nº de parcelas = (descanso / ocupación) + 1, por lote.
  const necesarios = Math.ceil((objetivoProm / ocupProm + 1) * nLotes);
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Tarjeta className="p-4 lg:col-span-2">
        <h2 className="font-semibold mb-1">Cuándo queda listo cada potrero</h2>
        <p className="text-xs text-stone-500 mb-3">Fecha en que cumple su descanso objetivo.</p>
        <div className="divide-y divide-stone-100">
          {proximos.map(({ p, e, fecha }) => (
            <button key={p.id} onClick={() => onVer(p.id)} className="w-full py-2 flex items-center justify-between text-left gap-2">
              <div><div className="font-medium">{nombrePotrero(p)}</div><div className="text-sm text-stone-500">{fmtNum(haPotrero(p), 1)} ha</div></div>
              <div className="text-right">
                <div className="text-sm font-semibold">{e.estado === "listo" || e.estado === "sin_datos" ? "Ya disponible" : fmtFecha(fecha)}</div>
                <BadgeEstado estado={e.estado} />
              </div>
            </button>
          ))}
        </div>
      </Tarjeta>
      <Tarjeta className="p-4 space-y-3">
        <h2 className="font-semibold">Diseño de la rotación</h2>
        <p className="text-sm text-stone-600">Con <b>{nLotes}</b> lote(s), descanso objetivo promedio de <b>{fmtNum(objetivoProm)}</b> días y ocupación de <b>{fmtNum(ocupProm)}</b> días, se necesitan unos <b>{necesarios}</b> potreros.</p>
        <p className="text-sm text-stone-600">Hoy hay <b>{enRot.length}</b> en rotación. {enRot.length < necesarios ? "Conviene subdividir (alambre eléctrico) o alargar la ocupación." : "Alcanza para cumplir los descansos."}</p>
        <p className="text-xs text-stone-500">Regla: potreros = descanso ÷ ocupación + 1, por cada lote. Los objetivos se ajustan por potrero (en invierno el pasto crece menos y conviene alargar el descanso).</p>
      </Tarjeta>
    </div>
  );
}
