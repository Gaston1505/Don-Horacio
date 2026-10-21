// Cálculos geográficos simples (sin dependencias): distancias, superficie y croquis en metros.
// Los polígonos se guardan como [{ lat, lng }, ...] sin repetir el primer punto (Firestore no
// admite arrays anidados, por eso no se usa el formato GeoJSON tal cual).
const R = 6371008.8; // radio medio de la Tierra en metros
const rad = (g) => (g * Math.PI) / 180;

export function distancia(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Rumbo de a hacia b en grados (0 = norte, 90 = este).
export function rumbo(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
const PUNTOS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
export const puntoCardinal = (g) => PUNTOS[Math.round(g / 45) % 8];

// Superficie de un anillo sobre la esfera, en m² (misma fórmula que usa turf/area).
export function superficieM2(puntos) {
  if (!puntos || puntos.length < 3) return 0;
  let total = 0;
  const n = puntos.length;
  for (let i = 0; i < n; i++) {
    const p1 = puntos[i];
    const p2 = puntos[(i + 1) % n];
    const p3 = puntos[(i + 2) % n];
    total += (rad(p3.lng) - rad(p1.lng)) * Math.sin(rad(p2.lat));
  }
  return Math.abs((total * R * R) / 2);
}
export const superficieHa = (puntos) => superficieM2(puntos) / 10000;

// Cada lado del polígono: del vértice i al i+1 (el último cierra contra el primero).
export function lados(puntos) {
  if (!puntos || puntos.length < 2) return [];
  const n = puntos.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = puntos[i];
    const b = puntos[(i + 1) % n];
    if (n === 2 && i === 1) break;
    const r = rumbo(a, b);
    out.push({ i, desde: a, hasta: b, metros: distancia(a, b), rumbo: r, cardinal: puntoCardinal(r), medio: { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 } });
  }
  return out;
}
export const perimetro = (puntos) => lados(puntos).reduce((s, l) => s + l.metros, 0);

export function centroide(puntos) {
  if (!puntos?.length) return null;
  // Centroide del área (no promedio de vértices) en coordenadas locales.
  const o = puntos[0];
  const xy = puntos.map((p) => aLocal(p, o));
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    const f = x1 * y2 - x2 * y1;
    a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f;
  }
  if (Math.abs(a) < 1e-9) {
    const lat = puntos.reduce((s, p) => s + p.lat, 0) / puntos.length;
    const lng = puntos.reduce((s, p) => s + p.lng, 0) / puntos.length;
    return { lat, lng };
  }
  cx /= 3 * a; cy /= 3 * a;
  return deLocal([cx, cy], o);
}

// Proyección local equirectangular en metros (x = este, y = norte). Para un campo de algunos
// miles de hectáreas el error es despreciable y permite dibujar croquis a escala.
export function aLocal(p, origen) {
  const x = rad(p.lng - origen.lng) * R * Math.cos(rad(origen.lat));
  const y = rad(p.lat - origen.lat) * R;
  return [x, y];
}
export function deLocal([x, y], origen) {
  return {
    lat: origen.lat + (y / R) * (180 / Math.PI),
    lng: origen.lng + (x / (R * Math.cos(rad(origen.lat)))) * (180 / Math.PI),
  };
}

export function limites(listaDePoligonos) {
  let s = 90, n = -90, o = 180, e = -180, hay = false;
  for (const pts of listaDePoligonos) {
    for (const p of pts || []) {
      hay = true;
      s = Math.min(s, p.lat); n = Math.max(n, p.lat);
      o = Math.min(o, p.lng); e = Math.max(e, p.lng);
    }
  }
  return hay ? { s, n, o, e } : null;
}

export const fmtMetros = (m) => (m >= 1000 ? (m / 1000).toLocaleString("es", { maximumFractionDigits: 2 }) + " km" : Math.round(m).toLocaleString("es") + " m");
export const fmtHa = (ha) => (ha || 0).toLocaleString("es", { maximumFractionDigits: ha < 10 ? 2 : 1 }) + " ha";

// Punto dentro de polígono (ray casting) — para saber en qué potrero estoy parado con el GPS.
export function dentro(p, puntos) {
  let adentro = false;
  for (let i = 0, j = puntos.length - 1; i < puntos.length; j = i++) {
    const a = puntos[i], b = puntos[j];
    if ((a.lat > p.lat) !== (b.lat > p.lat) && p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng) adentro = !adentro;
  }
  return adentro;
}

// Convierte geometrías GeoJSON (Polygon/MultiPolygon, del KML de Google Earth o de otro GIS)
// al formato interno; para MultiPolygon toma el anillo exterior más grande.
export function geojsonAPoligono(geom) {
  if (!geom) return null;
  let anillos = [];
  if (geom.type === "Polygon") anillos = [geom.coordinates[0]];
  else if (geom.type === "MultiPolygon") anillos = geom.coordinates.map((p) => p[0]);
  else if (geom.type === "LineString" && geom.coordinates.length >= 3) anillos = [geom.coordinates];
  else if (geom.type === "GeometryCollection") {
    for (const g of geom.geometries) { const r = geojsonAPoligono(g); if (r) return r; }
    return null;
  } else return null;
  let mejor = null, mejorA = -1;
  for (const an of anillos) {
    let pts = an.map(([lng, lat]) => ({ lat, lng }));
    if (pts.length > 1 && pts[0].lat === pts[pts.length - 1].lat && pts[0].lng === pts[pts.length - 1].lng) pts = pts.slice(0, -1);
    const a = superficieM2(pts);
    if (a > mejorA) { mejor = pts; mejorA = a; }
  }
  return mejor && mejor.length >= 3 ? mejor : null;
}
export function poligonoAGeojson(pts, props = {}) {
  const ring = pts.map((p) => [p.lng, p.lat]);
  ring.push(ring[0]);
  return { type: "Feature", properties: props, geometry: { type: "Polygon", coordinates: [ring] } };
}
