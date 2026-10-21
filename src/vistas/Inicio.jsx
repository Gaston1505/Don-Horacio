import React, { useMemo, useState } from "react";
import { ArrowRightLeft, CloudRain, ClipboardPlus, Beef, AlertTriangle, Sparkles, MapPin } from "lucide-react";
import { useCol, MODO_PRUEBA } from "../backend";
import { useApp, Tarjeta, Boton, BadgeEstado, Dato, Encabezado } from "../ui";
import { estadoPotrero, cabezasLote, evLote, haPotrero, fmtNum, fmtFecha, diasEntre, hoy, nombreEvento } from "../logica";
import { MoverLote, NuevaLluvia, NuevoEvento, NuevoMovHacienda, potrerosOrdenados, nombrePotrero } from "../acciones";
import { cargarDatosDeEjemplo } from "../demo";
import { calcularVenta, estadoCobro } from "./Ventas";

export default function Inicio() {
  const { perfil, config, ir, puede } = useApp();
  const ventas = useCol("ventas", puede("dinero"));
  const potreros = useCol("potreros");
  const lotes = useCol("lotes");
  const ocupaciones = useCol("ocupaciones");
  const lluvias = useCol("lluvias");
  const eventos = useCol("eventos");
  const [modal, setModal] = useState(null);

  const activos = lotes.filter((l) => l.activo !== false);
  const cabezas = activos.reduce((s, l) => s + cabezasLote(l), 0);
  const ev = activos.reduce((s, l) => s + evLote(l, config), 0);
  const haGanaderas = potreros.filter((p) => p.enRotacion !== false).reduce((s, p) => s + haPotrero(p), 0);
  const estados = useMemo(() => potreros.map((p) => ({ p, e: estadoPotrero(p, ocupaciones, config) })), [potreros, ocupaciones, config]);
  const cuenta = (k) => estados.filter((x) => x.e.estado === k).length;
  const anio = hoy().slice(0, 4);
  const mes = hoy().slice(0, 7);
  const mmAnio = lluvias.filter((l) => l.fecha?.startsWith(anio)).reduce((s, l) => s + (Number(l.mm) || 0), 0);
  const mmMes = lluvias.filter((l) => l.fecha?.startsWith(mes)).reduce((s, l) => s + (Number(l.mm) || 0), 0);
  const ultimaLluvia = [...lluvias].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];

  const alertas = [];
  for (const { p, e } of estados) {
    if (e.estado === "ocupado" && e.diasOcupado > e.ocupMax) alertas.push({ texto: `${nombrePotrero(p)}: lleva ${e.diasOcupado} días ocupado (máximo sugerido ${e.ocupMax}).`, ir: () => ir("potreros", p.id) });
  }
  // Cobros de ventas que vencen en la próxima semana (solo para quien ve plata)
  for (const v of ventas) {
    if (v.cobrada || !v.fechaCobro || v.estado === "simulacion" || diasEntre(hoy(), v.fechaCobro) > 7) continue;
    alertas.push({ texto: `Cobro de ${v.firma} (liq. ${v.nroLiquidacion || "—"}): USD ${fmtNum(calcularVenta(v).neto)} · ${estadoCobro(v).texto.toLowerCase()}.`, ir: () => ir("ventas", v.id) });
  }
  for (const l of activos) if (!l.potreroId && cabezasLote(l) > 0) alertas.push({ texto: `El lote ${l.nombre} no está asignado a ningún potrero.`, ir: () => setModal({ t: "mover", loteId: l.id }) });
  const recomendados = potrerosOrdenados(potreros, ocupaciones, config).filter((x) => x.e.estado === "listo").slice(0, 5);
  const ultimos = [...eventos].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")).slice(0, 5);

  const vacio = !potreros.length && !lotes.length;
  return (
    <div>
      <Encabezado titulo={`Hola, ${perfil.nombre?.split(" ")[0] || ""}`} sub={new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Accion icono={ArrowRightLeft} texto="Mover lote" onClick={() => setModal({ t: "mover" })} />
        <Accion icono={CloudRain} texto="Lluvia" onClick={() => setModal({ t: "lluvia" })} />
        <Accion icono={ClipboardPlus} texto="Novedad potrero" onClick={() => setModal({ t: "evento" })} />
        <Accion icono={Beef} texto="Mov. hacienda" onClick={() => setModal({ t: "hacienda" })} />
      </div>

      {vacio && (
        <Tarjeta className="p-5 mb-4">
          <h2 className="font-semibold mb-1">Para empezar</h2>
          <ol className="text-sm text-stone-600 list-decimal ml-5 space-y-1">
            <li>En <b>Mapa</b>, dibujá cada potrero sobre la foto satelital (o importá un KML de Google Earth).</li>
            <li>En <b>Hacienda</b>, creá los lotes con su composición (vacas, terneros…).</li>
            <li>Con <b>Mover lote</b> registrás cada entrada y salida: la app calcula ocupación y descanso solita.</li>
          </ol>
          <div className="flex flex-wrap gap-2 mt-4">
            <Boton onClick={() => ir("mapa")}><MapPin size={18} /> Ir al mapa</Boton>
            {MODO_PRUEBA && <Boton variante="secundario" onClick={cargarDatosDeEjemplo}><Sparkles size={18} /> Cargar datos de ejemplo</Boton>}
          </div>
        </Tarjeta>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Tarjeta className="p-4"><Dato label="Cabezas" valor={fmtNum(cabezas)} sub={`${fmtNum(ev, 0)} EV en ${activos.length} lotes`} /></Tarjeta>
        <Tarjeta className="p-4"><Dato label="Carga global" valor={haGanaderas ? `${fmtNum(ev / haGanaderas, 2)} EV/ha` : "—"} sub={`${fmtNum(haGanaderas, 0)} ha en rotación`} /></Tarjeta>
        <Tarjeta className="p-4 cursor-pointer" onClick={() => ir("rotacion")}><Dato label="Potreros" valor={`${cuenta("ocupado")} ocupados`} sub={`${cuenta("listo")} listos · ${cuenta("recuperando") + cuenta("reciente")} en descanso`} /></Tarjeta>
        <Tarjeta className="p-4 cursor-pointer" onClick={() => ir("lluvias")}><Dato label={`Lluvia ${anio}`} valor={`${fmtNum(mmAnio)} mm`} sub={`Este mes ${fmtNum(mmMes)} mm${ultimaLluvia ? ` · última hace ${diasEntre(ultimaLluvia.fecha)} d` : ""}`} /></Tarjeta>
      </div>

      {alertas.length > 0 && (
        <Tarjeta className="p-4 mb-4 border-amber-300 bg-amber-50">
          <h2 className="font-semibold flex items-center gap-2 mb-2 text-amber-900"><AlertTriangle size={18} /> Para atender</h2>
          <ul className="space-y-1">
            {alertas.map((a, i) => <li key={i}><button className="text-left text-sm text-amber-900 hover:underline" onClick={a.ir}>• {a.texto}</button></li>)}
          </ul>
        </Tarjeta>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Tarjeta className="p-4">
          <h2 className="font-semibold mb-3">Dónde está cada lote</h2>
          {!activos.length && <p className="text-sm text-stone-500">Todavía no hay lotes.</p>}
          <div className="divide-y divide-stone-100">
            {activos.map((l) => {
              const p = potreros.find((x) => x.id === l.potreroId);
              const o = ocupaciones.find((x) => x.loteId === l.id && !x.salida);
              const ha = haPotrero(p);
              return (
                <div key={l.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{l.nombre} <span className="text-stone-500 font-normal">· {cabezasLote(l)} cab.</span></div>
                    <div className="text-sm text-stone-500">
                      {p ? <>{nombrePotrero(p)} · {diasEntre(o?.entrada || l.desde)} días{ha ? ` · ${fmtNum(evLote(l, config) / ha, 2)} EV/ha` : ""}</> : "Sin potrero"}
                    </div>
                  </div>
                  <Boton chico variante="secundario" onClick={() => setModal({ t: "mover", loteId: l.id })}>Mover</Boton>
                </div>
              );
            })}
          </div>
        </Tarjeta>

        <Tarjeta className="p-4">
          <h2 className="font-semibold mb-1">Próximos potreros recomendados</h2>
          <p className="text-xs text-stone-500 mb-3">Los que cumplieron su descanso objetivo, del más descansado al menos.</p>
          {!recomendados.length && <p className="text-sm text-stone-500">Ningún potrero cumplió todavía el descanso objetivo.</p>}
          <div className="divide-y divide-stone-100">
            {recomendados.map(({ p, e }) => (
              <button key={p.id} className="w-full py-2.5 flex items-center justify-between gap-2 text-left" onClick={() => ir("potreros", p.id)}>
                <div>
                  <div className="font-medium">{nombrePotrero(p)}</div>
                  <div className="text-sm text-stone-500">{fmtNum(haPotrero(p), 1)} ha · {e.diasDescanso} días de descanso</div>
                </div>
                <BadgeEstado estado={e.estado} />
              </button>
            ))}
          </div>
        </Tarjeta>

        <Tarjeta className="p-4 lg:col-span-2">
          <h2 className="font-semibold mb-3">Últimas novedades</h2>
          {!ultimos.length && <p className="text-sm text-stone-500">Sin novedades cargadas.</p>}
          <div className="divide-y divide-stone-100">
            {ultimos.map((ev) => (
              <button key={ev.id} className="w-full py-2 text-left" onClick={() => ir("potreros", ev.potreroId)}>
                <div className="text-sm"><b>{nombrePotrero(potreros.find((p) => p.id === ev.potreroId))}</b> · {nombreEvento(ev.tipo)} <span className="text-stone-500">· {fmtFecha(ev.fecha)}</span></div>
                {ev.descripcion && <div className="text-sm text-stone-600 line-clamp-2">{ev.descripcion}</div>}
              </button>
            ))}
          </div>
        </Tarjeta>
      </div>

      {modal?.t === "mover" && <MoverLote loteId={modal.loteId} onCerrar={() => setModal(null)} />}
      {modal?.t === "lluvia" && <NuevaLluvia onCerrar={() => setModal(null)} />}
      {modal?.t === "evento" && <NuevoEvento onCerrar={() => setModal(null)} />}
      {modal?.t === "hacienda" && <NuevoMovHacienda onCerrar={() => setModal(null)} />}
    </div>
  );
}

function Accion({ icono: I, texto, onClick }) {
  return (
    <button onClick={onClick} className="bg-campo-700 text-white rounded-2xl p-3 flex flex-col items-center gap-1 active:scale-[.98] hover:bg-campo-900">
      <I size={24} /> <span className="text-sm font-medium">{texto}</span>
    </button>
  );
}
