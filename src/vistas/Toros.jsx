// Toros y temporadas de servicio: qué toros entraron a cada lote de cría, cuándo entraron y
// cuándo salieron, y la ficha de cada toro (caravanas, cabaña, a quién se compró).
import React, { useState } from "react";
import { Plus, Pencil, LogOut, LogIn } from "lucide-react";
import { useCol, agregar, actualizar, borrar } from "../backend";
import { useApp, Tarjeta, Boton, Modal, Campo, Input, Select, Area, Vacio, confirmar } from "../ui";
import { fmtFecha, fmtNum, hoy, diasEntre } from "../logica";

export const nombreToro = (t) => (t ? [t.caravanaVisual && `#${t.caravanaVisual}`, t.nombre].filter(Boolean).join(" · ") || "Toro sin caravana" : "—");

export default function Toros() {
  const { puede } = useApp();
  const toros = useCol("toros");
  const servicios = useCol("servicios");
  const lotes = useCol("lotes");
  const [modal, setModal] = useState(null);
  const activos = [...servicios].filter((s) => !s.salida);
  const pasados = [...servicios].filter((s) => s.salida).sort((a, b) => b.entrada.localeCompare(a.entrada));
  const torosOrd = [...toros].sort((a, b) => (a.activo === false) - (b.activo === false) || String(a.caravanaVisual || "").localeCompare(String(b.caravanaVisual || ""), "es", { numeric: true }));
  const enServicio = (id) => activos.find((s) => s.toroIds?.includes(id));

  const FilaServicio = ({ s }) => {
    const lote = lotes.find((l) => l.id === s.loteId);
    const hembras = (Number(lote?.composicion?.vaca) || 0) + (Number(lote?.composicion?.vaquillona) || 0);
    const n = s.toroIds?.length || 0;
    return (
      <div className="px-4 py-3 flex justify-between gap-3">
        <div className="text-sm min-w-0">
          <div className="font-semibold">{lote?.nombre || s.loteNombre}</div>
          <div className="text-stone-600">
            Entraron el {fmtFecha(s.entrada)}{s.salida ? `, salieron el ${fmtFecha(s.salida)}` : ""} · {diasEntre(s.entrada, s.salida || hoy())} días · {n} toro{n === 1 ? "" : "s"}
            {!s.salida && hembras ? ` · ${fmtNum((n / hembras) * 100, 1)}% de toros (${hembras} hembras)` : ""}
          </div>
          <div className="text-stone-500">{(s.toroIds || []).map((id) => nombreToro(toros.find((t) => t.id === id))).join(", ")}</div>
          {s.notas && <div className="text-stone-500">{s.notas}</div>}
        </div>
        <div className="flex gap-1 shrink-0 items-start">
          {!s.salida && puede("registrar") && <Boton chico variante="secundario" onClick={() => setModal({ t: "salida", s })}><LogOut size={16} /> Sacar toros</Boton>}
          {puede("editar") && <button className="p-2 text-stone-400 hover:text-stone-700" onClick={() => setModal({ t: "servicio", s })}><Pencil size={16} /></button>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Toros y servicio</h2>
        <div className="flex gap-2">
          {puede("registrar") && <Boton chico onClick={() => setModal({ t: "servicio" })}><LogIn size={16} /> Entrada de toros</Boton>}
          {puede("registrar") && <Boton chico variante="secundario" onClick={() => setModal({ t: "toro" })}><Plus size={16} /> Toro</Boton>}
        </div>
      </div>
      <Tarjeta className="divide-y divide-stone-100">
        <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-500">En servicio ahora</div>
        {!activos.length && <p className="px-4 py-3 text-sm text-stone-500">No hay toros en servicio.</p>}
        {activos.map((s) => <FilaServicio key={s.id} s={s} />)}
        {pasados.length > 0 && <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Servicios anteriores</div>}
        {pasados.slice(0, 20).map((s) => <FilaServicio key={s.id} s={s} />)}
      </Tarjeta>
      {!toros.length ? (
        <Tarjeta><Vacio titulo="Sin toros cargados" texto="Cargá cada toro con su caravana visual, su chip y de qué cabaña vino." /></Tarjeta>
      ) : (
        <Tarjeta className="divide-y divide-stone-100">
          {torosOrd.map((t) => {
            const s = enServicio(t.id);
            const nServ = servicios.filter((x) => x.toroIds?.includes(t.id)).length;
            return (
              <button key={t.id} onClick={() => setModal({ t: "toro", toro: t })} className={`w-full text-left px-4 py-3 hover:bg-stone-50 flex justify-between gap-2 ${t.activo === false ? "opacity-50" : ""}`}>
                <div className="text-sm min-w-0">
                  <div className="font-semibold">{nombreToro(t)}{t.raza ? <span className="font-normal text-stone-500"> · {t.raza}</span> : null}</div>
                  <div className="text-stone-600 truncate">{[t.caravanaChip && `Chip ${t.caravanaChip}`, t.cabana && `Cabaña ${t.cabana}`, t.vendedor && `comprado a ${t.vendedor}`, t.fechaCompra && fmtFecha(t.fechaCompra)].filter(Boolean).join(" · ") || "Sin datos de origen"}</div>
                </div>
                <div className="text-xs text-right shrink-0 text-stone-500">
                  {s ? <span className="text-blue-700 font-semibold">En servicio</span> : t.activo === false ? "Dado de baja" : "Disponible"}
                  <div>{nServ} servicio(s)</div>
                </div>
              </button>
            );
          })}
        </Tarjeta>
      )}
      {modal?.t === "toro" && <FormToro toro={modal.toro} servicios={servicios} lotes={lotes} onCerrar={() => setModal(null)} />}
      {modal?.t === "servicio" && <FormServicio servicio={modal.s} toros={toros} lotes={lotes} ocupados={activos} onCerrar={() => setModal(null)} />}
      {modal?.t === "salida" && <SalidaToros servicio={modal.s} onCerrar={() => setModal(null)} />}
    </div>
  );
}

function FormToro({ toro, servicios, lotes, onCerrar }) {
  const { puede } = useApp();
  const [d, setD] = useState(toro || { caravanaVisual: "", caravanaChip: "", nombre: "", raza: "", cabana: "", vendedor: "", fechaCompra: "", nacimiento: "", registro: "", notas: "", activo: true });
  const set = (k) => (e) => setD({ ...d, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const guardar = () => {
    const { id, ...data } = d;
    if (toro) actualizar("toros", toro.id, data); else agregar("toros", data);
    onCerrar();
  };
  const historial = toro ? servicios.filter((s) => s.toroIds?.includes(toro.id)).sort((a, b) => b.entrada.localeCompare(a.entrada)) : [];
  return (
    <Modal titulo={toro ? nombreToro(toro) : "Nuevo toro"} onCerrar={onCerrar}
      pie={<>
        {toro && puede("borrar") && <Boton variante="peligro" className="mr-auto" onClick={() => { if (confirmar("¿Borrar este toro? Si ya no está, mejor desmarcá 'activo'.")) { borrar("toros", toro.id); onCerrar(); } }}>Borrar</Boton>}
        <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={guardar} disabled={(!d.caravanaVisual && !d.nombre) || (toro && !puede("editar"))}>Guardar</Boton>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Caravana visual"><Input value={d.caravanaVisual} onChange={set("caravanaVisual")} placeholder="Ej: 1234" /></Campo>
        <Campo label="Caravana chip (RFID)"><Input value={d.caravanaChip} onChange={set("caravanaChip")} inputMode="numeric" /></Campo>
        <Campo label="Nombre / apodo"><Input value={d.nombre} onChange={set("nombre")} /></Campo>
        <Campo label="Raza"><Input value={d.raza} onChange={set("raza")} placeholder="Ej: Hereford, Angus" /></Campo>
        <Campo label="Cabaña de origen"><Input value={d.cabana} onChange={set("cabana")} /></Campo>
        <Campo label="Comprado a"><Input value={d.vendedor} onChange={set("vendedor")} placeholder="Vendedor / remate" /></Campo>
        <Campo label="Fecha de compra"><Input type="date" value={d.fechaCompra} onChange={set("fechaCompra")} /></Campo>
        <Campo label="Nacimiento"><Input type="date" value={d.nacimiento} onChange={set("nacimiento")} /></Campo>
        <Campo label="Registro genealógico (RP/HBU)" className="col-span-2"><Input value={d.registro} onChange={set("registro")} /></Campo>
      </div>
      <Campo label="Historial / notas"><Area value={d.notas} onChange={set("notas")} placeholder="Padre, DEPs, sanidad, aptitud reproductiva, problemas…" /></Campo>
      {toro && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="w-5 h-5" checked={d.activo !== false} onChange={set("activo")} /> Activo en el campo</label>}
      {historial.length > 0 && (
        <div>
          <div className="text-sm font-medium text-stone-700 mb-1">Servicios</div>
          {historial.map((s) => <div key={s.id} className="text-sm text-stone-600">• {lotes.find((l) => l.id === s.loteId)?.nombre || s.loteNombre}: {fmtFecha(s.entrada)} → {s.salida ? fmtFecha(s.salida) : "en servicio"}</div>)}
        </div>
      )}
    </Modal>
  );
}

function FormServicio({ servicio, toros, lotes, ocupados, onCerrar }) {
  const { puede } = useApp();
  const [d, setD] = useState(servicio || { loteId: "", entrada: hoy(), salida: "", toroIds: [], notas: "" });
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const ocupadoEn = (id) => ocupados.find((s) => s.id !== servicio?.id && s.toroIds?.includes(id));
  const toggle = (id) => setD({ ...d, toroIds: d.toroIds.includes(id) ? d.toroIds.filter((x) => x !== id) : [...d.toroIds, id] });
  const lote = lotes.find((l) => l.id === d.loteId);
  const guardar = () => {
    const data = { ...d, salida: d.salida || null, loteNombre: lote?.nombre || "" };
    delete data.id;
    if (servicio) actualizar("servicios", servicio.id, data); else agregar("servicios", data);
    onCerrar();
  };
  const disponibles = toros.filter((t) => t.activo !== false);
  return (
    <Modal titulo={servicio ? "Editar servicio" : "Entrada de toros a un lote"} onCerrar={onCerrar}
      pie={<>
        {servicio && puede("borrar") && <Boton variante="peligro" className="mr-auto" onClick={() => { if (confirmar("¿Borrar este registro de servicio?")) { borrar("servicios", servicio.id); onCerrar(); } }}>Borrar</Boton>}
        <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={guardar} disabled={!d.loteId || !d.toroIds.length}>Guardar</Boton>
      </>}>
      <Campo label="Lote (vacas o vaquillonas)">
        <Select value={d.loteId} onChange={set("loteId")}>
          <option value="">Elegir…</option>
          {lotes.filter((l) => l.activo !== false).map((l) => <option key={l.id} value={l.id}>{l.nombre} ({(Number(l.composicion?.vaca) || 0) + (Number(l.composicion?.vaquillona) || 0)} hembras)</option>)}
        </Select>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Entrada de los toros"><Input type="date" value={d.entrada} onChange={set("entrada")} /></Campo>
        <Campo label="Salida" ayuda="Vacío = siguen en servicio"><Input type="date" value={d.salida || ""} onChange={set("salida")} /></Campo>
      </div>
      <div>
        <div className="text-sm font-medium text-stone-700 mb-1">Toros que entran ({d.toroIds.length})</div>
        {!disponibles.length && <p className="text-sm text-stone-500">Primero cargá los toros con el botón "+ Toro".</p>}
        <div className="bg-white rounded-xl border divide-y max-h-64 overflow-y-auto">
          {disponibles.map((t) => {
            const oc = ocupadoEn(t.id);
            return (
              <label key={t.id} className={`flex items-center gap-3 px-3 py-2 text-sm ${oc ? "opacity-50" : ""}`}>
                <input type="checkbox" className="w-5 h-5" checked={d.toroIds.includes(t.id)} disabled={!!oc} onChange={() => toggle(t.id)} />
                <span className="flex-1">{nombreToro(t)}{t.caravanaChip ? <span className="text-stone-500"> · chip {t.caravanaChip}</span> : null}</span>
                {oc && <span className="text-xs">en {oc.loteNombre}</span>}
              </label>
            );
          })}
        </div>
      </div>
      <Campo label="Notas"><Input value={d.notas} onChange={set("notas")} placeholder="Revisación previa, IATF, repaso…" /></Campo>
    </Modal>
  );
}

function SalidaToros({ servicio, onCerrar }) {
  const [fecha, setFecha] = useState(hoy());
  return (
    <Modal titulo={`Sacar toros de ${servicio.loteNombre}`} onCerrar={onCerrar}
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={() => { actualizar("servicios", servicio.id, { salida: fecha }); onCerrar(); }} disabled={fecha < servicio.entrada}>Guardar</Boton></>}>
      <p className="text-sm text-stone-600">Entraron el {fmtFecha(servicio.entrada)} ({diasEntre(servicio.entrada, fecha)} días de servicio a esta fecha).</p>
      <Campo label="Fecha de salida"><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Campo>
    </Modal>
  );
}
