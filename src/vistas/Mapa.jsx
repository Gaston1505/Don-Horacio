import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import { kml as kmlAGeojson } from "@tmcw/togeojson";
import {
  Plus, LocateFixed, Ruler, Layers, Upload, Download, MapPin, Footprints, Check, X, Pencil, Eye, ArrowRightLeft, CloudDownload, Undo2,
} from "lucide-react";
import { useCol, agregar, actualizar, borrar, escribir, nuevoId } from "../backend";
import { useApp, Boton, Modal, Campo, Input, Select, Area, BadgeEstado, confirmar } from "../ui";
import { estadoPotrero, ESTADOS, USOS, haPotrero, fmtNum, TIPOS_PUNTO, tipoPunto, cabezasLote } from "../logica";
import { lados, centroide, limites, superficieHa, perimetro, fmtMetros, dentro, geojsonAPoligono, poligonoAGeojson, distancia } from "../geo";
import { MoverLote, nombrePotrero } from "../acciones";
import FormPotrero from "../FormPotrero";

const TILE_SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const TILE_REF = "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const CENTRO_DEFECTO = [-32.5, -56]; // Uruguay; al cargar potreros el mapa se centra en ellos

const aLatLngs = (pts) => pts.map((p) => [p.lat, p.lng]);
const dePuntosLeaflet = (lls) => lls.map((ll) => ({ lat: +ll.lat.toFixed(7), lng: +ll.lng.toFixed(7) }));

export default function Mapa() {
  const { config, puede, ir } = useApp();
  const potreros = useCol("potreros");
  const ocupaciones = useCol("ocupaciones");
  const lotes = useCol("lotes");
  const puntos = useCol("puntos");

  const divRef = useRef(null);
  const mapRef = useRef(null);
  const capasRef = useRef({});
  const centradoRef = useRef(false);
  const [colorPor, setColorPor] = useState("estado");
  const [verLados, setVerLados] = useState(true);
  const [zoom, setZoom] = useState(14);
  const [sel, setSel] = useState(null); // potrero seleccionado
  const [modo, setModo] = useState(null); // null | dibujar | editar | gps | punto
  const [editId, setEditId] = useState(null);
  const [borrador, setBorrador] = useState([]); // puntos en curso (dibujo / gps / edición)
  const [form, setForm] = useState(null);
  const [yo, setYo] = useState(null);
  const [panel, setPanel] = useState(null); // capas | importar | offline
  const [modal, setModal] = useState(null);

  // ---------- Crear el mapa una sola vez ----------
  useEffect(() => {
    const map = L.map(divRef.current, { zoomControl: false, center: config.centro ? [config.centro.lat, config.centro.lng] : CENTRO_DEFECTO, zoom: config.centro ? 14 : 7, maxZoom: 20, zoomSnap: 0.25 });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
    const sat = L.tileLayer(TILE_SAT, { maxZoom: 20, maxNativeZoom: 19, attribution: "Imágenes © Esri" }).addTo(map);
    const ref = L.tileLayer(TILE_REF, { maxZoom: 20, maxNativeZoom: 19 });
    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 20, maxNativeZoom: 19, attribution: "© OpenStreetMap" });
    capasRef.current = {
      base: { sat, osm }, ref,
      potreros: L.layerGroup().addTo(map), lados: L.layerGroup().addTo(map), puntos: L.layerGroup().addTo(map),
      borrador: L.layerGroup().addTo(map), yo: L.layerGroup().addTo(map),
    };
    map.pm.setLang("es");
    map.pm.setGlobalOptions({ snappable: true, snapDistance: 18, allowSelfIntersection: false });
    map.on("zoomend", () => setZoom(map.getZoom()));
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 50);
    return () => { map.remove(); mapRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Centrar en el campo la primera vez que hay potreros
  useEffect(() => {
    const map = mapRef.current;
    if (!map || centradoRef.current) return;
    const b = limites(potreros.map((p) => p.geometria).filter(Boolean));
    if (b) { map.invalidateSize(); map.fitBounds([[b.s, b.o], [b.n, b.e]], { padding: [30, 30] }); centradoRef.current = true; }
  }, [potreros]);

  const estados = useMemo(() => Object.fromEntries(potreros.map((p) => [p.id, estadoPotrero(p, ocupaciones, config)])), [potreros, ocupaciones, config]);

  // ---------- Dibujar potreros ----------
  useEffect(() => {
    const c = capasRef.current;
    if (!c.potreros) return;
    c.potreros.clearLayers();
    c.lados.clearLayers();
    for (const p of potreros) {
      if (!p.geometria || p.geometria.length < 3 || p.id === editId) continue;
      const e = estados[p.id];
      const color = colorPor === "estado" ? ESTADOS[e.estado].color : USOS.find((u) => u.id === p.uso)?.color || "#888";
      const pol = L.polygon(aLatLngs(p.geometria), { color: sel === p.id ? "#FACC15" : "#fff", weight: sel === p.id ? 4 : 2, fillColor: color, fillOpacity: 0.45 });
      pol.on("click", (ev) => { if (modo) return; L.DomEvent.stopPropagation(ev); setSel(p.id); });
      const ha = haPotrero(p);
      // Con el campo entero en pantalla alcanza con el número; acercando aparecen nombre y hectáreas.
      if (zoom >= 15) pol.bindTooltip(`${nombrePotrero(p)}<br><span style="font-weight:500">${fmtNum(ha, 1)} ha</span>`, { permanent: true, direction: "center", className: "dh-label", interactive: false });
      else if (zoom >= 12) pol.bindTooltip(p.numero || p.nombre || "", { permanent: true, direction: "center", className: "dh-label", interactive: false });
      pol.addTo(c.potreros);
      const mostrar = verLados && (zoom >= 15 || sel === p.id);
      if (mostrar) for (const l of lados(p.geometria)) {
        if (l.metros < 25) continue;
        L.tooltip({ permanent: true, direction: "center", className: "dh-lado", interactive: false }).setLatLng([l.medio.lat, l.medio.lng]).setContent(fmtMetros(l.metros)).addTo(c.lados);
      }
    }
  }, [potreros, estados, colorPor, verLados, zoom, sel, editId, modo]);

  // ---------- Puntos de interés ----------
  useEffect(() => {
    const c = capasRef.current;
    if (!c.puntos) return;
    c.puntos.clearLayers();
    for (const pt of puntos) {
      const t = tipoPunto(pt.tipo);
      L.marker([pt.lat, pt.lng], { icon: L.divIcon({ className: "dh-punto", html: t.emoji, iconSize: [26, 26] }), pmIgnore: true })
        .bindTooltip(pt.nombre || t.nombre, { direction: "top", offset: [0, -10] })
        .on("click", () => !modo && setModal({ t: "punto", punto: pt }))
        .addTo(c.puntos);
    }
  }, [puntos, modo]);

  // ---------- Borrador (dibujo con GPS / vista de edición) ----------
  useEffect(() => {
    const c = capasRef.current;
    if (!c.borrador || modo === "editar" || modo === "dibujar") return;
    c.borrador.clearLayers();
    if (modo === "gps" && borrador.length) {
      L.polyline(aLatLngs([...borrador, borrador[0]]), { color: "#FACC15", weight: 3, dashArray: "6 6" }).addTo(c.borrador);
      borrador.forEach((p, i) => L.circleMarker([p.lat, p.lng], { radius: 6, color: "#fff", fillColor: "#FACC15", fillOpacity: 1 }).bindTooltip(`V${i + 1}`, { permanent: true, direction: "right" }).addTo(c.borrador));
    }
  }, [borrador, modo]);

  // ---------- Click en el mapa ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const h = (ev) => {
      if (modo === "punto") { setModal({ t: "punto", punto: { lat: ev.latlng.lat, lng: ev.latlng.lng, tipo: "aguada" } }); setModo(null); }
      else if (!modo) setSel(null);
    };
    map.on("click", h);
    return () => map.off("click", h);
  }, [modo]);

  // ---------- GPS ----------
  const watchRef = useRef(null);
  const seguirme = (centrar = true) => {
    if (!navigator.geolocation) return alert("Este dispositivo no tiene GPS disponible.");
    if (watchRef.current != null) { if (centrar && yo) mapRef.current.setView([yo.lat, yo.lng], Math.max(mapRef.current.getZoom(), 16)); return; }
    let primera = centrar;
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
        setYo(p);
        if (primera) { mapRef.current?.setView([p.lat, p.lng], 17); primera = false; }
      },
      (err) => alert("No se pudo obtener la ubicación: " + err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
  };
  useEffect(() => () => watchRef.current != null && navigator.geolocation.clearWatch(watchRef.current), []);
  useEffect(() => {
    const c = capasRef.current;
    if (!c.yo) return;
    c.yo.clearLayers();
    if (!yo) return;
    L.circle([yo.lat, yo.lng], { radius: yo.acc, color: "#2563EB", weight: 1, fillOpacity: 0.1, interactive: false }).addTo(c.yo);
    L.marker([yo.lat, yo.lng], { icon: L.divIcon({ className: "", html: '<div class="dh-yo"></div>', iconSize: [18, 18] }), interactive: false, pmIgnore: true }).addTo(c.yo);
  }, [yo]);
  const dondeEstoy = yo ? potreros.find((p) => p.geometria?.length >= 3 && dentro(yo, p.geometria)) : null;

  // ---------- Modos de dibujo ----------
  const cancelarModo = () => {
    const map = mapRef.current;
    map.pm.disableDraw();
    capasRef.current.borrador.eachLayer((l) => l.pm?.disable());
    capasRef.current.borrador.clearLayers();
    map.off("pm:create");
    setModo(null); setEditId(null); setBorrador([]);
  };
  const empezarDibujo = () => {
    const map = mapRef.current;
    setSel(null); setModo("dibujar"); setBorrador([]);
    map.pm.enableDraw("Polygon", { snappable: true, templineStyle: { color: "#FACC15" }, hintlineStyle: { color: "#FACC15", dashArray: [5, 5] }, pathOptions: { color: "#FACC15" } });
    map.once("pm:drawstart", ({ workingLayer }) => {
      workingLayer.on("pm:vertexadded", () => setBorrador(dePuntosLeaflet(workingLayer.getLatLngs())));
    });
    map.once("pm:create", ({ layer }) => {
      const pts = dePuntosLeaflet(layer.getLatLngs()[0]);
      layer.remove();
      setModo(null); setBorrador([]);
      setForm({ geometria: pts });
    });
  };
  const empezarEdicion = (p) => {
    const map = mapRef.current;
    setModo("editar"); setEditId(p.id); setSel(p.id); setBorrador(p.geometria);
    const c = capasRef.current;
    c.borrador.clearLayers();
    const pol = L.polygon(aLatLngs(p.geometria), { color: "#FACC15", weight: 3, fillOpacity: 0.15 }).addTo(c.borrador);
    pol.pm.enable({ allowSelfIntersection: false, snappable: true });
    const act = () => setBorrador(dePuntosLeaflet(pol.getLatLngs()[0]));
    pol.on("pm:edit pm:markerdragend pm:vertexadded pm:vertexremoved", act);
    map.fitBounds(pol.getBounds(), { padding: [40, 40] });
  };
  const guardarEdicion = () => {
    if (borrador.length >= 3) actualizar("potreros", editId, { geometria: borrador });
    cancelarModo();
  };
  const empezarGps = () => { setSel(null); setModo("gps"); setBorrador([]); seguirme(true); };
  const marcarEsquina = () => {
    if (!yo) return alert("Esperando señal de GPS…");
    if (yo.acc > 25 && !confirmar(`La precisión del GPS ahora es de ±${Math.round(yo.acc)} m. ¿Marcar igual?`)) return;
    setBorrador((b) => [...b, { lat: +yo.lat.toFixed(7), lng: +yo.lng.toFixed(7) }]);
  };
  const terminarGps = () => { const pts = borrador; cancelarModo(); setForm({ geometria: pts }); };

  const potSel = potreros.find((p) => p.id === sel);
  const eSel = potSel && estados[potSel.id];

  const centrarCampo = () => {
    const b = limites(potreros.map((p) => p.geometria).filter(Boolean));
    if (b) mapRef.current.invalidateSize(), mapRef.current.fitBounds([[b.s, b.o], [b.n, b.e]], { padding: [30, 30] });
  };
  const cambiarBase = (k) => {
    const map = mapRef.current, c = capasRef.current;
    Object.values(c.base).forEach((l) => map.removeLayer(l));
    c.base[k].addTo(map);
  };

  return (
    <div className="relative dh-mapa">
      <div ref={divRef} className="absolute inset-0 z-0" />

      {/* Barra superior de herramientas */}
      {!modo && (
        <div className="absolute top-3 left-3 right-3 z-[500] flex flex-wrap gap-2 pointer-events-none">
          <div className="flex flex-wrap gap-2 pointer-events-auto">
            {puede("editar") && <BotonMapa icono={Plus} texto="Dibujar potrero" onClick={empezarDibujo} destacado />}
            {puede("editar") && <BotonMapa icono={Footprints} texto="Recorrer con GPS" onClick={empezarGps} />}
            {puede("registrar") && <BotonMapa icono={MapPin} texto="Punto" onClick={() => { setSel(null); setModo("punto"); }} />}
            <BotonMapa icono={Layers} texto="Capas" onClick={() => setPanel(panel === "capas" ? null : "capas")} />
            {puede("editar") && <BotonMapa icono={Upload} texto="Importar / exportar" onClick={() => setPanel("importar")} />}
            <BotonMapa icono={CloudDownload} texto="Guardar offline" onClick={() => setPanel("offline")} />
          </div>
        </div>
      )}

      <div className="absolute right-3 bottom-24 lg:bottom-28 z-[500] flex flex-col gap-2">
        <button className="bg-white rounded-full p-3 shadow-lg" onClick={() => seguirme(true)} title="Mi ubicación"><LocateFixed size={22} className={yo ? "text-blue-600" : ""} /></button>
        <button className="bg-white rounded-full p-3 shadow-lg" onClick={centrarCampo} title="Ver todo el campo"><Eye size={22} /></button>
        <button className={`rounded-full p-3 shadow-lg ${verLados ? "bg-stone-900 text-white" : "bg-white"}`} onClick={() => setVerLados(!verLados)} title="Medidas de los lados"><Ruler size={22} /></button>
      </div>

      {yo && !modo && (
        <div className="absolute top-16 left-3 z-[500] bg-white/95 rounded-xl shadow px-3 py-2 text-sm">
          {dondeEstoy ? <>Estás en <b>{nombrePotrero(dondeEstoy)}</b></> : "Fuera de los potreros dibujados"} <span className="text-stone-500">· ±{Math.round(yo.acc)} m</span>
        </div>
      )}

      {panel === "capas" && (
        <div className="absolute top-16 left-3 z-[600] bg-white rounded-2xl shadow-xl p-4 w-64 space-y-3 text-sm">
          <div>
            <div className="font-semibold mb-1">Fondo</div>
            <label className="flex gap-2 items-center"><input type="radio" name="base" defaultChecked onChange={() => cambiarBase("sat")} /> Satelital</label>
            <label className="flex gap-2 items-center"><input type="radio" name="base" onChange={() => cambiarBase("osm")} /> Mapa de caminos</label>
            <label className="flex gap-2 items-center mt-1"><input type="checkbox" onChange={(e) => e.target.checked ? capasRef.current.ref.addTo(mapRef.current) : mapRef.current.removeLayer(capasRef.current.ref)} /> Nombres de lugares</label>
          </div>
          <div>
            <div className="font-semibold mb-1">Colorear potreros por</div>
            <label className="flex gap-2 items-center"><input type="radio" checked={colorPor === "estado"} onChange={() => setColorPor("estado")} /> Estado de descanso</label>
            <label className="flex gap-2 items-center"><input type="radio" checked={colorPor === "uso"} onChange={() => setColorPor("uso")} /> Tipo de pastura</label>
          </div>
          <Leyenda colorPor={colorPor} />
          <Boton chico variante="secundario" className="w-full" onClick={() => setPanel(null)}>Cerrar</Boton>
        </div>
      )}

      {/* Barras de los modos */}
      {modo === "dibujar" && (
        <BarraModo texto={borrador.length ? `${borrador.length} puntos · ${fmtMetros(perimetroAbierto(borrador))}` : "Tocá cada esquina del potrero. Tocá el primer punto para cerrarlo. Se pega a los potreros vecinos."}>
          <Boton variante="secundario" chico onClick={cancelarModo}><X size={16} /> Cancelar</Boton>
        </BarraModo>
      )}
      {modo === "editar" && (
        <BarraModo texto={`Arrastrá los vértices. Tocá un punto medio para agregar uno; mantené apretado un vértice para quitarlo. ${fmtNum(superficieHa(borrador), 2)} ha · ${fmtMetros(perimetro(borrador))}`}>
          <Boton variante="secundario" chico onClick={cancelarModo}><X size={16} /> Cancelar</Boton>
          <Boton chico onClick={guardarEdicion}><Check size={16} /> Guardar contorno</Boton>
        </BarraModo>
      )}
      {modo === "gps" && (
        <BarraModo texto={`Andá hasta cada esquina del potrero y marcala. ${borrador.length} esquinas${borrador.length >= 3 ? ` · ${fmtNum(superficieHa(borrador), 2)} ha` : ""}${yo ? ` · GPS ±${Math.round(yo.acc)} m` : " · buscando GPS…"}`}>
          <Boton variante="secundario" chico onClick={cancelarModo}><X size={16} /></Boton>
          <Boton variante="secundario" chico onClick={() => setBorrador((b) => b.slice(0, -1))} disabled={!borrador.length}><Undo2 size={16} /></Boton>
          <Boton chico onClick={marcarEsquina}><MapPin size={16} /> Marcar esquina</Boton>
          <Boton chico onClick={terminarGps} disabled={borrador.length < 3}><Check size={16} /> Terminar</Boton>
        </BarraModo>
      )}
      {modo === "punto" && (
        <BarraModo texto="Tocá en el mapa dónde va el punto (aguada, tranquera, molino…).">
          <Boton variante="secundario" chico onClick={() => setModo(null)}><X size={16} /> Cancelar</Boton>
          {yo && <Boton chico onClick={() => { setModal({ t: "punto", punto: { lat: yo.lat, lng: yo.lng, tipo: "aguada" } }); setModo(null); }}>En mi ubicación</Boton>}
        </BarraModo>
      )}

      {/* Ficha rápida del potrero seleccionado */}
      {potSel && !modo && (
        <div className="absolute left-3 right-3 bottom-24 lg:bottom-6 lg:left-auto lg:w-96 z-[600] bg-white rounded-2xl shadow-xl p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-bold text-lg">{nombrePotrero(potSel)}</div>
              <div className="text-sm text-stone-500">{fmtNum(haPotrero(potSel), 2)} ha · perímetro {fmtMetros(perimetro(potSel.geometria))}</div>
            </div>
            <button onClick={() => setSel(null)} className="p-1"><X size={20} /></button>
          </div>
          <div className="mt-2 text-sm flex flex-wrap items-center gap-2">
            <BadgeEstado estado={eSel.estado} />
            {eSel.estado === "ocupado" && <span>{eSel.abiertas.map((o) => lotes.find((l) => l.id === o.loteId)?.nombre || o.loteNombre).join(", ")} · {eSel.diasOcupado} días</span>}
            {eSel.diasDescanso != null && eSel.estado !== "ocupado" && <span>{eSel.diasDescanso} de {eSel.objetivo} días de descanso</span>}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Boton chico onClick={() => ir("potreros", potSel.id)}>Ver ficha y croquis</Boton>
            {puede("registrar") && <Boton chico variante="secundario" onClick={() => setModal({ t: "mover", potreroId: potSel.id })}><ArrowRightLeft size={16} /> Meter lote</Boton>}
            {puede("editar") && <Boton chico variante="secundario" onClick={() => empezarEdicion(potSel)}><Pencil size={16} /> Contorno</Boton>}
          </div>
        </div>
      )}

      {form && <FormPotrero geometria={form.geometria} potrero={form.potrero} onCerrar={() => setForm(null)} onGuardado={(id) => setSel(id)} />}
      {modal?.t === "mover" && <MoverLote potreroId={modal.potreroId} onCerrar={() => setModal(null)} />}
      {modal?.t === "punto" && <FormPunto punto={modal.punto} potreros={potreros} onCerrar={() => setModal(null)} />}
      {panel === "importar" && <ImportarExportar potreros={potreros} onCerrar={() => setPanel(null)} onImportado={() => { centradoRef.current = false; }} />}
      {panel === "offline" && <GuardarOffline potreros={potreros} mapa={mapRef.current} onCerrar={() => setPanel(null)} />}
    </div>
  );
}

const perimetroAbierto = (pts) => pts.slice(1).reduce((s, p, i) => s + distancia(pts[i], p), 0);

function BotonMapa({ icono: I, texto, onClick, destacado }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 rounded-full px-3 py-2 shadow-lg text-sm font-medium ${destacado ? "bg-campo-700 text-white" : "bg-white text-stone-800"}`}>
      <I size={18} /> <span className="hidden sm:inline">{texto}</span>
    </button>
  );
}
function BarraModo({ texto, children }) {
  return (
    <div className="absolute top-3 left-3 right-3 z-[600] bg-stone-900/95 text-white rounded-2xl p-3 shadow-xl flex flex-wrap items-center gap-2 justify-between">
      <span className="text-sm flex-1 min-w-[200px]">{texto}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
function Leyenda({ colorPor }) {
  const items = colorPor === "estado" ? Object.values(ESTADOS).map((e) => [e.nombre, e.color]) : USOS.map((u) => [u.nombre, u.color]);
  return (
    <div className="space-y-1">
      {items.map(([n, c]) => <div key={n} className="flex items-center gap-2 text-xs"><span className="w-3 h-3 rounded" style={{ background: c }} />{n}</div>)}
    </div>
  );
}

function FormPunto({ punto, potreros, onCerrar }) {
  const { puede } = useApp();
  const [d, setD] = useState({ tipo: punto.tipo || "aguada", nombre: punto.nombre || "", notas: punto.notas || "" });
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const enPotrero = potreros.find((p) => p.geometria?.length >= 3 && dentro(punto, p.geometria));
  const guardar = () => {
    const data = { ...d, lat: punto.lat, lng: punto.lng, potreroId: enPotrero?.id || null };
    if (punto.id) actualizar("puntos", punto.id, data); else agregar("puntos", data);
    onCerrar();
  };
  return (
    <Modal titulo={punto.id ? tipoPunto(punto.tipo).nombre : "Nuevo punto en el mapa"} onCerrar={onCerrar}
      pie={<>
        {punto.id && puede("borrar") && <Boton variante="peligro" className="mr-auto" onClick={() => { if (confirmar("¿Borrar este punto?")) { borrar("puntos", punto.id); onCerrar(); } }}>Borrar</Boton>}
        <Boton variante="secundario" onClick={onCerrar}>Cerrar</Boton>
        <Boton onClick={guardar} disabled={punto.id && !puede("editar")}>Guardar</Boton>
      </>}>
      <Campo label="Tipo"><Select value={d.tipo} onChange={set("tipo")}>{TIPOS_PUNTO.map((t) => <option key={t.id} value={t.id}>{t.emoji} {t.nombre}</option>)}</Select></Campo>
      <Campo label="Nombre"><Input value={d.nombre} onChange={set("nombre")} placeholder="Ej: Tajamar grande" /></Campo>
      <Campo label="Notas"><Area value={d.notas} onChange={set("notas")} /></Campo>
      <p className="text-xs text-stone-500">{enPotrero ? `Dentro de ${nombrePotrero(enPotrero)} · ` : ""}{punto.lat.toFixed(6)}, {punto.lng.toFixed(6)}</p>
    </Modal>
  );
}

// ---------- Importar desde Google Earth (KML) o GeoJSON, y exportar ----------
function ImportarExportar({ potreros, onCerrar, onImportado }) {
  const [features, setFeatures] = useState(null);
  const [error, setError] = useState("");
  const leer = async (file) => {
    setError("");
    try {
      const texto = await file.text();
      let gj;
      if (/\.kml$/i.test(file.name) || texto.trim().startsWith("<")) gj = kmlAGeojson(new DOMParser().parseFromString(texto, "text/xml"));
      else gj = JSON.parse(texto);
      const lista = (gj.type === "FeatureCollection" ? gj.features : [gj])
        .map((f, i) => ({ i, nombre: String(f.properties?.name || f.properties?.nombre || f.properties?.Name || `Potrero ${i + 1}`), puntos: geojsonAPoligono(f.geometry), elegido: true }))
        .filter((f) => f.puntos);
      if (!lista.length) setError("No se encontraron polígonos en el archivo.");
      setFeatures(lista);
    } catch (e) {
      setError("No se pudo leer el archivo. Si es .kmz, abrilo en Google Earth y guardalo como .kml. (" + e.message + ")");
    }
  };
  const existente = (nombre) => potreros.find((p) => [p.nombre, p.numero, nombrePotrero(p)].filter(Boolean).map((x) => String(x).trim().toLowerCase()).includes(nombre.trim().toLowerCase()));
  const importar = () => {
    const ops = [];
    for (const f of features.filter((x) => x.elegido)) {
      const ex = existente(f.nombre);
      if (ex) ops.push({ op: "update", col: "potreros", id: ex.id, data: { geometria: f.puntos } });
      else {
        const num = f.nombre.match(/^\s*(?:potrero\s*)?(\d+)\s*$/i)?.[1];
        ops.push({ op: "set", col: "potreros", id: nuevoId("potreros"), data: { numero: num || "", nombre: num ? "" : f.nombre, uso: "campo_natural", geometria: f.puntos, enRotacion: true, ladosNotas: {}, creadoEn: new Date().toISOString() } });
      }
    }
    for (let i = 0; i < ops.length; i += 400) escribir(ops.slice(i, i + 400));
    onImportado();
    onCerrar();
  };
  const exportar = (formato) => {
    const conGeo = potreros.filter((p) => p.geometria?.length >= 3);
    let contenido, tipo, ext;
    if (formato === "geojson") {
      contenido = JSON.stringify({ type: "FeatureCollection", features: conGeo.map((p) => poligonoAGeojson(p.geometria, { name: nombrePotrero(p), hectareas: +haPotrero(p).toFixed(2), uso: p.uso })) }, null, 1);
      tipo = "application/geo+json"; ext = "geojson";
    } else {
      const esc = (s) => String(s).replace(/[<&>]/g, (c) => ({ "<": "&lt;", "&": "&amp;", ">": "&gt;" }[c]));
      contenido = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Don Horacio</name>` +
        `<Style id="p"><LineStyle><color>ffffffff</color><width>2</width></LineStyle><PolyStyle><color>5532a05b</color></PolyStyle></Style>` +
        conGeo.map((p) => `<Placemark><name>${esc(nombrePotrero(p))}</name><description>${fmtNum(haPotrero(p), 2)} ha</description><styleUrl>#p</styleUrl><Polygon><outerBoundaryIs><LinearRing><coordinates>${[...p.geometria, p.geometria[0]].map((x) => `${x.lng},${x.lat},0`).join(" ")}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`).join("") +
        `</Document></kml>`;
      tipo = "application/vnd.google-earth.kml+xml"; ext = "kml";
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([contenido], { type: tipo }));
    a.download = `potreros-don-horacio.${ext}`;
    a.click();
  };
  return (
    <Modal titulo="Importar / exportar potreros" onCerrar={onCerrar} ancho="max-w-xl"
      pie={features?.length ? <><Boton variante="secundario" onClick={() => setFeatures(null)}>Volver</Boton><Boton onClick={importar} disabled={!features.some((f) => f.elegido)}>Importar {features.filter((f) => f.elegido).length}</Boton></> : null}>
      {!features && (
        <>
          <div className="text-sm text-stone-600 space-y-2">
            <p><b>Desde Google Earth:</b> dibujá cada potrero como polígono con su número o nombre, después clic derecho sobre la carpeta → <i>Guardar lugar como…</i> → formato <b>.kml</b>.</p>
            <p>También sirve un <b>.geojson</b> de QGIS, o el archivo de un agrimensor convertido a KML. Si un potrero ya existe con el mismo nombre o número, se le actualiza el contorno.</p>
          </div>
          <label className="block border-2 border-dashed border-stone-300 rounded-2xl p-6 text-center cursor-pointer hover:bg-white">
            <Upload className="mx-auto mb-2 text-stone-500" />
            <span className="font-medium">Elegir archivo .kml o .geojson</span>
            <input type="file" accept=".kml,.geojson,.json,application/vnd.google-earth.kml+xml" className="hidden" onChange={(e) => e.target.files[0] && leer(e.target.files[0])} />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="border-t pt-4">
            <div className="font-semibold mb-2">Exportar todos los potreros</div>
            <div className="flex gap-2">
              <Boton variante="secundario" onClick={() => exportar("kml")}><Download size={16} /> KML (Google Earth)</Boton>
              <Boton variante="secundario" onClick={() => exportar("geojson")}><Download size={16} /> GeoJSON (QGIS)</Boton>
            </div>
          </div>
        </>
      )}
      {features && (
        <div className="divide-y divide-stone-200 bg-white rounded-xl border">
          {features.map((f, i) => (
            <label key={f.i} className="flex items-center gap-3 px-3 py-2 text-sm">
              <input type="checkbox" checked={f.elegido} onChange={(e) => setFeatures(features.map((x, j) => (j === i ? { ...x, elegido: e.target.checked } : x)))} className="w-5 h-5" />
              <span className="flex-1"><b>{f.nombre}</b> · {fmtNum(superficieHa(f.puntos), 2)} ha · {f.puntos.length} vértices</span>
              <span className="text-xs text-stone-500">{existente(f.nombre) ? "actualiza contorno" : "nuevo"}</span>
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ---------- Descargar las imágenes satelitales del campo para usarlas sin señal ----------
function tilesDe(b, z) {
  const n = 2 ** z;
  const x = (lng) => Math.floor(((lng + 180) / 360) * n);
  const y = (lat) => { const r = (lat * Math.PI) / 180; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n); };
  const out = [];
  for (let xi = x(b.o); xi <= x(b.e); xi++) for (let yi = y(b.n); yi <= y(b.s); yi++) out.push([z, xi, yi]);
  return out;
}
function GuardarOffline({ potreros, mapa, onCerrar }) {
  const [zMax, setZMax] = useState(17);
  const [prog, setProg] = useState(null);
  const cancelar = useRef(false);
  let b = limites(potreros.map((p) => p.geometria).filter(Boolean));
  if (!b && mapa) { const mb = mapa.getBounds(); b = { s: mb.getSouth(), n: mb.getNorth(), o: mb.getWest(), e: mb.getEast() }; }
  if (b) { const m = Math.max(b.n - b.s, b.e - b.o) * 0.1 + 0.003; b = { s: b.s - m, n: b.n + m, o: b.o - m, e: b.e + m }; }
  const lista = useMemo(() => { if (!b) return []; let t = []; for (let z = 10; z <= zMax; z++) t = t.concat(tilesDe(b, z)); return t; }, [zMax, b?.s, b?.n, b?.o, b?.e]); // eslint-disable-line react-hooks/exhaustive-deps
  const descargar = async () => {
    cancelar.current = false;
    let hechos = 0, fallas = 0;
    setProg({ hechos, fallas, total: lista.length });
    const cola = [...lista];
    const trabajador = async () => {
      while (cola.length && !cancelar.current) {
        const [z, x, y] = cola.shift();
        try { await fetch(TILE_SAT.replace("{z}", z).replace("{y}", y).replace("{x}", x), { mode: "no-cors" }); } catch { fallas++; }
        hechos++;
        if (hechos % 10 === 0 || !cola.length) setProg({ hechos, fallas, total: lista.length });
      }
    };
    await Promise.all(Array.from({ length: 6 }, trabajador));
    setProg({ hechos, fallas, total: lista.length, fin: true });
  };
  const mb = Math.round(lista.length * 0.025);
  return (
    <Modal titulo="Guardar el mapa para usar sin señal" onCerrar={() => { cancelar.current = true; onCerrar(); }}
      pie={!prog?.fin ? <Boton onClick={descargar} disabled={!lista.length || (prog && !prog.fin) || !navigator.onLine}>{prog ? "Descargando…" : "Descargar"}</Boton> : <Boton onClick={onCerrar}>Listo</Boton>}>
      <p className="text-sm text-stone-600">Baja las imágenes satelitales {potreros.some((p) => p.geometria) ? "de todo el campo" : "de la zona que se ve en pantalla"} y las deja guardadas en este dispositivo. Hacelo con WiFi antes de salir al campo. Los datos (potreros, lotes, lluvias) se guardan offline solos.</p>
      <Campo label="Nivel de detalle">
        <Select value={zMax} onChange={(e) => setZMax(Number(e.target.value))} disabled={!!prog}>
          <option value={16}>Medio</option><option value={17}>Alto (recomendado)</option><option value={18}>Muy alto</option><option value={19}>Máximo</option>
        </Select>
      </Campo>
      <p className="text-sm">{lista.length.toLocaleString("es")} imágenes · aprox. {mb} MB</p>
      {lista.length > 15000 && <p className="text-sm text-amber-700">Es mucho: bajá el nivel de detalle.</p>}
      {prog && (
        <div>
          <div className="h-2 bg-stone-200 rounded-full overflow-hidden"><div className="h-full bg-campo-700" style={{ width: (prog.hechos / prog.total) * 100 + "%" }} /></div>
          <p className="text-sm mt-1">{prog.hechos} / {prog.total}{prog.fallas ? ` · ${prog.fallas} fallaron` : ""}{prog.fin ? " · ¡Listo!" : ""}</p>
        </div>
      )}
      <p className="text-xs text-stone-500">Funciona en la app instalada (agregada a la pantalla de inicio) o abierta desde el navegador con la versión publicada.</p>
    </Modal>
  );
}
