import React, { useMemo, useState } from "react";
import { Plus, CloudRain } from "lucide-react";
import { useCol } from "../backend";
import { useApp, Tarjeta, Boton, Encabezado, Dato, Vacio } from "../ui";
import { hoy, sumarDias, diasEntre, fmtFecha, fmtNum, MESES_LARGOS } from "../logica";
import { NuevaLluvia } from "../acciones";

const C_ACTUAL = "#2F7D32";
const C_ANTERIOR = "#C98A1B";

export default function Lluvias() {
  const { puede } = useApp();
  const lluvias = useCol("lluvias");
  const [modal, setModal] = useState(null);
  const anios = useMemo(() => [...new Set(lluvias.map((l) => l.fecha.slice(0, 4)))].sort().reverse(), [lluvias]);
  const [anio, setAnio] = useState(hoy().slice(0, 4));
  const ant = String(Number(anio) - 1);
  const porMes = (a) => Array.from({ length: 12 }, (_, m) => lluvias.filter((l) => l.fecha.startsWith(`${a}-${String(m + 1).padStart(2, "0")}`)).reduce((s, l) => s + (Number(l.mm) || 0), 0));
  const actual = porMes(anio), previo = porMes(ant);
  const total = (a) => lluvias.filter((l) => l.fecha.startsWith(a)).reduce((s, l) => s + (Number(l.mm) || 0), 0);
  const hace30 = sumarDias(hoy(), -30);
  const ult30 = lluvias.filter((l) => l.fecha > hace30).reduce((s, l) => s + (Number(l.mm) || 0), 0);
  const ordenadas = [...lluvias].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const ultima = ordenadas[0];
  const completos = anios.filter((a) => a < hoy().slice(0, 4));
  const promedio = completos.length ? completos.reduce((s, a) => s + total(a), 0) / completos.length : null;
  // Mismo período del año anterior (hasta la misma fecha) para comparar justo
  const hastaHoyAnt = ant + hoy().slice(4);
  const acumAntMismaFecha = lluvias.filter((l) => l.fecha.startsWith(ant) && l.fecha <= hastaHoyAnt).reduce((s, l) => s + (Number(l.mm) || 0), 0);

  return (
    <div>
      <Encabezado titulo="Lluvias" sub="Registro del pluviómetro">
        {puede("registrar") && <Boton onClick={() => setModal({})}><Plus size={18} /> Registrar lluvia</Boton>}
      </Encabezado>
      {!lluvias.length ? (
        <Tarjeta><Vacio icono={CloudRain} titulo="Sin lluvias registradas" texto="Cargá cada lluvia con los milímetros del pluviómetro. Con el tiempo vas a tener el histórico mensual y anual del campo." /></Tarjeta>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Tarjeta className="p-4"><Dato label={`Acumulado ${anio}`} valor={`${fmtNum(total(anio))} mm`} sub={anio === hoy().slice(0, 4) ? `${ant} a esta fecha: ${fmtNum(acumAntMismaFecha)} mm` : null} /></Tarjeta>
            <Tarjeta className="p-4"><Dato label="Últimos 30 días" valor={`${fmtNum(ult30)} mm`} /></Tarjeta>
            <Tarjeta className="p-4"><Dato label="Última lluvia" valor={ultima ? `${fmtNum(ultima.mm, 1)} mm` : "—"} sub={ultima ? `${fmtFecha(ultima.fecha)} · hace ${diasEntre(ultima.fecha)} días` : null} /></Tarjeta>
            <Tarjeta className="p-4"><Dato label="Promedio anual" valor={promedio != null ? `${fmtNum(promedio)} mm` : "—"} sub={completos.length ? `${completos.length} año(s) completos` : "Se calcula con años completos"} /></Tarjeta>
          </div>
          <Tarjeta className="p-4 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h2 className="font-semibold">Milímetros por mes</h2>
              <select className="border rounded-lg px-2 py-1 text-sm" value={anio} onChange={(e) => setAnio(e.target.value)}>
                {[...new Set([hoy().slice(0, 4), ...anios])].map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div className="flex gap-4 text-xs text-stone-600 mb-2">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: C_ACTUAL }} />{anio}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: C_ANTERIOR }} />{ant}</span>
            </div>
            <GraficoMensual actual={actual} previo={previo} anio={anio} ant={ant} />
          </Tarjeta>
          <Tarjeta className="divide-y divide-stone-100">
            {ordenadas.slice(0, 200).map((l) => (
              <button key={l.id} onClick={() => setModal({ lluvia: l })} className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-stone-50">
                <div>
                  <div className="font-medium">{fmtFecha(l.fecha)}</div>
                  {(l.notas || l.pluviometro) && <div className="text-sm text-stone-500">{[l.pluviometro, l.notas].filter(Boolean).join(" · ")}</div>}
                </div>
                <div className="font-bold text-lg">{fmtNum(l.mm, 1)} <span className="text-sm font-normal text-stone-500">mm</span></div>
              </button>
            ))}
          </Tarjeta>
        </>
      )}
      {modal && <NuevaLluvia lluvia={modal.lluvia} onCerrar={() => setModal(null)} />}
    </div>
  );
}

function GraficoMensual({ actual, previo, anio, ant }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(10, ...actual, ...previo);
  const paso = max > 200 ? 100 : max > 100 ? 50 : 25;
  const tope = Math.ceil(max / paso) * paso;
  const W = 720, H = 240, PL = 36, PB = 24, PT = 8;
  const ah = H - PB - PT, aw = W - PL;
  const grupo = aw / 12, barra = Math.min(22, (grupo - 10) / 2);
  const y = (v) => PT + ah - (v / tope) * ah;
  const rect = (x, v, color) => {
    const h = (v / tope) * ah;
    if (h <= 0) return null;
    const r = Math.min(4, h);
    return <path d={`M${x},${y(0)} v${-(h - r)} q0,${-r} ${r},${-r} h${barra - 2 * r} q${r},0 ${r},${r} v${h - r} z`} fill={color} />;
  };
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Lluvia mensual ${anio} y ${ant}`}>
        {Array.from({ length: tope / paso + 1 }, (_, i) => i * paso).map((v) => (
          <g key={v}>
            <line x1={PL} x2={W} y1={y(v)} y2={y(v)} stroke="#e7e5e4" strokeWidth="1" />
            <text x={PL - 6} y={y(v) + 4} fontSize="11" textAnchor="end" fill="#78716c">{v}</text>
          </g>
        ))}
        {actual.map((v, m) => {
          const x0 = PL + m * grupo + (grupo - 2 * barra - 2) / 2;
          return (
            <g key={m} onMouseEnter={() => setHover(m)} onMouseLeave={() => setHover(null)} onClick={() => setHover(m)}>
              <rect x={PL + m * grupo} y={PT} width={grupo} height={ah} fill={hover === m ? "#f5f5f4" : "transparent"} />
              {rect(x0, previo[m], C_ANTERIOR)}
              {rect(x0 + barra + 2, v, C_ACTUAL)}
              <text x={PL + m * grupo + grupo / 2} y={H - 6} fontSize="11" textAnchor="middle" fill="#78716c">{MESES_LARGOS[m].slice(0, 3)}</text>
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div className="absolute top-0 bg-white border border-stone-200 rounded-lg shadow px-3 py-2 text-sm pointer-events-none" style={{ left: `min(calc(${((PL + hover * grupo + grupo) / W) * 100}% + 4px), calc(100% - 150px))` }}>
          <div className="font-semibold">{MESES_LARGOS[hover]}</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: C_ACTUAL }} />{anio}: <b>{fmtNum(actual[hover], 1)} mm</b></div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: C_ANTERIOR }} />{ant}: <b>{fmtNum(previo[hover], 1)} mm</b></div>
        </div>
      )}
    </div>
  );
}
