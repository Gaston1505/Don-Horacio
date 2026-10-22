import React, { useState } from "react";
import { Save, UserPlus, Download, Smartphone, Trash2, KeyRound, Copy } from "lucide-react";
import { useCol, fijar, actualizar, borrar, crearCuentaUsuario, MODO_PRUEBA, escribir } from "../backend";
import { useApp, Tarjeta, Boton, Encabezado, Campo, Input, Select, Modal, confirmar } from "../ui";
import { CATEGORIAS, ROLES, MESES_SECA_DEFECTO, UMBRAL_SECA_DEFECTO, MESES_LARGOS } from "../logica";

const COLECCIONES = ["potreros", "lotes", "ocupaciones", "lluvias", "eventos", "movHacienda", "puntos"];

export default function Ajustes() {
  const { config, puede, user } = useApp();
  return (
    <div className="space-y-4">
      <Encabezado titulo="Ajustes" />
      {MODO_PRUEBA && (
        <Tarjeta className="p-4 border-amber-300 bg-amber-50 text-sm text-amber-900 space-y-1">
          <b>Modo prueba.</b> Los datos están solo en este navegador. Para compartirlos con los demás usuarios y sincronizar sin señal, hay que conectar Firebase (ver LEEME.md en la carpeta don-horacio del repositorio).
        </Tarjeta>
      )}
      {puede("editar") && <Config config={config} />}
      {puede("usuarios") && <Codigos />}
      {puede("usuarios") && <Usuarios yo={user.uid} />}
      <Instalar />
      {puede("editar") && <Respaldo />}
    </div>
  );
}

function Config({ config }) {
  const [d, setD] = useState({ nombreCampo: config.nombreCampo || "Don Horacio", descansoObjetivo: config.descansoObjetivo || 45, ocupacionMaxima: config.ocupacionMaxima || 7, ev: { ...(config.ev || {}) }, mesesSeca: config.mesesSeca || MESES_SECA_DEFECTO, umbralSeca: config.umbralSeca ?? UMBRAL_SECA_DEFECTO });
  const [ok, setOk] = useState(false);
  const guardar = () => {
    const { id, ...resto } = config; // eslint-disable-line no-unused-vars
    fijar("config", "general", { ...resto, ...d, descansoObjetivo: Number(d.descansoObjetivo), ocupacionMaxima: Number(d.ocupacionMaxima), umbralSeca: Number(d.umbralSeca) || 0, ev: Object.fromEntries(Object.entries(d.ev).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)])) });
    setOk(true); setTimeout(() => setOk(false), 2000);
  };
  return (
    <Tarjeta className="p-4 space-y-3">
      <h2 className="font-semibold">Campo y criterios de pastoreo</h2>
      <Campo label="Nombre del campo"><Input value={d.nombreCampo} onChange={(e) => setD({ ...d, nombreCampo: e.target.value })} /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Descanso objetivo (días)" ayuda="Días que necesita un potrero para recuperarse. Se puede cambiar por potrero."><Input type="number" value={d.descansoObjetivo} onChange={(e) => setD({ ...d, descansoObjetivo: e.target.value })} /></Campo>
        <Campo label="Ocupación máxima (días)" ayuda="Más de esto avisa en Inicio (el ganado empieza a comer el rebrote)."><Input type="number" value={d.ocupacionMaxima} onChange={(e) => setD({ ...d, ocupacionMaxima: e.target.value })} /></Campo>
      </div>
      <div>
        <div className="text-sm font-medium text-stone-700 mb-1">Equivalente vaca (EV) por categoría</div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {CATEGORIAS.map((c) => (
            <label key={c.id} className="text-xs"><span className="text-stone-600">{c.nombre}</span>
              <input type="number" step="0.05" className="w-full rounded-lg border border-stone-300 px-2 py-2 text-base" placeholder={String(c.ev)} value={d.ev[c.id] ?? ""} onChange={(e) => setD({ ...d, ev: { ...d.ev, [c.id]: e.target.value } })} />
            </label>
          ))}
        </div>
      </div>
      <div>
        <div className="text-sm font-medium text-stone-700 mb-1">💧 Época de seca</div>
        <p className="text-xs text-stone-500 mb-2">En estos meses, al mover un lote a un potrero con agua regular o mala, la app avisa antes de guardar.</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {MESES_LARGOS.map((m, i) => {
            const n = i + 1, on = d.mesesSeca.includes(n);
            return <button key={m} type="button" onClick={() => setD({ ...d, mesesSeca: on ? d.mesesSeca.filter((x) => x !== n) : [...d.mesesSeca, n].sort((a, b) => a - b) })} className={`text-sm rounded-full px-3 py-1 border ${on ? "bg-sky-700 text-white border-sky-700" : "bg-white border-stone-300"}`}>{m.slice(0, 3)}</button>;
          })}
        </div>
        <Campo label="Fuera de esos meses, avisar también si en los últimos 30 días llovió menos de (mm)" ayuda="0 = no usar"><Input type="number" value={d.umbralSeca} onChange={(e) => setD({ ...d, umbralSeca: e.target.value })} /></Campo>
      </div>
      <Boton onClick={guardar}><Save size={18} /> {ok ? "Guardado" : "Guardar"}</Boton>
    </Tarjeta>
  );
}

// Código del campo: con él Eduardo y Martín entran poniendo solo su nombre. Cambiarlo no saca a
// los que ya entraron (para eso, quitarles el acceso en Usuarios); solo impide nuevos ingresos.
function Codigos() {
  const codigos = useCol("codigos");
  const [copiado, setCopiado] = useState(null);
  const generar = () => {
    const sin = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin letras/números que se confunden (O/0, I/1)
    const c = Array.from(crypto.getRandomValues(new Uint32Array(6)), (n) => sin[n % sin.length]).join("");
    fijar("codigos", c, { creadoEn: new Date().toISOString() });
  };
  const copiar = async (c) => {
    try { await navigator.clipboard.writeText(c); setCopiado(c); setTimeout(() => setCopiado(null), 2000); } catch {}
  };
  return (
    <Tarjeta className="p-4 space-y-3">
      <h2 className="font-semibold flex items-center gap-2"><KeyRound size={18} /> Código del campo</h2>
      <p className="text-sm text-stone-600">Pasáselo por WhatsApp a Eduardo y a Martín. Entran con su nombre y este código una sola vez; después el teléfono queda adentro. Pueden cargar movimientos, lluvias, novedades y hacienda, pero no cambiar potreros ni borrar.</p>
      {codigos.map((c) => (
        <div key={c.id} className="flex items-center gap-2">
          <span className="font-mono text-2xl font-bold tracking-widest bg-campo-100 rounded-xl px-4 py-2">{c.id}</span>
          <Boton chico variante="secundario" onClick={() => copiar(c.id)}><Copy size={16} /> {copiado === c.id ? "Copiado" : "Copiar"}</Boton>
          <button className="p-2 text-stone-400 hover:text-red-600" title="Anular código" onClick={() => confirmar("¿Anular este código? Los que ya entraron siguen adentro.") && borrar("codigos", c.id)}><Trash2 size={16} /></button>
        </div>
      ))}
      {!codigos.length && <Boton onClick={generar}><KeyRound size={16} /> Generar código</Boton>}
      {codigos.length > 0 && <Boton chico variante="fantasma" onClick={() => { codigos.forEach((c) => borrar("codigos", c.id)); generar(); }}>Cambiar por uno nuevo</Boton>}
    </Tarjeta>
  );
}

function Usuarios({ yo }) {
  const usuarios = useCol("usuarios");
  const [alta, setAlta] = useState(false);
  return (
    <Tarjeta className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Usuarios</h2>
        <Boton chico variante="secundario" onClick={() => setAlta(true)}><UserPlus size={16} /> Con email</Boton>
      </div>
      <div className="divide-y divide-stone-100">
        {usuarios.map((u) => (
          <div key={u.id} className="py-2 flex items-center justify-between gap-2">
            <div className="min-w-0"><div className="font-medium">{u.nombre}</div><div className="text-sm text-stone-500 truncate">{u.email || "Entró con código"}{u.creadoEn ? ` · ${new Date(u.creadoEn).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}{usuarios.filter((x) => x.nombre?.trim().toLowerCase() === u.nombre?.trim().toLowerCase()).length > 1 ? " · repetido" : ""}</div></div>
            <div className="flex items-center gap-1">
              <select className="border rounded-lg px-2 py-1 text-sm" value={u.rol} disabled={u.id === yo} onChange={(e) => actualizar("usuarios", u.id, { rol: e.target.value })}>
                {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.nombre}</option>)}
              </select>
              {u.id !== yo && <button className="p-2 text-stone-400 hover:text-red-600" title="Quitar acceso" onClick={() => confirmar(`¿Quitarle el acceso a ${u.nombre}?`) && borrar("usuarios", u.id)}><Trash2 size={16} /></button>}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-stone-500 mt-3">Si alguien aparece repetido es porque entró desde dos lugares (por ejemplo Safari y la app instalada, que en el iPhone guardan la sesión por separado). Quitá el más viejo; si a esa persona le aparece "Hay que volver a entrar", que entre de nuevo con el código desde la app instalada.</p>
      <div className="text-xs text-stone-500 mt-3 space-y-0.5">{Object.values(ROLES).map((r) => <div key={r.nombre}><b>{r.nombre}:</b> {r.desc}</div>)}</div>
      {alta && <AltaUsuario onCerrar={() => setAlta(false)} />}
    </Tarjeta>
  );
}

function AltaUsuario({ onCerrar }) {
  const [d, setD] = useState({ nombre: "", email: "", clave: "", rol: "capataz" });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const crear = async () => {
    setError(""); setEnviando(true);
    try {
      const uid = await crearCuentaUsuario(d.email, d.clave);
      fijar("usuarios", uid, { nombre: d.nombre, email: d.email.trim(), rol: d.rol });
      onCerrar();
    } catch (e) {
      setError(e.code === "auth/email-already-in-use" ? "Ese email ya tiene cuenta." : e.code === "auth/weak-password" ? "La contraseña debe tener al menos 6 caracteres." : "No se pudo crear: " + e.message);
    } finally { setEnviando(false); }
  };
  return (
    <Modal titulo="Nuevo usuario" onCerrar={onCerrar} pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={crear} disabled={enviando || !d.nombre || !d.email || (!MODO_PRUEBA && d.clave.length < 6)}>{enviando ? "Creando…" : "Crear"}</Boton></>}>
      <Campo label="Nombre"><Input value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} placeholder="Ej: Horacio" /></Campo>
      <Campo label="Email"><Input type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} /></Campo>
      {!MODO_PRUEBA && <Campo label="Contraseña inicial" ayuda="Pasásela por WhatsApp; la puede cambiar con 'Olvidé mi contraseña'."><Input value={d.clave} onChange={(e) => setD({ ...d, clave: e.target.value })} /></Campo>}
      <Campo label="Rol"><Select value={d.rol} onChange={(e) => setD({ ...d, rol: e.target.value })}>{Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.nombre} — {r.desc}</option>)}</Select></Campo>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-stone-500">Hace falta conexión para crear usuarios.</p>
    </Modal>
  );
}

function Instalar() {
  return (
    <Tarjeta className="p-4 text-sm space-y-2">
      <h2 className="font-semibold flex items-center gap-2"><Smartphone size={18} /> Instalar en celular / iPad</h2>
      <p><b>iPhone / iPad:</b> abrir en Safari → botón Compartir → <i>Agregar a inicio</i>.</p>
      <p><b>Android:</b> abrir en Chrome → menú ⋮ → <i>Instalar app</i>.</p>
      <p><b>Para usar sin señal:</b> entrar una vez con conexión (queda la sesión abierta), y en Mapa tocar <i>Guardar offline</i> con WiFi. Lo que se cargue sin señal queda en el teléfono y se sube solo al recuperar conexión (arriba se ve "Sin señal · por subir" / "Al día").</p>
    </Tarjeta>
  );
}

function Respaldo() {
  const datos = Object.fromEntries(COLECCIONES.map((c) => [c, useCol(c)])); // eslint-disable-line react-hooks/rules-of-hooks
  const exportar = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ app: "don-horacio", fecha: new Date().toISOString(), datos }, null, 1)], { type: "application/json" }));
    a.download = `respaldo-don-horacio-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const importar = async (file) => {
    try {
      const j = JSON.parse(await file.text());
      if (j.app !== "don-horacio") throw new Error("No es un respaldo de Don Horacio");
      if (!confirmar("Se van a agregar/reemplazar los registros del respaldo (no se borra nada que no esté en el archivo). ¿Seguir?")) return;
      const ops = [];
      for (const c of COLECCIONES) for (const { id, ...data } of j.datos[c] || []) ops.push({ op: "set", col: c, id, data });
      for (let i = 0; i < ops.length; i += 400) escribir(ops.slice(i, i + 400));
      alert(`Listo: ${ops.length} registros.`);
    } catch (e) { alert("No se pudo importar: " + e.message); }
  };
  const n = COLECCIONES.reduce((s, c) => s + datos[c].length, 0);
  return (
    <Tarjeta className="p-4 space-y-2">
      <h2 className="font-semibold">Respaldo</h2>
      <p className="text-sm text-stone-600">Descargá una copia de todos los datos ({n} registros). Conviene hacerlo una vez por mes. Para usar en Excel/QGIS, los potreros se exportan desde el Mapa.</p>
      <div className="flex flex-wrap gap-2">
        <Boton variante="secundario" onClick={exportar}><Download size={16} /> Descargar respaldo</Boton>
        <label className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 border border-stone-300 bg-white cursor-pointer font-medium">Restaurar…<input type="file" accept=".json" className="hidden" onChange={(e) => e.target.files[0] && importar(e.target.files[0])} /></label>
      </div>
    </Tarjeta>
  );
}
