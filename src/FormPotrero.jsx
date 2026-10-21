import React, { useState } from "react";
import { agregar, actualizar, borrar, useCol } from "./backend";
import { Modal, Boton, Campo, Input, Select, Area, useApp, confirmar } from "./ui";
import { USOS } from "./logica";
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
  });
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
      <Campo label="Aguada"><Input value={d.aguada} onChange={set("aguada")} placeholder="Tajamar, arroyo, bebedero compartido con el 8…" /></Campo>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.enRotacion} onChange={set("enRotacion")} className="w-5 h-5" /> Entra en la rotación de pastoreo</label>
      <Campo label="Notas"><Area value={d.notas} onChange={set("notas")} /></Campo>
    </Modal>
  );
}
