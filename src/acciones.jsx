// Formularios que se usan desde varias pantallas: mover un lote, cargar lluvia, registrar una
// novedad de potrero y un movimiento de hacienda.
import React, { useMemo, useState } from "react";
import { useCol, escribir, nuevoId, agregar, actualizar, borrar, inc } from "./backend";
import { Modal, Boton, Campo, Input, Select, Area, useApp, BadgeEstado, confirmar } from "./ui";
import {
  hoy, estadoPotrero, ESTADOS, cabezasLote, evLote, fmtFecha, TIPOS_EVENTO, TIPOS_MOV_HACIENDA,
  CATEGORIAS, nombreCategoria, haPotrero, fmtNum, tipoMov,
} from "./logica";

const ORDEN_ESTADO = { listo: 0, sin_datos: 1, recuperando: 2, reciente: 3, ocupado: 4, fuera: 5 };

export function potrerosOrdenados(potreros, ocupaciones, config) {
  return potreros
    .map((p) => ({ p, e: estadoPotrero(p, ocupaciones, config) }))
    .sort((a, b) => ORDEN_ESTADO[a.e.estado] - ORDEN_ESTADO[b.e.estado] || (b.e.diasDescanso ?? -1) - (a.e.diasDescanso ?? -1) || nombrePotrero(a.p).localeCompare(nombrePotrero(b.p), "es", { numeric: true }));
}
export const nombrePotrero = (p) => (p ? (p.numero ? `${p.numero}` + (p.nombre ? ` · ${p.nombre}` : "") : p.nombre || "Sin nombre") : "—");

export function MoverLote({ loteId: loteInicial, potreroId: destinoInicial, onCerrar }) {
  const { config } = useApp();
  const lotes = useCol("lotes");
  const potreros = useCol("potreros");
  const ocupaciones = useCol("ocupaciones");
  const [loteId, setLoteId] = useState(loteInicial || "");
  const [destino, setDestino] = useState(destinoInicial || "");
  const [fecha, setFecha] = useState(hoy());
  const [altSalida, setAltSalida] = useState("");
  const [altEntrada, setAltEntrada] = useState("");
  const [notas, setNotas] = useState("");
  const lote = lotes.find((l) => l.id === loteId);
  const abierta = ocupaciones.find((o) => o.loteId === loteId && !o.salida);
  const actual = potreros.find((p) => p.id === abierta?.potreroId);
  const opciones = useMemo(() => potrerosOrdenados(potreros, ocupaciones, config), [potreros, ocupaciones, config]);
  const eDest = opciones.find((x) => x.p.id === destino);
  const error = abierta && fecha < abierta.entrada ? `La fecha no puede ser anterior a la entrada (${fmtFecha(abierta.entrada)}).` : null;

  const guardar = () => {
    const ops = [];
    if (abierta) ops.push({ op: "update", col: "ocupaciones", id: abierta.id, data: { salida: fecha, alturaSalida: altSalida ? Number(altSalida) : null } });
    if (destino) {
      ops.push({
        op: "set", col: "ocupaciones", id: nuevoId("ocupaciones"),
        data: {
          loteId, potreroId: destino, entrada: fecha, salida: null, loteNombre: lote.nombre,
          cabezas: cabezasLote(lote), ev: Math.round(evLote(lote, config) * 10) / 10,
          alturaEntrada: altEntrada ? Number(altEntrada) : null, notas, creadoEn: new Date().toISOString(),
        },
      });
    }
    ops.push({ op: "update", col: "lotes", id: loteId, data: { potreroId: destino || null, desde: fecha } });
    escribir(ops);
    onCerrar();
  };
  const activos = lotes.filter((l) => l.activo !== false).sort((a, b) => a.nombre.localeCompare(b.nombre));
  return (
    <Modal titulo={abierta ? "Mover lote" : "Ingresar lote a un potrero"} onCerrar={onCerrar}
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar} disabled={!loteId || !!error || (!destino && !abierta) || destino === abierta?.potreroId}>Guardar</Boton></>}>
      <Campo label="Lote">
        <Select value={loteId} onChange={(e) => setLoteId(e.target.value)}>
          <option value="">Elegir…</option>
          {activos.map((l) => <option key={l.id} value={l.id}>{l.nombre} ({cabezasLote(l)} cab.)</option>)}
        </Select>
      </Campo>
      {lote && (
        <p className="text-sm text-stone-600 -mt-2">
          {actual ? <>Está en <b>{nombrePotrero(actual)}</b> desde el {fmtFecha(abierta.entrada)}.</> : "Hoy no está en ningún potrero."}
        </p>
      )}
      <Campo label="Pasa al potrero">
        <Select value={destino} onChange={(e) => setDestino(e.target.value)}>
          <option value="">{abierta ? "— Sacarlo (corral, venta, fuera del campo) —" : "Elegir…"}</option>
          {opciones.filter(({ p }) => p.id !== abierta?.potreroId).map(({ p, e }) => (
            <option key={p.id} value={p.id}>
              {nombrePotrero(p)} — {ESTADOS[e.estado].nombre}{e.diasDescanso != null && e.estado !== "ocupado" ? ` (${e.diasDescanso} d de descanso)` : ""}{e.estado === "ocupado" ? " (con otro lote)" : ""}
            </option>
          ))}
        </Select>
      </Campo>
      {eDest && (
        <div className="text-sm flex flex-wrap items-center gap-2">
          <BadgeEstado estado={eDest.e.estado} />
          <span className="text-stone-600">{fmtNum(haPotrero(eDest.p), 1)} ha{lote && haPotrero(eDest.p) ? ` · carga ${fmtNum(evLote(lote, config) / haPotrero(eDest.p), 2)} EV/ha` : ""}</span>
          {eDest.e.estado === "reciente" && <span className="text-red-700">Ojo: descansó solo {eDest.e.diasDescanso} de {eDest.e.objetivo} días.</span>}
        </div>
      )}
      <Campo label="Fecha"><Input type="date" value={fecha} max={hoy()} onChange={(e) => setFecha(e.target.value)} /></Campo>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        {abierta && <Campo label="Altura pasto al salir (cm)" ayuda="Remanente que queda"><Input type="number" inputMode="decimal" value={altSalida} onChange={(e) => setAltSalida(e.target.value)} /></Campo>}
        {destino && <Campo label="Altura pasto al entrar (cm)" ayuda="Disponible en el nuevo"><Input type="number" inputMode="decimal" value={altEntrada} onChange={(e) => setAltEntrada(e.target.value)} /></Campo>}
      </div>
      <Campo label="Notas"><Area value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Estado del pasto, aguada, novedades…" /></Campo>
    </Modal>
  );
}

export function EditarOcupacion({ ocupacion: o, onCerrar }) {
  const { puede } = useApp();
  const [d, setD] = useState({ entrada: o.entrada, salida: o.salida || "", alturaEntrada: o.alturaEntrada ?? "", alturaSalida: o.alturaSalida ?? "", cabezas: o.cabezas ?? "", ev: o.ev ?? "", notas: o.notas || "" });
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const num = (v) => (v === "" ? null : Number(v));
  const guardar = () => {
    actualizar("ocupaciones", o.id, { entrada: d.entrada, salida: d.salida || null, alturaEntrada: num(d.alturaEntrada), alturaSalida: num(d.alturaSalida), cabezas: num(d.cabezas), ev: num(d.ev), notas: d.notas });
    onCerrar();
  };
  return (
    <Modal titulo={`Ocupación · ${o.loteNombre || "lote"}`} onCerrar={onCerrar}
      pie={<>
        {puede("borrar") && <Boton variante="peligro" className="mr-auto" onClick={() => { if (confirmar("¿Borrar este registro de ocupación?")) { borrar("ocupaciones", o.id); onCerrar(); } }}>Borrar</Boton>}
        <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={guardar} disabled={!puede("editar") || (d.salida && d.salida < d.entrada)}>Guardar</Boton>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Entrada"><Input type="date" value={d.entrada} onChange={set("entrada")} /></Campo>
        <Campo label="Salida" ayuda="Vacío = sigue adentro"><Input type="date" value={d.salida} onChange={set("salida")} /></Campo>
        <Campo label="Altura entrada (cm)"><Input type="number" value={d.alturaEntrada} onChange={set("alturaEntrada")} /></Campo>
        <Campo label="Altura salida (cm)"><Input type="number" value={d.alturaSalida} onChange={set("alturaSalida")} /></Campo>
        <Campo label="Cabezas"><Input type="number" value={d.cabezas} onChange={set("cabezas")} /></Campo>
        <Campo label="EV"><Input type="number" value={d.ev} onChange={set("ev")} /></Campo>
      </div>
      <Campo label="Notas"><Area value={d.notas} onChange={set("notas")} /></Campo>
      {!puede("editar") && <p className="text-xs text-stone-500">Solo el administrador o el encargado pueden corregir registros.</p>}
    </Modal>
  );
}

export function NuevaLluvia({ lluvia, onCerrar }) {
  const { puede } = useApp();
  const puntos = useCol("puntos");
  const pluvios = puntos.filter((p) => p.tipo === "pluviometro");
  const [fecha, setFecha] = useState(lluvia?.fecha || hoy());
  const [mm, setMm] = useState(lluvia?.mm ?? "");
  const [pluviometro, setPluviometro] = useState(lluvia?.pluviometro || "");
  const [notas, setNotas] = useState(lluvia?.notas || "");
  const guardar = () => {
    const data = { fecha, mm: Number(mm), pluviometro, notas };
    if (lluvia) actualizar("lluvias", lluvia.id, data); else agregar("lluvias", data);
    onCerrar();
  };
  return (
    <Modal titulo={lluvia ? "Editar lluvia" : "Registrar lluvia"} onCerrar={onCerrar}
      pie={<>
        {lluvia && puede("borrar") && <Boton variante="peligro" className="mr-auto" onClick={() => { if (confirmar("¿Borrar este registro?")) { borrar("lluvias", lluvia.id); onCerrar(); } }}>Borrar</Boton>}
        <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={guardar} disabled={mm === "" || Number(mm) < 0 || (lluvia && !puede("editar"))}>Guardar</Boton>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Fecha"><Input type="date" value={fecha} max={hoy()} onChange={(e) => setFecha(e.target.value)} /></Campo>
        <Campo label="Milímetros"><Input type="number" inputMode="decimal" step="0.5" value={mm} onChange={(e) => setMm(e.target.value)} autoFocus /></Campo>
      </div>
      {pluvios.length > 0 && (
        <Campo label="Pluviómetro">
          <Select value={pluviometro} onChange={(e) => setPluviometro(e.target.value)}>
            <option value="">Principal</option>
            {pluvios.map((p) => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
          </Select>
        </Campo>
      )}
      <Campo label="Notas"><Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Granizo, tormenta, helada…" /></Campo>
    </Modal>
  );
}

export function NuevoEvento({ potreroId: inicial, evento, onCerrar }) {
  const { puede } = useApp();
  const potreros = useCol("potreros");
  const [d, setD] = useState(evento || { potreroId: inicial || "", fecha: hoy(), tipo: "observacion", descripcion: "", producto: "", dosis: "", altura: "", lado: "" });
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const p = potreros.find((x) => x.id === d.potreroId);
  const guardar = () => {
    const { id, ...data } = d;
    if (evento) actualizar("eventos", evento.id, data); else agregar("eventos", data);
    onCerrar();
  };
  const ordenados = [...potreros].sort((a, b) => nombrePotrero(a).localeCompare(nombrePotrero(b), "es", { numeric: true }));
  return (
    <Modal titulo={evento ? "Editar novedad" : "Nueva novedad de potrero"} onCerrar={onCerrar}
      pie={<>
        {evento && puede("borrar") && <Boton variante="peligro" className="mr-auto" onClick={() => { if (confirmar("¿Borrar esta novedad?")) { borrar("eventos", evento.id); onCerrar(); } }}>Borrar</Boton>}
        <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={guardar} disabled={!d.potreroId || (evento && !puede("editar"))}>Guardar</Boton>
      </>}>
      <Campo label="Potrero">
        <Select value={d.potreroId} onChange={set("potreroId")}>
          <option value="">Elegir…</option>
          {ordenados.map((x) => <option key={x.id} value={x.id}>{nombrePotrero(x)}</option>)}
        </Select>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Fecha"><Input type="date" value={d.fecha} onChange={set("fecha")} /></Campo>
        <Campo label="Tipo"><Select value={d.tipo} onChange={set("tipo")}>{TIPOS_EVENTO.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</Select></Campo>
      </div>
      {["siembra", "resiembra", "fertilizacion", "aplicacion"].includes(d.tipo) && (
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Producto / especie"><Input value={d.producto} onChange={set("producto")} placeholder="Ej: Festuca + trébol blanco" /></Campo>
          <Campo label="Dosis"><Input value={d.dosis} onChange={set("dosis")} placeholder="Ej: 15 kg/ha" /></Campo>
        </div>
      )}
      {d.tipo === "aforo" && (
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Altura promedio (cm)"><Input type="number" value={d.altura} onChange={set("altura")} /></Campo>
          <Campo label="kg MS/ha (si se midió)"><Input type="number" value={d.kgms || ""} onChange={set("kgms")} /></Campo>
        </div>
      )}
      {d.tipo === "alambrado" && p?.geometria?.length >= 3 && (
        <Campo label="Lado del potrero">
          <Select value={d.lado} onChange={set("lado")}>
            <option value="">Todo / no aplica</option>
            {p.geometria.map((_, i) => <option key={i} value={i}>Lado {i + 1}</option>)}
          </Select>
        </Campo>
      )}
      <Campo label="Descripción"><Area value={d.descripcion} onChange={set("descripcion")} placeholder="Qué se hizo o qué se vio" /></Campo>
    </Modal>
  );
}

// Movimiento de hacienda: modifica la composición del lote con incrementos (así dos personas
// cargando a la vez sin señal no se pisan los números).
export function NuevoMovHacienda({ loteId: inicial, onCerrar }) {
  const lotes = useCol("lotes");
  const [d, setD] = useState({ loteId: inicial || "", fecha: hoy(), tipo: "nacimiento", categoria: "ternero", categoriaNueva: "novillito", cantidad: "", destinoLoteId: "", kg: "", precio: "", notas: "" });
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const lote = lotes.find((l) => l.id === d.loteId);
  const t = tipoMov(d.tipo);
  const n = Number(d.cantidad) || 0;
  const disp = Number(lote?.composicion?.[d.categoria] || 0);
  const faltan = t.signo <= 0 && n > disp;
  const guardar = () => {
    const ops = [{ op: "set", col: "movHacienda", id: nuevoId("movHacienda"), data: { ...d, cantidad: n, loteNombre: lote.nombre, creadoEn: new Date().toISOString() } }];
    const delta = { [`composicion.${d.categoria}`]: inc(t.signo === 0 ? -n : t.signo * n) };
    if (d.tipo === "recategorizacion") delta[`composicion.${d.categoriaNueva}`] = inc(n);
    ops.push({ op: "update", col: "lotes", id: d.loteId, data: delta });
    if (d.tipo === "transferencia" && d.destinoLoteId) ops.push({ op: "update", col: "lotes", id: d.destinoLoteId, data: { [`composicion.${d.categoria}`]: inc(n) } });
    escribir(ops);
    onCerrar();
  };
  return (
    <Modal titulo="Movimiento de hacienda" onCerrar={onCerrar}
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar} disabled={!lote || n <= 0 || (d.tipo === "transferencia" && !d.destinoLoteId) || faltan}>Guardar</Boton></>}>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Lote" className="col-span-2">
          <Select value={d.loteId} onChange={set("loteId")}>
            <option value="">Elegir…</option>
            {lotes.filter((l) => l.activo !== false).map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </Select>
        </Campo>
        <Campo label="Tipo"><Select value={d.tipo} onChange={set("tipo")}>{TIPOS_MOV_HACIENDA.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</Select></Campo>
        <Campo label="Fecha"><Input type="date" value={d.fecha} onChange={set("fecha")} /></Campo>
        <Campo label={d.tipo === "recategorizacion" ? "De categoría" : "Categoría"}>
          <Select value={d.categoria} onChange={set("categoria")}>{CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.nombre}{lote ? ` (${lote.composicion?.[c.id] || 0})` : ""}</option>)}</Select>
        </Campo>
        <Campo label="Cantidad"><Input type="number" inputMode="numeric" min="1" value={d.cantidad} onChange={set("cantidad")} /></Campo>
        {d.tipo === "recategorizacion" && (
          <Campo label="Pasan a" className="col-span-2"><Select value={d.categoriaNueva} onChange={set("categoriaNueva")}>{CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</Select></Campo>
        )}
        {d.tipo === "transferencia" && (
          <Campo label="Lote destino" className="col-span-2">
            <Select value={d.destinoLoteId} onChange={set("destinoLoteId")}>
              <option value="">Elegir…</option>
              {lotes.filter((l) => l.activo !== false && l.id !== d.loteId).map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </Select>
          </Campo>
        )}
        {["venta", "compra"].includes(d.tipo) && (
          <>
            <Campo label="Kg totales"><Input type="number" value={d.kg} onChange={set("kg")} /></Campo>
            <Campo label="Precio (USD/kg)"><Input type="number" step="0.01" value={d.precio} onChange={set("precio")} /></Campo>
          </>
        )}
      </div>
      {faltan && <p className="text-sm text-red-600">El lote tiene solo {disp} {nombreCategoria(d.categoria).toLowerCase()}.</p>}
      <Campo label="Notas"><Input value={d.notas} onChange={set("notas")} placeholder="Comprador, causa de muerte, caravanas…" /></Campo>
    </Modal>
  );
}

// Deshace el efecto de un movimiento sobre los lotes y lo borra.
export function revertirMovHacienda(m) {
  const t = tipoMov(m.tipo);
  const n = Number(m.cantidad) || 0;
  const delta = { [`composicion.${m.categoria}`]: inc(t.signo === 0 ? n : -t.signo * n) };
  if (m.tipo === "recategorizacion") delta[`composicion.${m.categoriaNueva}`] = inc(-n);
  const ops = [{ op: "delete", col: "movHacienda", id: m.id }, { op: "update", col: "lotes", id: m.loteId, data: delta }];
  if (m.tipo === "transferencia" && m.destinoLoteId) ops.push({ op: "update", col: "lotes", id: m.destinoLoteId, data: { [`composicion.${m.categoria}`]: inc(-n) } });
  escribir(ops);
}
