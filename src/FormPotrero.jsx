import React, { useState } from "react";
import { agregar, actualizar, borrar, useCol } from "./backend";
import { Modal, Boton, Campo, Input, Select, Area, useApp, confirmar } from "./ui";
import { USOS, POTENCIAL, FUENTES_AGUA, AGUA_SECA } from "./logica";
import { superficieHa, perimetro, fmtMetros } from "./geo";

export default function FormPotrero({ potrero, geometria, onCerrar, onGuardado }) {
  const { config, puede } = useApp();
  const ocupaciones = useCol("ocupaciones");
  const geo = geometria || potrero?.geometria || null;
  const haCalc = geo?.length >= 3 ? superficieHa(geo) : null;
  const [d, setD] = useState({
    numero: potrero?.numero || "", nombre: potrero?.nombre || "", uso: potrero?.uso || "campo_natural",
    hectareas: potrero?.hectareas || "", especies: potrero?.especies || "", fechaImplantacion: potrero?.fechaImplantacion || "",
    descansoObjetivo: potrero?.descansoObjetivo || "", ocupacionMaxima: potrero?.ocupacionMaxima || "",
    enRotacion: potrero?.enRotacion !== false, aguada: potrero?.aguada || "", notas: potrero?.notas || "",
    potencial: potrero?.potencial || null,
    fuentesAgua: potrero?.fuentesAgua || [], aguaSeca: potrero?.aguaSeca || "",
  });
  const toggleFuente = (f) => setD({ ...d, fuentesAgua: d.fuentesAgua.includes(f) ? d.fuentesAgua.filter((x) => x !== f) : [...d.fuentesAgua, f] });
  const set = (k) => (e) => setD({ ...d, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const guardar = () => {
    const data = { ...d, hectareas: d.hectareas === "" ? null : Number(d.hectareas), descansoObjetivo: d.descansoObjetivo === "" ? null : Number(d.descansoObjetivo), ocupacionMaxima: d.ocupacionMaxima === "" ? null : Number(d.ocupacionMaxima) };
    if (geometria) data.geometria = geometria;
    let id = potrero?.id;
    if (potrero) actualizar("potreros", potrero.id, data);
    else id = agregar("potreros", { ...data, geometria: geometria || null, ladosNotas: {} });
    onGuardado?.(id);
    onCerrar();
  };
  const conHistorial = potrero && ocupaciones.some((o) => o.potreroId === potrero.id);
  return (
    <Modal titulo={potrero ? "Editar potrero" : "Nuevo potrero"} onCerrar={onCerrar}
      pie={<>
        {potrero && puede("borrar") && (
          <Boton variante="peligro" className="mr-auto" onClick={() => {
            if (confirmar(conHistorial ? "Este potrero tiene pastoreos registrados. Si lo borrás se pierde su historial. ¿Seguro? (Si ya no se usa, mejor sacalo de la rotación)" : "¿Borrar este potrero?")) { borrar("potreros", potrero.id); onCerrar(); }
          }}>Borrar</Boton>
        )}
        <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={guardar} disabled={!d.numero && !d.nombre}>Guardar</Boton>
      </>}>
      {geo?.length >= 3 && (
        <p className="text-sm bg-campo-100 rounded-xl px-3 py-2">Según el mapa: <b>{haCalc.toLocaleString("es", { maximumFractionDigits: 2 })} ha</b> · perímetro {fmtMetros(perimetro(geo))} · {geo.length} lados</p>
      )}
      <div className="grid grid-cols-3 gap-3">
        <Campo label="Número"><Input value={d.numero} onChange={set("numero")} placeholder="Ej: 7" /></Campo>
        <Campo label="Nombre" className="col-span-2"><Input value={d.nombre} onChange={set("nombre")} placeholder="Ej: El Bajo" /></Campo>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Uso / tipo de pastura"><Select value={d.uso} onChange={set("uso")}>{USOS.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</Select></Campo>
        <Campo label="Hectáreas" ayuda={haCalc ? "Vacío = usa la del mapa" : "Cargá la superficie o dibujalo en el mapa"}><Input type="number" step="0.01" value={d.hectareas} onChange={set("hectareas")} placeholder={haCalc ? haCalc.toFixed(2) : ""} /></Campo>
      </div>
      {d.uso !== "campo_natural" && (
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Especies"><Input value={d.especies} onChange={set("especies")} placeholder="Festuca, trébol, lotus…" /></Campo>
          <Campo label="Fecha de implantación"><Input type="date" value={d.fechaImplantacion} onChange={set("fechaImplantacion")} /></Campo>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Descanso objetivo (días)" ayuda={`Vacío = general (${config.descansoObjetivo || 45})`}><Input type="number" value={d.descansoObjetivo} onChange={set("descansoObjetivo")} /></Campo>
        <Campo label="Ocupación máxima (días)" ayuda={`Vacío = general (${config.ocupacionMaxima || 7})`}><Input type="number" value={d.ocupacionMaxima} onChange={set("ocupacionMaxima")} /></Campo>
      </div>
      <div>
        <div className="text-sm font-medium text-stone-700 mb-1">Potencial del potrero</div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setD({ ...d, potencial: d.potencial === n ? null : n })}
              className={`flex-1 rounded-xl border py-2 text-sm font-semibold ${d.potencial === n ? "text-white border-transparent" : "bg-white border-stone-300 text-stone-700"}`}
              style={d.potencial === n ? { background: POTENCIAL[n].color } : undefined}>
              {n}<span className="block text-[10px] font-normal">{POTENCIAL[n].nombre}</span>
            </button>
          ))}
        </div>
        <span className="block text-xs text-stone-500 mt-1">Pensado desde su campo natural original (suelo, relieve, agua). No depende de la pastura que tenga hoy.</span>
      </div>
      <div className="space-y-2 bg-sky-50 border border-sky-200 rounded-2xl p-3">
        <div className="text-sm font-semibold text-sky-900">💧 Agua</div>
        <div className="flex flex-wrap gap-1.5">
          {FUENTES_AGUA.map((f) => (
            <button key={f.id} type="button" onClick={() => toggleFuente(f.id)} className={`text-sm rounded-full px-3 py-1 border ${d.fuentesAgua.includes(f.id) ? "bg-sky-700 text-white border-sky-700" : "bg-white border-stone-300"}`}>{f.nombre}</button>
          ))}
        </div>
        <div>
          <div className="text-sm font-medium text-stone-700 mb-1">¿Cómo aguanta en una seca de verano?</div>
          <div className="grid grid-cols-3 gap-1.5">
            {Object.entries(AGUA_SECA).map(([k, a]) => (
              <button key={k} type="button" onClick={() => setD({ ...d, aguaSeca: d.aguaSeca === k ? "" : k })}
                className={`rounded-xl border py-2 text-sm font-semibold ${d.aguaSeca === k ? "text-white border-transparent" : "bg-white border-stone-300 text-stone-700"}`}
                style={d.aguaSeca === k ? { background: a.color } : undefined}>
                {a.nombre}<span className="block text-[10px] font-normal">{a.desc}</span>
              </button>
            ))}
          </div>
        </div>
        <Campo label="Detalle de la aguada" ayuda="Lo fijo. Lo que se vaya viendo (caudal, limpieza, roturas) va en Comentarios con el tema Agua."><Input value={d.aguada} onChange={set("aguada")} placeholder="Ej: tajamar chico al fondo, bebedero compartido con el 8" /></Campo>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.enRotacion} onChange={set("enRotacion")} className="w-5 h-5" /> Entra en la rotación de pastoreo</label>
      <Campo label="Descripción fija" ayuda="Lo que no cambia (suelo, accesos, particularidades). Las novedades van como comentarios con fecha en la ficha."><Area value={d.notas} onChange={set("notas")} /></Campo>
    </Modal>
  );
}
