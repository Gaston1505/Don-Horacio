// Datos de ejemplo para el modo prueba (un campo ficticio con 12 potreros, 3 lotes y un año
// de rotación) — solo para ver cómo funciona la app antes de cargar los datos reales.
import { escribir, nuevoId } from "./backend";
import { hoy, sumarDias, cabezasLote, evLote } from "./logica";
import { deLocal } from "./geo";

export function cargarDatosDeEjemplo() {
  const origen = { lat: -31.735, lng: -55.985 };
  const ops = [];
  const potreros = [];
  // Grilla de 4 x 3 con bordes algo irregulares (los vértices compartidos quedan iguales)
  const xs = [0, 820, 1650, 2400, 3250], ys = [0, 900, 1750, 2500];
  const j = (i, k) => [xs[i] + ((i * 7 + k * 13) % 5) * 25 - 50, ys[k] + ((i * 11 + k * 3) % 5) * 22 - 44];
  const usos = ["campo_natural", "campo_natural", "pradera", "mejoramiento", "campo_natural", "verdeo_invierno", "campo_natural", "pradera", "campo_natural", "monte", "campo_natural", "mejoramiento"];
  const nombres = ["La Casa", "El Bajo", "Del Molino", "La Loma", "Del Monte", "Verdeo", "La Cañada", "Pradera Nueva", "El Fondo", "Monte", "Del Arroyo", "Las Piedras"];
  let n = 0;
  for (let k = 0; k < 3; k++) for (let i = 0; i < 4; i++) {
    const pts = [j(i, k), j(i + 1, k), j(i + 1, k + 1), j(i, k + 1)].map((xy) => { const p = deLocal(xy, origen); return { lat: +p.lat.toFixed(7), lng: +p.lng.toFixed(7) }; });
    const id = nuevoId("potreros");
    const uso = usos[n];
    potreros.push({ id, uso });
    ops.push({ op: "set", col: "potreros", id, data: { numero: String(n + 1), nombre: nombres[n], uso, geometria: pts, enRotacion: uso !== "monte", ladosNotas: n === 0 ? { 0: "5 hilos, postes nuevos 2023" } : {}, especies: uso === "pradera" ? "Festuca, trébol blanco, lotus" : "", aguada: n % 3 === 0 ? "Tajamar" : "Bebedero", creadoEn: new Date().toISOString() } });
    n++;
  }
  const config = {};
  const lotes = [
    { id: nuevoId("lotes"), nombre: "Vacas de cría", composicion: { vaca: 180, ternero: 72, ternera: 68, toro: 6 } },
    { id: nuevoId("lotes"), nombre: "Recría", composicion: { vaquillona: 85, novillito: 60 } },
    { id: nuevoId("lotes"), nombre: "Caballos", composicion: { caballo: 8 } },
  ];
  const rot = potreros.filter((p) => p.uso !== "monte");
  const inicio = sumarDias(hoy(), -300);
  lotes.forEach((l, li) => {
    let f = sumarDias(inicio, li * 3), idx = li * 3, ultimo = null;
    const estadia = [7, 9, 21][li];
    while (f < hoy()) {
      const p = rot[idx % rot.length];
      const salida = sumarDias(f, estadia);
      const abierta = salida >= hoy();
      ops.push({ op: "set", col: "ocupaciones", id: nuevoId("ocupaciones"), data: { loteId: l.id, potreroId: p.id, loteNombre: l.nombre, entrada: f, salida: abierta ? null : salida, cabezas: cabezasLote(l), ev: Math.round(evLote(l, config)), alturaEntrada: 14 + (idx % 5) * 2, alturaSalida: abierta ? null : 5 + (idx % 3) } });
      ultimo = { potreroId: p.id, desde: f };
      f = salida; idx += 4;
    }
    ops.push({ op: "set", col: "lotes", id: l.id, data: { nombre: l.nombre, composicion: l.composicion, activo: true, potreroId: ultimo.potreroId, desde: ultimo.desde, creadoEn: new Date(Date.now() + li).toISOString() } });
  });
  for (let d = sumarDias(hoy(), -700); d <= hoy(); d = sumarDias(d, 1)) {
    const r = Math.sin(d.split("-").reduce((a, b) => a * 31 + Number(b), 7)) * 10000;
    const x = r - Math.floor(r);
    if (x < 0.09) ops.push({ op: "set", col: "lluvias", id: nuevoId("lluvias"), data: { fecha: d, mm: Math.round(x * 900) / 2 + 2, notas: "" } });
  }
  ops.push({ op: "set", col: "eventos", id: nuevoId("eventos"), data: { potreroId: potreros[7].id, fecha: sumarDias(hoy(), -200), tipo: "siembra", producto: "Festuca + trébol blanco + lotus", dosis: "15 + 3 + 8 kg/ha", descripcion: "Siembra directa" } });
  ops.push({ op: "set", col: "eventos", id: nuevoId("eventos"), data: { potreroId: potreros[0].id, fecha: sumarDias(hoy(), -40), tipo: "alambrado", lado: "1", descripcion: "Se cambiaron 12 postes y se tensó" } });
  ops.push({ op: "set", col: "eventos", id: nuevoId("eventos"), data: { potreroId: potreros[3].id, fecha: sumarDias(hoy(), -10), tipo: "aforo", altura: "18", descripcion: "Buen rebrote" } });
  const pt = (x, y, tipo, nombre) => { const p = deLocal([x, y], origen); ops.push({ op: "set", col: "puntos", id: nuevoId("puntos"), data: { tipo, nombre, lat: p.lat, lng: p.lng } }); };
  pt(300, 300, "casa", "Casa principal"); pt(420, 250, "corral", "Manga"); pt(1200, 1300, "aguada", "Tajamar grande"); pt(380, 320, "pluviometro", "Pluviómetro casa"); pt(810, 450, "tranquera", "Portera 1-2");
  ops.push({ op: "set", col: "config", id: "general", data: { nombreCampo: "Don Horacio", descansoObjetivo: 45, ocupacionMaxima: 7, centro: origen } });
  escribir(ops);
}
