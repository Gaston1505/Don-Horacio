// Croquis a escala en SVG, generado desde las coordenadas de los potreros: medidas de cada lado,
// vértices numerados, norte y escala gráfica. Sirve para imprimir o mandar por WhatsApp a quien
// vaya a arreglar un alambrado.
import React, { forwardRef, useMemo } from "react";
import { aLocal, lados, centroide, fmtMetros, superficieHa, fmtHa } from "./geo";

function escalaRedonda(m) {
  const pot = 10 ** Math.floor(Math.log10(m));
  for (const f of [5, 2, 1]) if (f * pot <= m) return f * pot;
  return pot;
}

export const Croquis = forwardRef(function Croquis({ poligonos, conLados = true, conVertices = true, titulo, alto = 520 }, ref) {
  const datos = useMemo(() => {
    const todos = poligonos.flatMap((p) => p.puntos || []);
    if (todos.length < 3) return null;
    const lat0 = todos.reduce((s, p) => s + p.lat, 0) / todos.length;
    const lng0 = todos.reduce((s, p) => s + p.lng, 0) / todos.length;
    const o = { lat: lat0, lng: lng0 };
    const proj = (pt) => { const [x, y] = aLocal(pt, o); return [x, -y]; };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pt of todos) { const [x, y] = proj(pt); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const w = maxX - minX || 1, h = maxY - minY || 1;
    const pad = Math.max(w, h) * 0.12;
    return { proj, vb: [minX - pad, minY - pad, w + 2 * pad, h + 2 * pad], w, h, tam: Math.max(w, h) };
  }, [poligonos]);

  if (!datos) return <div className="text-sm text-stone-500 p-6 text-center">Este potrero todavía no tiene el contorno dibujado en el mapa.</div>;
  const { proj, vb, tam } = datos;
  const fs = tam / 38; // tamaño de letra proporcional al dibujo
  const escala = escalaRedonda(vb[2] / 4);
  const unSolo = poligonos.length === 1;

  return (
    <svg ref={ref} viewBox={vb.join(" ")} xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: alto, background: "#FFFDF7" }} fontFamily="Helvetica, Arial, sans-serif">
      {titulo && <text x={vb[0] + fs} y={vb[1] + fs * 1.6} fontSize={fs * 1.3} fontWeight="700" fill="#1c1917">{titulo}</text>}
      {poligonos.map((pol) => {
        const pts = pol.puntos || [];
        if (pts.length < 3) return null;
        const d = pts.map((p) => proj(p).join(",")).join(" ");
        const c = proj(centroide(pts));
        const ls = lados(pts);
        return (
          <g key={pol.id}>
            <polygon points={d} fill={pol.color || "#7FA35E"} fillOpacity={unSolo ? 0.18 : 0.3} stroke="#24331A" strokeWidth={fs / 6} strokeLinejoin="round" />
            {conLados && ls.map((l) => {
              const [x1, y1] = proj(l.desde), [x2, y2] = proj(l.hasta);
              const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
              let ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
              if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
              // Correr la etiqueta hacia afuera del polígono
              const nx = -(y2 - y1), ny = x2 - x1, nl = Math.hypot(nx, ny) || 1;
              const signo = (mx - c[0]) * nx + (my - c[1]) * ny > 0 ? 1 : -1;
              const off = fs * (unSolo ? 0.9 : 0.6);
              const tx = mx + (signo * nx / nl) * off, ty = my + (signo * ny / nl) * off;
              const corto = Math.hypot(x2 - x1, y2 - y1) < fs * 4;
              if (corto && !unSolo) return null;
              return (
                <text key={l.i} x={tx} y={ty} fontSize={unSolo ? fs * 0.85 : fs * 0.55} textAnchor="middle" dominantBaseline="middle" fill="#7C2D12" fontWeight="600" transform={`rotate(${ang} ${tx} ${ty})`}>
                  {unSolo ? `L${l.i + 1} · ${fmtMetros(l.metros)}` : fmtMetros(l.metros)}
                </text>
              );
            })}
            {conVertices && unSolo && pts.map((p, i) => {
              const [x, y] = proj(p);
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r={fs / 3} fill="#24331A" />
                  <text x={x + fs / 2} y={y - fs / 2} fontSize={fs * 0.6} fill="#24331A">V{i + 1}</text>
                </g>
              );
            })}
            <text x={c[0]} y={c[1]} fontSize={unSolo ? fs * 1.4 : fs * 0.8} textAnchor="middle" fontWeight="700" fill="#1c1917">{pol.nombre}</text>
            <text x={c[0]} y={c[1] + (unSolo ? fs * 1.5 : fs * 0.9)} fontSize={unSolo ? fs * 0.9 : fs * 0.6} textAnchor="middle" fill="#44403c">{fmtHa(superficieHa(pts))}</text>
          </g>
        );
      })}
      {/* Norte */}
      <g transform={`translate(${vb[0] + vb[2] - fs * 2} ${vb[1] + fs * 2.5})`}>
        <polygon points={`0,${-fs * 1.4} ${fs * 0.6},${fs * 0.6} 0,${fs * 0.2} ${-fs * 0.6},${fs * 0.6}`} fill="#1c1917" />
        <text y={fs * 1.8} fontSize={fs} textAnchor="middle" fontWeight="700">N</text>
      </g>
      {/* Escala */}
      <g transform={`translate(${vb[0] + fs} ${vb[1] + vb[3] - fs * 1.2})`}>
        <rect width={escala / 2} height={fs / 3} fill="#1c1917" />
        <rect x={escala / 2} width={escala / 2} height={fs / 3} fill="#fff" stroke="#1c1917" strokeWidth={fs / 15} />
        <text y={-fs / 3} fontSize={fs * 0.6}>0</text>
        <text x={escala} y={-fs / 3} fontSize={fs * 0.6} textAnchor="middle">{fmtMetros(escala)}</text>
      </g>
    </svg>
  );
});

export function descargarSvg(svgEl, nombre) {
  const xml = new XMLSerializer().serializeToString(svgEl);
  const blob = new Blob([xml], { type: "image/svg+xml" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre + ".svg";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Abre una página lista para imprimir (o "Guardar como PDF") con el croquis y una tabla.
export function imprimirCroquis(svgEl, titulo, tablaHtml = "") {
  const w = window.open("", "_blank");
  if (!w) return alert("El navegador bloqueó la ventana. Permití ventanas emergentes para imprimir.");
  const svg = new XMLSerializer().serializeToString(svgEl).replace(/height="\d+"/, "").replace(/style="[^"]*"/, 'style="width:100%;max-height:70vh"');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title>
    <style>body{font-family:Helvetica,Arial,sans-serif;margin:16px;color:#1c1917}h1{font-size:20px;margin:0 0 8px}
    table{border-collapse:collapse;width:100%;margin-top:12px;font-size:12px}td,th{border:1px solid #d6d3d1;padding:4px 6px;text-align:left}
    th{background:#f5f5f4}.pie{font-size:11px;color:#78716c;margin-top:8px}</style></head>
    <body><h1>${titulo}</h1>${svg}${tablaHtml}<div class="pie">Don Horacio · generado el ${new Date().toLocaleDateString("es")}</div>
    <script>setTimeout(()=>print(),300)<\/script></body></html>`);
  w.document.close();
}
