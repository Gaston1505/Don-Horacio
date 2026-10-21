// Informes anuales de monitoreo del campo (Pampa Oriental): indicadores de regeneración por año
// y el archivo del informe. Los archivos se guardan en Firestore partidos en pedazos (el plan
// gratuito de Firebase no incluye Storage).
import React, { useState } from "react";
import { Plus, FileText, Download, Leaf, Pencil, TrendingUp, TrendingDown } from "lucide-react";
import { useCol, escribir, nuevoId, leerDoc } from "../backend";
import { useApp, Tarjeta, Boton, Encabezado, Modal, Campo, Input, Area, Vacio, confirmar } from "../ui";
import { fmtNum, fmtFecha, hoy } from "../logica";

// Indicadores que se siguen año a año. "mejor" indica hacia dónde es bueno que vaya.
const INDICADORES = [
  { id: "especiesNativas", nombre: "Especies nativas", unidad: "especies", mejor: 1 },
  { id: "especiesNuevas", nombre: "Especies nuevas aparecidas", unidad: "especies", mejor: 1 },
  { id: "infiltracion", nombre: "Infiltración de agua", unidad: "mm/h", mejor: 1 },
  { id: "carbono", nombre: "Carbono en suelo", unidad: "t C/ha", mejor: 1 },
  { id: "materiaOrganica", nombre: "Materia orgánica", unidad: "%", mejor: 1 },
  { id: "sueloDesnudo", nombre: "Suelo desnudo", unidad: "%", mejor: -1 },
];
const PEDAZO = 600 * 1024; // bytes por documento (queda < 1 MB en base64)
const MAX_MB = 10;

export default function Informes() {
  const { puede } = useApp();
  const informes = useCol("informes");
  const [modal, setModal] = useState(null);
  const ordenados = [...informes].sort((a, b) => String(a.anio).localeCompare(String(b.anio)));
  const usados = INDICADORES.filter((ind) => ordenados.some((i) => i[ind.id] != null && i[ind.id] !== ""));
  return (
    <div className="space-y-4">
      <Encabezado titulo="Monitoreo del campo" sub="Informes anuales de Pampa Oriental: regeneración, especies, agua y carbono">
        {puede("editar") && <Boton onClick={() => setModal({})}><Plus size={18} /> Cargar informe</Boton>}
      </Encabezado>
      {!informes.length && <Tarjeta><Vacio icono={Leaf} titulo="Sin informes cargados" texto="Cargá cada informe anual con sus indicadores principales y el PDF. Con los años se ve la evolución del campo." /></Tarjeta>}
      {usados.length > 0 && (
        <Tarjeta className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-stone-500 border-b"><th className="p-3">Indicador</th>{ordenados.map((i) => <th key={i.id} className="p-3 text-right">{i.anio}</th>)}</tr></thead>
            <tbody>
              {usados.map((ind) => (
                <tr key={ind.id} className="border-b border-stone-100">
                  <td className="p-3"><div className="font-medium">{ind.nombre}</div><div className="text-xs text-stone-500">{ind.unidad}</div></td>
                  {ordenados.map((inf, k) => {
                    const v = inf[ind.id];
                    const prev = k > 0 ? ordenados[k - 1][ind.id] : null;
                    const dif = v != null && v !== "" && prev != null && prev !== "" ? Number(v) - Number(prev) : null;
                    const bueno = dif != null && dif * ind.mejor > 0;
                    return (
                      <td key={inf.id} className="p-3 text-right tabular-nums">
                        {v != null && v !== "" ? fmtNum(v, 2) : "—"}
                        {dif != null && dif !== 0 && <span className={`ml-1 inline-flex ${bueno ? "text-green-700" : "text-red-700"}`}>{dif > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
      )}
      <div className="grid md:grid-cols-2 gap-3">
        {[...ordenados].reverse().map((i) => (
          <Tarjeta key={i.id} className="p-4 space-y-2">
            <div className="flex justify-between gap-2">
              <div><div className="font-semibold text-lg">{i.anio}</div><div className="text-sm text-stone-500">{i.titulo || "Informe Pampa Oriental"}{i.fecha ? ` · ${fmtFecha(i.fecha)}` : ""}</div></div>
              {puede("editar") && <button className="p-2 text-stone-400 hover:text-stone-700" onClick={() => setModal({ informe: i })}><Pencil size={16} /></button>}
            </div>
            {i.resumen && <p className="text-sm text-stone-700 whitespace-pre-wrap">{i.resumen}</p>}
            <div className="flex flex-wrap gap-2">
              {i.archivoId && <ArchivoBoton id={i.archivoId} nombre={i.archivoNombre} />}
              {i.link && <a href={i.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-campo-700 underline">Abrir link</a>}
            </div>
          </Tarjeta>
        ))}
      </div>
      {modal && <FormInforme informe={modal.informe} onCerrar={() => setModal(null)} />}
    </div>
  );
}

function ArchivoBoton({ id, nombre }) {
  const [cargando, setCargando] = useState(false);
  const abrir = async () => {
    setCargando(true);
    try {
      const meta = await leerDoc("archivos", id);
      if (!meta) throw new Error("No se encontró el archivo");
      const partes = [];
      for (let k = 0; k < meta.partes; k++) partes.push((await leerDoc("archivosPartes", `${id}_${k}`))?.data || "");
      const bin = atob(partes.join(""));
      const bytes = new Uint8Array(bin.length);
      for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
      const url = URL.createObjectURL(new Blob([bytes], { type: meta.tipo || "application/pdf" }));
      const a = document.createElement("a");
      a.href = url; a.target = "_blank"; a.rel = "noreferrer";
      if (!/pdf|image/.test(meta.tipo || "")) a.download = meta.nombre || "informe";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      alert("No se pudo abrir: " + e.message + (navigator.onLine ? "" : " (sin señal: abrilo una vez con conexión)"));
    } finally { setCargando(false); }
  };
  return <Boton chico variante="secundario" onClick={abrir} disabled={cargando}><FileText size={16} /> {cargando ? "Abriendo…" : nombre || "Ver informe"}</Boton>;
}

function FormInforme({ informe, onCerrar }) {
  const { puede } = useApp();
  const [d, setD] = useState(informe || { anio: new Date().getFullYear(), fecha: hoy(), titulo: "", resumen: "", link: "" });
  const [archivo, setArchivo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const guardar = async () => {
    setGuardando(true);
    try {
      const id = informe?.id || nuevoId("informes");
      const data = { ...d };
      delete data.id;
      for (const ind of INDICADORES) data[ind.id] = d[ind.id] === "" || d[ind.id] == null ? null : Number(d[ind.id]);
      const ops = [];
      if (archivo) {
        if (archivo.size > MAX_MB * 1024 * 1024) throw new Error(`El archivo pesa más de ${MAX_MB} MB. Subilo a Google Drive y pegá el link.`);
        const buf = new Uint8Array(await archivo.arrayBuffer());
        const aid = nuevoId("archivos");
        let n = 0;
        for (let k = 0; k < buf.length; k += PEDAZO, n++) {
          let bin = "";
          const trozo = buf.subarray(k, k + PEDAZO);
          for (let j = 0; j < trozo.length; j += 8192) bin += String.fromCharCode(...trozo.subarray(j, j + 8192));
          ops.push({ op: "set", col: "archivosPartes", id: `${aid}_${n}`, data: { data: btoa(bin) } });
        }
        ops.unshift({ op: "set", col: "archivos", id: aid, data: { nombre: archivo.name, tipo: archivo.type, tam: archivo.size, partes: n } });
        data.archivoId = aid; data.archivoNombre = archivo.name;
      }
      ops.push({ op: "set", col: "informes", id, data });
      // Un lote de escritura por documento grande para no pasar el límite de 10 MB por envío.
      for (const o of ops) escribir([o]);
      onCerrar();
    } catch (e) { alert(e.message); } finally { setGuardando(false); }
  };
  return (
    <Modal titulo={informe ? `Informe ${informe.anio}` : "Cargar informe anual"} onCerrar={onCerrar} ancho="max-w-2xl"
      pie={<>
        {informe && puede("borrar") && <Boton variante="peligro" className="mr-auto" onClick={() => { if (confirmar("¿Borrar este informe?")) { escribir([{ op: "delete", col: "informes", id: informe.id }]); onCerrar(); } }}>Borrar</Boton>}
        <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={guardar} disabled={!d.anio || guardando}>{guardando ? "Guardando…" : "Guardar"}</Boton>
      </>}>
      <div className="grid grid-cols-3 gap-3">
        <Campo label="Año"><Input type="number" value={d.anio} onChange={set("anio")} /></Campo>
        <Campo label="Fecha del informe"><Input type="date" value={d.fecha || ""} onChange={set("fecha")} /></Campo>
        <Campo label="Título"><Input value={d.titulo} onChange={set("titulo")} placeholder="Monitoreo 2025" /></Campo>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {INDICADORES.map((ind) => (
          <Campo key={ind.id} label={`${ind.nombre} (${ind.unidad})`}><Input type="number" step="0.01" inputMode="decimal" value={d[ind.id] ?? ""} onChange={set(ind.id)} /></Campo>
        ))}
      </div>
      <Campo label="Resumen / conclusiones"><Area rows={5} value={d.resumen} onChange={set("resumen")} placeholder="Lo más importante del informe, recomendaciones…" /></Campo>
      <Campo label={informe?.archivoId ? `Reemplazar archivo (hoy: ${informe.archivoNombre})` : "Archivo del informe (PDF, hasta 10 MB)"}>
        <input type="file" accept="application/pdf,image/*" onChange={(e) => setArchivo(e.target.files[0] || null)} className="text-sm" />
      </Campo>
      <Campo label="Link (opcional)" ayuda="Si el PDF es más grande, subilo a Google Drive y pegá el link."><Input value={d.link || ""} onChange={set("link")} placeholder="https://drive.google.com/…" /></Campo>
    </Modal>
  );
}
