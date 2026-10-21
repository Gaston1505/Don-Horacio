import React, { useState } from "react";
import { Plus, Pencil, ArrowRightLeft, Beef, Trash2, ListPlus } from "lucide-react";
import { useCol, agregar, actualizar, borrar } from "../backend";
import { useApp, Tarjeta, Boton, Encabezado, Modal, Campo, Input, Area, Vacio, confirmar } from "../ui";
import { CATEGORIAS, cabezasLote, evLote, evDe, fmtNum, fmtFecha, diasEntre, haPotrero, nombreCategoria, tipoMov } from "../logica";
import { MoverLote, NuevoMovHacienda, revertirMovHacienda, nombrePotrero } from "../acciones";
import Toros from "./Toros";

export default function Hacienda() {
  const { config, puede } = useApp();
  const lotes = useCol("lotes");
  const potreros = useCol("potreros");
  const ocupaciones = useCol("ocupaciones");
  const movs = useCol("movHacienda");
  const [modal, setModal] = useState(null);
  const [verInactivos, setVerInactivos] = useState(false);
  const activos = lotes.filter((l) => l.activo !== false);
  const ev = evDe(config);
  const totales = CATEGORIAS.map((c) => ({ ...c, n: activos.reduce((s, l) => s + (Number(l.composicion?.[c.id]) || 0), 0) })).filter((c) => c.n);
  const totalCab = totales.reduce((s, c) => s + c.n, 0);
  const totalEv = totales.reduce((s, c) => s + c.n * ev[c.id], 0);
  const anio = new Date().getFullYear().toString();
  const delAnio = movs.filter((m) => m.fecha?.startsWith(anio));
  const suma = (t) => delAnio.filter((m) => m.tipo === t).reduce((s, m) => s + (Number(m.cantidad) || 0), 0);
  const vacas = activos.reduce((s, l) => s + (Number(l.composicion?.vaca) || 0), 0);
  const visibles = verInactivos ? lotes : activos;

  return (
    <div>
      <Encabezado titulo="Hacienda" sub={`${fmtNum(totalCab)} cabezas · ${fmtNum(totalEv)} EV`}>
        {puede("registrar") && <Boton variante="secundario" onClick={() => setModal({ t: "mov" })}><ListPlus size={18} /> Movimiento</Boton>}
        {puede("editar") && <Boton onClick={() => setModal({ t: "lote" })}><Plus size={18} /> Nuevo lote</Boton>}
      </Encabezado>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Tarjeta className="p-4 lg:col-span-2">
          <h2 className="font-semibold mb-3">Existencias por categoría</h2>
          {!totales.length ? <p className="text-sm text-stone-500">Sin hacienda cargada.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-stone-500"><th className="py-1">Categoría</th><th className="text-right">Cabezas</th><th className="text-right">EV/cab.</th><th className="text-right">EV</th></tr></thead>
              <tbody>
                {totales.map((c) => <tr key={c.id} className="border-t border-stone-100"><td className="py-1.5">{c.nombre}</td><td className="text-right font-semibold">{fmtNum(c.n)}</td><td className="text-right text-stone-500">{ev[c.id]}</td><td className="text-right">{fmtNum(c.n * ev[c.id], 1)}</td></tr>)}
                <tr className="border-t-2 border-stone-300 font-bold"><td className="py-1.5">Total</td><td className="text-right">{fmtNum(totalCab)}</td><td /><td className="text-right">{fmtNum(totalEv, 1)}</td></tr>
              </tbody>
            </table>
          )}
        </Tarjeta>
        <Tarjeta className="p-4">
          <h2 className="font-semibold mb-3">Movimientos {anio}</h2>
          <dl className="text-sm space-y-1">
            {[["Nacimientos", "nacimiento"], ["Compras", "compra"], ["Ventas", "venta"], ["Muertes", "muerte"], ["Consumo", "consumo"]].map(([n, t]) => (
              <div key={t} className="flex justify-between"><dt className="text-stone-500">{n}</dt><dd className="font-semibold">{fmtNum(suma(t))}</dd></div>
            ))}
            {vacas > 0 && <div className="flex justify-between border-t pt-1 mt-1"><dt className="text-stone-500">Nacimientos / vacas</dt><dd className="font-semibold">{fmtNum((suma("nacimiento") / vacas) * 100)}%</dd></div>}
            {totalCab > 0 && <div className="flex justify-between"><dt className="text-stone-500">Mortandad</dt><dd className="font-semibold">{fmtNum((suma("muerte") / totalCab) * 100, 1)}%</dd></div>}
          </dl>
        </Tarjeta>
      </div>

      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">Lotes</h2>
        {lotes.length > activos.length && <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} /> Ver lotes cerrados</label>}
      </div>
      {!visibles.length && <Tarjeta><Vacio icono={Beef} titulo="Sin lotes" texto="Un lote es un grupo de animales que se mueve junto (ej: vacas de cría, recría, toros)." /></Tarjeta>}
      <div className="grid md:grid-cols-2 gap-3 mb-6">
        {visibles.map((l) => {
          const p = potreros.find((x) => x.id === l.potreroId);
          const o = ocupaciones.find((x) => x.loteId === l.id && !x.salida);
          const ha = haPotrero(p);
          return (
            <Tarjeta key={l.id} className={`p-4 ${l.activo === false ? "opacity-60" : ""}`}>
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-semibold text-lg">{l.nombre}</div>
                  <div className="text-sm text-stone-500">{cabezasLote(l)} cab. · {fmtNum(evLote(l, config), 1)} EV</div>
                </div>
                {puede("editar") && <button className="p-2 rounded-lg hover:bg-stone-100" onClick={() => setModal({ t: "lote", lote: l })}><Pencil size={18} /></button>}
              </div>
              <div className="flex flex-wrap gap-1.5 my-2">
                {CATEGORIAS.filter((c) => l.composicion?.[c.id]).map((c) => <span key={c.id} className="text-xs bg-campo-100 rounded-full px-2 py-0.5">{l.composicion[c.id]} {c.nombre.toLowerCase()}</span>)}
              </div>
              <div className="text-sm text-stone-600">{p ? <>En <b>{nombrePotrero(p)}</b> hace {diasEntre(o?.entrada || l.desde)} días{ha ? ` · ${fmtNum(evLote(l, config) / ha, 2)} EV/ha` : ""}</> : "Sin potrero asignado"}</div>
              {l.notas && <div className="text-sm text-stone-500 mt-1">{l.notas}</div>}
              {l.activo !== false && puede("registrar") && (
                <div className="flex gap-2 mt-3">
                  <Boton chico variante="secundario" onClick={() => setModal({ t: "mover", loteId: l.id })}><ArrowRightLeft size={16} /> Mover</Boton>
                  <Boton chico variante="secundario" onClick={() => setModal({ t: "mov", loteId: l.id })}><ListPlus size={16} /> Movimiento</Boton>
                </div>
              )}
            </Tarjeta>
          );
        })}
      </div>

      <div className="mb-6"><Toros /></div>

      <h2 className="font-semibold mb-2">Últimos movimientos</h2>
      <Tarjeta className="divide-y divide-stone-100">
        {!movs.length && <p className="p-4 text-sm text-stone-500">Nacimientos, compras, ventas, muertes y cambios de categoría quedan registrados acá.</p>}
        {[...movs].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "") || (b.creadoEn || "").localeCompare(a.creadoEn || "")).slice(0, 60).map((m) => {
          const t = tipoMov(m.tipo);
          const destino = lotes.find((x) => x.id === m.destinoLoteId);
          return (
            <div key={m.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
              <div className="text-sm">
                <div><b className={t?.signo > 0 ? "text-green-700" : t?.signo < 0 ? "text-red-700" : ""}>{t?.signo > 0 ? "+" : t?.signo < 0 ? "−" : ""}{m.cantidad}</b> {nombreCategoria(m.categoria).toLowerCase()} · {t?.nombre}{m.tipo === "recategorizacion" ? ` a ${nombreCategoria(m.categoriaNueva).toLowerCase()}` : ""}{destino ? ` → ${destino.nombre}` : ""}</div>
                <div className="text-stone-500">{fmtFecha(m.fecha)} · {m.loteNombre}{m.kg ? ` · ${fmtNum(m.kg)} kg` : ""}{m.precio && puede("dinero") ? ` · USD ${m.precio}/kg` : ""}{m.notas ? ` · ${m.notas}` : ""}</div>
              </div>
              {puede("borrar") && <button className="p-2 text-stone-400 hover:text-red-600" title="Deshacer" onClick={() => confirmar("¿Deshacer este movimiento? Se corrigen las cantidades del lote.") && revertirMovHacienda(m)}><Trash2 size={16} /></button>}
            </div>
          );
        })}
      </Tarjeta>

      {modal?.t === "lote" && <FormLote lote={modal.lote} onCerrar={() => setModal(null)} />}
      {modal?.t === "mover" && <MoverLote loteId={modal.loteId} onCerrar={() => setModal(null)} />}
      {modal?.t === "mov" && <NuevoMovHacienda loteId={modal.loteId} onCerrar={() => setModal(null)} />}
    </div>
  );
}

function FormLote({ lote, onCerrar }) {
  const { puede } = useApp();
  const ocupaciones = useCol("ocupaciones");
  const [nombre, setNombre] = useState(lote?.nombre || "");
  const [notas, setNotas] = useState(lote?.notas || "");
  const [comp, setComp] = useState(lote?.composicion || {});
  const [activo, setActivo] = useState(lote?.activo !== false);
  const enPotrero = lote && ocupaciones.some((o) => o.loteId === lote.id && !o.salida);
  const guardar = () => {
    const composicion = Object.fromEntries(Object.entries(comp).map(([k, v]) => [k, Number(v) || 0]).filter(([, v]) => v > 0));
    const data = { nombre, notas, composicion, activo };
    if (lote) actualizar("lotes", lote.id, data); else agregar("lotes", { ...data, potreroId: null });
    onCerrar();
  };
  return (
    <Modal titulo={lote ? "Editar lote" : "Nuevo lote"} onCerrar={onCerrar}
      pie={<>
        {lote && puede("borrar") && <Boton variante="peligro" className="mr-auto" onClick={() => confirmar("¿Borrar el lote? Su historial de pastoreos queda en los potreros. Si ya no existe, mejor desmarcá 'activo'.") && (borrar("lotes", lote.id), onCerrar())}>Borrar</Boton>}
        <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={guardar} disabled={!nombre || (!activo && enPotrero)}>Guardar</Boton>
      </>}>
      <Campo label="Nombre"><Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Vacas de cría, Recría machos, Toros" /></Campo>
      <div>
        <div className="text-sm font-medium text-stone-700 mb-1">Composición</div>
        {lote && <p className="text-xs text-stone-500 mb-2">Para nacimientos, ventas, muertes, etc. usá "Movimiento" así queda registrado. Acá corregí solo errores de carga.</p>}
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIAS.map((c) => (
            <label key={c.id} className="text-xs">
              <span className="text-stone-600">{c.nombre}</span>
              <input type="number" min="0" inputMode="numeric" className="w-full rounded-lg border border-stone-300 px-2 py-2 text-base" value={comp[c.id] ?? ""} onChange={(e) => setComp({ ...comp, [c.id]: e.target.value })} />
            </label>
          ))}
        </div>
      </div>
      <Campo label="Notas"><Area value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Raza, caravanas, sanidad…" /></Campo>
      {lote && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="w-5 h-5" checked={activo} onChange={(e) => setActivo(e.target.checked)} /> Lote activo</label>}
      {!activo && enPotrero && <p className="text-sm text-red-600">Primero sacá el lote del potrero donde está.</p>}
    </Modal>
  );
}
