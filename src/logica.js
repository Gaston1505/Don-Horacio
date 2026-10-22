// Reglas del negocio: categorías de hacienda, equivalentes vaca, estado de cada potrero en la
// rotación y estadísticas de uso.
import { superficieHa } from "./geo";

// ---------- Fechas (siempre "AAAA-MM-DD" en hora local) ----------
export function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const aDia = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
export const diasEntre = (desde, hasta = hoy()) => (desde && hasta ? Math.round(aDia(hasta) - aDia(desde)) : null);
export function sumarDias(s, n) {
  const d = new Date(Date.UTC(...s.split("-").map((v, i) => (i === 1 ? Number(v) - 1 : Number(v)))) + n * 86400000);
  return d.toISOString().slice(0, 10);
}
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const MESES_LARGOS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export function fmtFecha(s, conAnio = true) {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${Number(d)} ${MESES[Number(m) - 1]}${conAnio ? " " + y : ""}`;
}
export const fmtNum = (n, dec = 0) => (n == null || isNaN(n) ? "—" : Number(n).toLocaleString("es", { maximumFractionDigits: dec, minimumFractionDigits: 0 }));

// ---------- Hacienda ----------
// EV = equivalente vaca (vaca de cría de ~400 kg). Valores de referencia, editables en Ajustes.
export const CATEGORIAS = [
  { id: "vaca", nombre: "Vacas", ev: 1 },
  { id: "vaquillona", nombre: "Vaquillonas", ev: 0.8 },
  { id: "ternero", nombre: "Terneros", ev: 0.5 },
  { id: "ternera", nombre: "Terneras", ev: 0.5 },
  { id: "novillito", nombre: "Novillitos", ev: 0.7 },
  { id: "novillo", nombre: "Novillos", ev: 0.9 },
  { id: "toro", nombre: "Toros", ev: 1.3 },
  { id: "caballo", nombre: "Caballos", ev: 1.2 },
  { id: "oveja", nombre: "Ovinos", ev: 0.15 },
];
export const nombreCategoria = (id) => CATEGORIAS.find((c) => c.id === id)?.nombre || id;
export const evDe = (config) => Object.fromEntries(CATEGORIAS.map((c) => [c.id, Number(config?.ev?.[c.id] ?? c.ev)]));

export function cabezasLote(lote) {
  return Object.values(lote?.composicion || {}).reduce((s, n) => s + (Number(n) || 0), 0);
}
export function evLote(lote, config) {
  const ev = evDe(config);
  return Object.entries(lote?.composicion || {}).reduce((s, [c, n]) => s + (Number(n) || 0) * (ev[c] ?? 1), 0);
}

export const TIPOS_MOV_HACIENDA = [
  { id: "nacimiento", nombre: "Nacimiento", signo: 1 },
  { id: "compra", nombre: "Compra", signo: 1 },
  { id: "venta", nombre: "Venta", signo: -1 },
  { id: "muerte", nombre: "Muerte", signo: -1 },
  { id: "consumo", nombre: "Consumo / faena propia", signo: -1 },
  { id: "transferencia", nombre: "Pasar a otro lote", signo: -1 },
  { id: "recategorizacion", nombre: "Cambio de categoría (destete, etc.)", signo: 0 },
  { id: "ajuste_mas", nombre: "Ajuste por conteo (+)", signo: 1 },
  { id: "ajuste_menos", nombre: "Ajuste por conteo (−)", signo: -1 },
];
export const tipoMov = (id) => TIPOS_MOV_HACIENDA.find((t) => t.id === id);

// ---------- Potreros ----------
// "contorno" es el color del borde del potrero en el mapa (según su aptitud actual); el relleno
// muestra el estado de descanso. Verde = campo natural, amarillo = pradera, azul = verdeos,
// violeta = campo natural mejorado (pradera que terminó su vida útil).
export const USOS = [
  { id: "campo_natural", nombre: "Campo natural", color: "#8AA05A", contorno: "#22C55E" },
  { id: "mejoramiento", nombre: "Campo natural mejorado", color: "#6E9A3F", contorno: "#A855F7" },
  { id: "pradera", nombre: "Pradera", color: "#3F8F3A", contorno: "#FACC15" },
  { id: "verdeo_invierno", nombre: "Verdeo de invierno", color: "#2E7D6B", contorno: "#2563EB" },
  { id: "verdeo_verano", nombre: "Verdeo de verano", color: "#B58B2A", contorno: "#2563EB" },
  { id: "agricola", nombre: "Agrícola", color: "#C7A44A", contorno: "#F97316" },
  { id: "monte", nombre: "Monte / bajo / reserva", color: "#5E6B4E", contorno: "#44403C" },
  { id: "otro", nombre: "Otro", color: "#8C8C8C", contorno: "#FFFFFF" },
];
export const contornoUso = (id) => USOS.find((u) => u.id === id)?.contorno || "#FFFFFF";
export const esVerdeo = (uso) => uso === "verdeo_invierno" || uso === "verdeo_verano";

// Potencial del potrero (1 a 5), pensado sobre su campo natural original — independiente de la
// pastura que tenga hoy.
export const POTENCIAL = {
  1: { nombre: "Muy bajo", color: "#B91C1C" },
  2: { nombre: "Bajo", color: "#EA580C" },
  3: { nombre: "Medio", color: "#CA8A04" },
  4: { nombre: "Bueno", color: "#65A30D" },
  5: { nombre: "Muy bueno", color: "#15803D" },
};
export const nombreUso = (id) => USOS.find((u) => u.id === id)?.nombre || "—";

export const TIPOS_EVENTO = [
  { id: "siembra", nombre: "Siembra / implantación" },
  { id: "resiembra", nombre: "Resiembra / intersiembra" },
  { id: "fertilizacion", nombre: "Fertilización" },
  { id: "aplicacion", nombre: "Aplicación (herbicida, insecticida)" },
  { id: "rotativa", nombre: "Rotativa / desmalezado" },
  { id: "reserva", nombre: "Corte para reserva (fardos, silo)" },
  { id: "aforo", nombre: "Aforo / medición de pastura" },
  { id: "alambrado", nombre: "Alambrado / reparación" },
  { id: "aguada", nombre: "Aguada / bebedero" },
  { id: "suelo", nombre: "Análisis de suelo" },
  { id: "observacion", nombre: "Observación" },
  { id: "otro", nombre: "Otro" },
];
export const nombreEvento = (id) => TIPOS_EVENTO.find((t) => t.id === id)?.nombre || id;

export const TIPOS_PUNTO = [
  { id: "aguada", nombre: "Aguada / tajamar", emoji: "💧" },
  { id: "bebedero", nombre: "Bebedero", emoji: "🚰" },
  { id: "molino", nombre: "Molino / pozo", emoji: "🌀" },
  { id: "tranquera", nombre: "Tranquera / portera", emoji: "🚪" },
  { id: "corral", nombre: "Corral / manga", emoji: "🐄" },
  { id: "casa", nombre: "Casa / galpón", emoji: "🏠" },
  { id: "pluviometro", nombre: "Pluviómetro", emoji: "🌧️" },
  { id: "problema", nombre: "Problema (alambre, erosión…)", emoji: "⚠️" },
  { id: "otro", nombre: "Otro", emoji: "📍" },
];
export const tipoPunto = (id) => TIPOS_PUNTO.find((t) => t.id === id) || TIPOS_PUNTO[TIPOS_PUNTO.length - 1];

export function haPotrero(p) {
  const manual = Number(p?.hectareas);
  if (manual > 0) return manual;
  return p?.geometria?.length >= 3 ? superficieHa(p.geometria) : 0;
}

export const ESTADOS = {
  ocupado: { nombre: "Ocupado", color: "#2563EB", bg: "#DBEAFE" },
  listo: { nombre: "Listo para entrar", color: "#15803D", bg: "#DCFCE7" },
  recuperando: { nombre: "Recuperándose", color: "#B45309", bg: "#FEF3C7" },
  reciente: { nombre: "Recién salido", color: "#B91C1C", bg: "#FEE2E2" },
  sin_datos: { nombre: "Sin historial", color: "#6B7280", bg: "#F3F4F6" },
  fuera: { nombre: "Fuera de rotación", color: "#57534E", bg: "#E7E5E4" },
};

export const descansoObjetivo = (potrero, config) => Number(potrero?.descansoObjetivo) || Number(config?.descansoObjetivo) || 45;
export const ocupacionMaxima = (potrero, config) => Number(potrero?.ocupacionMaxima) || Number(config?.ocupacionMaxima) || 7;

// Estado actual de un potrero a partir de sus ocupaciones.
export function estadoPotrero(potrero, ocupaciones, config, fecha = hoy()) {
  const propias = ocupaciones.filter((o) => o.potreroId === potrero.id);
  const abiertas = propias.filter((o) => !o.salida);
  const objetivo = descansoObjetivo(potrero, config);
  const base = { objetivo, ocupMax: ocupacionMaxima(potrero, config), ocupaciones: propias };
  if (abiertas.length) {
    const desde = abiertas.map((o) => o.entrada).sort()[0];
    return { ...base, estado: "ocupado", abiertas, desde, diasOcupado: diasEntre(desde, fecha) };
  }
  if (potrero.enRotacion === false) return { ...base, estado: "fuera" };
  const salidas = propias.map((o) => o.salida).filter(Boolean).sort();
  if (!salidas.length) return { ...base, estado: "sin_datos", diasDescanso: null };
  const ultimaSalida = salidas[salidas.length - 1];
  const dd = diasEntre(ultimaSalida, fecha);
  const estado = dd >= objetivo ? "listo" : dd >= objetivo / 2 ? "recuperando" : "reciente";
  return { ...base, estado, ultimaSalida, diasDescanso: dd, listoEl: dd >= objetivo ? null : sumarDias(ultimaSalida, objetivo) };
}

// Estadísticas de uso en una ventana de tiempo (por defecto últimos 365 días).
export function estadisticasPotrero(potrero, ocupaciones, desde, hasta = hoy()) {
  const propias = ocupaciones.filter((o) => o.potreroId === potrero.id).sort((a, b) => a.entrada.localeCompare(b.entrada));
  let diasOcup = 0, evDias = 0, pastoreos = 0;
  for (const o of propias) {
    const ini = o.entrada > desde ? o.entrada : desde;
    const fin = (o.salida || hasta) < hasta ? o.salida || hasta : hasta;
    const d = diasEntre(ini, fin);
    if (d == null || d < 0) continue;
    pastoreos += 1;
    diasOcup += Math.max(d, 1);
    evDias += Math.max(d, 1) * (Number(o.ev) || 0);
  }
  // Descansos entre pastoreos consecutivos (ocupaciones que se solapan se toman como una).
  const descansos = [];
  let finAnterior = null;
  for (const o of propias) {
    if (finAnterior && o.entrada > finAnterior) descansos.push(diasEntre(finAnterior, o.entrada));
    if (o.salida && (!finAnterior || o.salida > finAnterior)) finAnterior = o.salida;
    if (!o.salida) finAnterior = null;
  }
  const ha = haPotrero(potrero);
  return {
    pastoreos, diasOcup, evDias,
    evDiasHa: ha ? evDias / ha : null,
    descansoPromedio: descansos.length ? descansos.reduce((a, b) => a + b, 0) / descansos.length : null,
  };
}

// ---------- Permisos ----------
export const ROLES = {
  admin: { nombre: "Administrador", desc: "Todo: arma potreros y chacras, usuarios, ventas y costos" },
  encargado: { nombre: "Encargado", desc: "Ve todo (incluidas ventas y costos) y carga de todo; no gestiona usuarios" },
  capataz: { nombre: "Capataz", desc: "Registra movimientos, lluvias, novedades, aplicaciones y toros; no ve plata ni borra" },
};
// Acciones: "registrar" (cargar el día a día), "editar" (estructura y correcciones), "borrar",
// "dinero" (ver ventas, precios y costos), "usuarios".
export function puede(rol, accion) {
  if (rol === "admin") return true;
  if (rol === "encargado") return accion !== "usuarios";
  if (rol === "capataz") return accion === "registrar";
  return false;
}

// ---------- Agua ----------
export const FUENTES_AGUA = [
  { id: "arroyo", nombre: "Arroyo" },
  { id: "canada", nombre: "Cañada" },
  { id: "tajamar", nombre: "Tajamar" },
  { id: "bebedero", nombre: "Bebedero" },
  { id: "pozo", nombre: "Pozo / molino" },
  { id: "laguna", nombre: "Laguna / bañado" },
  { id: "rio", nombre: "Río" },
];
export const nombreFuente = (id) => FUENTES_AGUA.find((f) => f.id === id)?.nombre || id;
// Cómo responde el agua del potrero en una seca de verano.
export const AGUA_SECA = {
  buena: { nombre: "Buena", desc: "No falla en seca", color: "#15803D" },
  regular: { nombre: "Regular", desc: "Baja el caudal, hay que vigilar", color: "#B45309" },
  mala: { nombre: "Mala", desc: "Se seca o no alcanza", color: "#B91C1C" },
};
export const MESES_SECA_DEFECTO = [12, 1, 2, 3];
export const UMBRAL_SECA_DEFECTO = 30; // mm en los últimos 30 días

// Época de seca: los meses marcados en Ajustes (por defecto dic–mar) o, en cualquier mes, si en
// los últimos 30 días llovió menos que el umbral.
export function epocaDeSeca(config, lluvias, fecha = hoy()) {
  const meses = config?.mesesSeca || MESES_SECA_DEFECTO;
  if (meses.includes(Number(fecha.slice(5, 7)))) return { seca: true, motivo: "estamos en los meses de seca" };
  const umbral = Number(config?.umbralSeca ?? UMBRAL_SECA_DEFECTO);
  if (lluvias?.length && umbral > 0) {
    const desde = sumarDias(fecha, -30);
    const mm = lluvias.filter((l) => l.fecha > desde && l.fecha <= fecha).reduce((s, l) => s + (Number(l.mm) || 0), 0);
    if (mm < umbral) return { seca: true, motivo: `en los últimos 30 días llovieron ${fmtNum(mm)} mm` };
  }
  return { seca: false };
}

// Alerta de agua para entrar a un potrero en época de seca. Sin datos de agua también avisa,
// para que se complete la ficha.
export function alertaAgua(potrero, config, lluvias, fecha = hoy()) {
  const ep = epocaDeSeca(config, lluvias, fecha);
  if (!ep.seca || !potrero) return null;
  const q = potrero.aguaSeca;
  if (q === "buena") return null;
  if (q === "mala") return { nivel: "mala", motivo: ep.motivo };
  if (q === "regular") return { nivel: "regular", motivo: ep.motivo };
  return { nivel: "sin_dato", motivo: ep.motivo };
}
