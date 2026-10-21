import React, { useEffect, useMemo, useState } from "react";
import {
  Home, RefreshCw, Map as MapIcon, LayoutGrid, Beef, CloudRain, Settings, MoreHorizontal,
  Wifi, WifiOff, CloudUpload, LogOut, Loader2, Sprout, DollarSign, Leaf,
} from "lucide-react";
import { MODO_PRUEBA, useAuth, useDocSub, useSync, ingresar, entrarConCodigo, salir, recuperarClave, escribir } from "./backend";
import { Ctx, Boton, Campo, Input, Tarjeta } from "./ui";
import { puede, ROLES } from "./logica";
import Inicio from "./vistas/Inicio";
import Rotacion from "./vistas/Rotacion";
import Mapa from "./vistas/Mapa";
import Potreros from "./vistas/Potreros";
import Hacienda from "./vistas/Hacienda";
import Lluvias from "./vistas/Lluvias";
import Ajustes from "./vistas/Ajustes";
import Chacras from "./vistas/Chacras";
import Ventas from "./vistas/Ventas";
import Informes from "./vistas/Informes";

const SECCIONES = [
  { id: "inicio", nombre: "Inicio", icono: Home, comp: Inicio },
  { id: "rotacion", nombre: "Rotación", icono: RefreshCw, comp: Rotacion },
  { id: "mapa", nombre: "Mapa", icono: MapIcon, comp: Mapa },
  { id: "potreros", nombre: "Potreros", icono: LayoutGrid, comp: Potreros },
  { id: "chacras", nombre: "Chacras", icono: Sprout, comp: Chacras },
  { id: "hacienda", nombre: "Hacienda", icono: Beef, comp: Hacienda },
  { id: "ventas", nombre: "Ventas", icono: DollarSign, comp: Ventas, permiso: "dinero" },
  { id: "lluvias", nombre: "Lluvias", icono: CloudRain, comp: Lluvias },
  { id: "monitoreo", nombre: "Monitoreo", icono: Leaf, comp: Informes },
  { id: "ajustes", nombre: "Ajustes", icono: Settings, comp: Ajustes },
];
const EN_BARRA = ["inicio", "rotacion", "mapa", "potreros"];

// Navegación por hash (#seccion/param) para que funcione el botón "atrás" del celular.
function useRuta() {
  const leer = () => {
    const [s, ...resto] = window.location.hash.replace(/^#\/?/, "").split("/");
    return { seccion: SECCIONES.some((x) => x.id === s) ? s : "inicio", param: resto.join("/") || null };
  };
  const [ruta, setRuta] = useState(leer);
  useEffect(() => {
    const h = () => setRuta(leer());
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  const ir = (seccion, param) => { window.location.hash = "/" + seccion + (param ? "/" + param : ""); window.scrollTo(0, 0); };
  return [ruta, ir];
}

export default function App() {
  const { cargando, user } = useAuth();
  if (cargando) return <Pantalla><Loader2 className="animate-spin text-campo-700" size={36} /></Pantalla>;
  if (!user) return <Login />;
  return <ConSesion user={user} />;
}

function Pantalla({ children }) {
  return <div className="min-h-full flex items-center justify-center p-4">{children}</div>;
}

function Login() {
  const [modo, setModo] = useState("codigo"); // codigo | admin
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const sinSenal = "Sin conexión: la primera vez hay que entrar con señal. Después queda abierta y funciona sin señal.";
  const entrar = async (e) => {
    e.preventDefault();
    setError(""); setEnviando(true);
    try {
      if (modo === "codigo") await entrarConCodigo(nombre, codigo);
      else await ingresar(email, clave);
    } catch (err) {
      if (!navigator.onLine) setError(sinSenal);
      else if (modo === "codigo") setError(err.code === "auth/admin-restricted-operation" || err.code === "auth/operation-not-allowed" ? "El ingreso con código todavía no está activado en Firebase." : "Ese código no es válido. Pedíselo a Gastón.");
      else setError("Email o contraseña incorrectos.");
    } finally { setEnviando(false); }
  };
  return (
    <Pantalla>
      <Tarjeta className="w-full max-w-sm p-6">
        <div className="text-center mb-6">
          <img src="icon.svg" alt="" className="w-20 h-20 mx-auto rounded-2xl mb-3" />
          <h1 className="text-2xl font-bold">Don Horacio</h1>
          <p className="text-sm text-stone-500">Manejo del campo</p>
        </div>
        {MODO_PRUEBA && (
          <p className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 mb-4">
            <b>Modo prueba:</b> la app todavía no está conectada a Firebase. Los datos quedan solo en este dispositivo{modo === "codigo" ? "; cualquier código sirve" : ""}.
          </p>
        )}
        <form onSubmit={entrar} className="space-y-3">
          {modo === "codigo" ? (
            <>
              <Campo label="Tu nombre"><Input value={nombre} onChange={(e) => setNombre(e.target.value)} required placeholder="Ej: Martín" autoComplete="name" /></Campo>
              <Campo label="Código del campo" ayuda="Te lo pasa Gastón. Se pone una sola vez: después queda guardado en este teléfono.">
                <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} required autoCapitalize="characters" autoComplete="off" inputMode="text" />
              </Campo>
            </>
          ) : (
            <>
              <Campo label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" /></Campo>
              {!MODO_PRUEBA && <Campo label="Contraseña"><Input type="password" value={clave} onChange={(e) => setClave(e.target.value)} required autoComplete="current-password" /></Campo>}
            </>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Boton type="submit" className="w-full" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</Boton>
          {modo === "admin" && !MODO_PRUEBA && (
            <button type="button" className="text-sm text-campo-700 w-full" onClick={async () => {
              if (!email) return setError("Escribí tu email arriba y tocá de nuevo.");
              try { await recuperarClave(email); setError("Te mandamos un email para cambiar la contraseña."); } catch { setError("No se pudo enviar el email."); }
            }}>Olvidé mi contraseña</button>
          )}
        </form>
        <button type="button" className="text-xs text-stone-500 w-full mt-5" onClick={() => { setModo(modo === "codigo" ? "admin" : "codigo"); setError(""); }}>
          {modo === "codigo" ? "Soy el administrador (entrar con email)" : "Entrar con nombre y código"}
        </button>
      </Tarjeta>
    </Pantalla>
  );
}

function ConSesion({ user }) {
  const perfil = useDocSub("usuarios", user.uid);
  const instalacion = useDocSub("config", "instalacion");
  const config = useDocSub("config", "general");
  if (!perfil.cargado || !instalacion.cargado) return <Pantalla><Loader2 className="animate-spin text-campo-700" size={36} /></Pantalla>;
  if (!perfil.data) return <SinPerfil user={user} hayAdmin={!!instalacion.data} />;
  return <Shell user={user} perfil={perfil.data} config={config.data || {}} />;
}

// Primer ingreso: la primera cuenta que entra (Gastón) se registra como administrador. Las
// reglas de Firestore solo permiten esto mientras no exista config/instalacion.
function SinPerfil({ user, hayAdmin }) {
  const [nombre, setNombre] = useState("");
  // Ingreso con código: el perfil aparece en un instante. Si no aparece, es que el administrador
  // quitó este acceso (o el ingreso no se completó) y hay que volver a entrar.
  const [demorado, setDemorado] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDemorado(true), 6000); return () => clearTimeout(t); }, []);
  const crear = () => {
    escribir([
      { op: "set", col: "usuarios", id: user.uid, data: { nombre: nombre || user.email, email: user.email, rol: "admin" } },
      { op: "set", col: "config", id: "instalacion", data: { adminUid: user.uid, fecha: new Date().toISOString() } },
      { op: "set", col: "config", id: "general", data: { nombreCampo: "Don Horacio", descansoObjetivo: 45, ocupacionMaxima: 7 } },
    ]);
  };
  return (
    <Pantalla>
      <Tarjeta className="w-full max-w-sm p-6 space-y-4">
        {!user.email ? (
          demorado ? (
            <>
              <h1 className="text-xl font-bold">Hay que volver a entrar</h1>
              <p className="text-stone-600 text-sm">Este teléfono ya no tiene acceso (puede que se haya quitado desde Ajustes). Tocá "Salir" y entrá de nuevo con tu nombre y el código del campo.</p>
            </>
          ) : (
            <p className="text-stone-600 text-sm flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Entrando…</p>
          )
        ) : hayAdmin ? (
          <>
            <h1 className="text-xl font-bold">Cuenta sin acceso</h1>
            <p className="text-stone-600 text-sm">La cuenta <b>{user.email}</b> todavía no fue habilitada. Pedile al administrador que te dé de alta en Ajustes → Usuarios.</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">Bienvenido a Don Horacio</h1>
            <p className="text-stone-600 text-sm">Es la primera vez que se usa la app. Esta cuenta va a quedar como <b>administrador</b>; después podés dar de alta a los demás usuarios.</p>
            <Campo label="Tu nombre"><Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Gastón" /></Campo>
            <Boton className="w-full" onClick={crear}>Comenzar</Boton>
          </>
        )}
        <Boton variante="secundario" className="w-full" onClick={salir}><LogOut size={16} /> Salir</Boton>
      </Tarjeta>
    </Pantalla>
  );
}

function IndicadorSync() {
  const { online, pendiente } = useSync();
  if (MODO_PRUEBA) return <span className="text-xs bg-amber-100 text-amber-800 rounded-full px-2 py-1">Modo prueba</span>;
  if (!online) return (
    <span className="inline-flex items-center gap-1 text-xs bg-stone-200 text-stone-800 rounded-full px-2 py-1" title="Sin señal: lo que cargues queda guardado y se sube al volver la conexión">
      <WifiOff size={14} /> Sin señal{pendiente ? " · por subir" : ""}
    </span>
  );
  if (pendiente) return <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-800 rounded-full px-2 py-1"><CloudUpload size={14} className="animate-pulse" /> Subiendo…</span>;
  return <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-800 rounded-full px-2 py-1"><Wifi size={14} /> Al día</span>;
}

function Shell({ user, perfil, config }) {
  const [ruta, ir] = useRuta();
  const [mas, setMas] = useState(false);
  const rol = perfil.rol;
  const ctx = useMemo(() => ({ user, perfil, rol, config, puede: (a) => puede(rol, a), ir, param: ruta.param }), [user, perfil, rol, config, ruta.param]);
  const visibles = SECCIONES.filter((s) => !s.permiso || puede(rol, s.permiso));
  const Sec = (visibles.find((s) => s.id === ruta.seccion) || visibles[0]).comp;
  const pantallaCompleta = ruta.seccion === "mapa";
  return (
    <Ctx.Provider value={ctx}>
      <div className="min-h-full lg:pl-60">
        {/* Barra lateral (computadora / iPad horizontal) */}
        <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col bg-campo-900 text-campo-50 no-print safe-top">
          <div className="p-5 flex items-center gap-3">
            <img src="icon.svg" alt="" className="w-10 h-10 rounded-xl" />
            <div>
              <div className="font-bold leading-tight">{config.nombreCampo || "Don Horacio"}</div>
              <div className="text-xs text-campo-100/70">{perfil.nombre} · {ROLES[rol]?.nombre}</div>
            </div>
          </div>
          <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
            {visibles.map((s) => (
              <button key={s.id} onClick={() => ir(s.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left ${ruta.seccion === s.id ? "bg-campo-700 text-white" : "hover:bg-white/10"}`}>
                <s.icono size={20} /> {s.nombre}
              </button>
            ))}
          </nav>
          <div className="p-4 space-y-2">
            <IndicadorSync />
            <button onClick={salir} className="flex items-center gap-2 text-sm text-campo-100/80 hover:text-white"><LogOut size={16} /> Salir</button>
          </div>
        </aside>

        {/* Barra superior (celular / iPad vertical) */}
        <header className="lg:hidden sticky top-0 z-[1000] bg-campo-900 text-white safe-top no-print">
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2 font-bold"><img src="icon.svg" alt="" className="w-7 h-7 rounded-lg" />{config.nombreCampo || "Don Horacio"}</div>
            <IndicadorSync />
          </div>
        </header>

        <main className={pantallaCompleta ? "" : "max-w-6xl mx-auto p-4 pb-28 lg:pb-8"}>
          <Sec key={ruta.seccion} />
        </main>

        {/* Barra inferior (celular / iPad vertical) */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-[1000] bg-white border-t border-stone-200 grid grid-cols-5 safe-bottom no-print">
          {SECCIONES.filter((s) => EN_BARRA.includes(s.id)).map((s) => (
            <button key={s.id} onClick={() => { setMas(false); ir(s.id); }} className={`flex flex-col items-center pt-2 pb-1 text-[11px] ${ruta.seccion === s.id ? "text-campo-700 font-semibold" : "text-stone-500"}`}>
              <s.icono size={22} /> {s.nombre}
            </button>
          ))}
          <button onClick={() => setMas(!mas)} className={`flex flex-col items-center pt-2 pb-1 text-[11px] ${!EN_BARRA.includes(ruta.seccion) ? "text-campo-700 font-semibold" : "text-stone-500"}`}>
            <MoreHorizontal size={22} /> Más
          </button>
        </nav>
        {mas && (
          <div className="lg:hidden fixed inset-0 z-[999]" onClick={() => setMas(false)}>
            <div className="absolute bottom-20 right-3 bg-white rounded-2xl shadow-xl border border-stone-200 p-2 w-56" onClick={(e) => e.stopPropagation()}>
              {visibles.filter((s) => !EN_BARRA.includes(s.id)).map((s) => (
                <button key={s.id} onClick={() => { setMas(false); ir(s.id); }} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-stone-100"><s.icono size={20} /> {s.nombre}</button>
              ))}
              <div className="px-3 py-2 text-xs text-stone-500 border-t mt-1">{perfil.nombre} · {ROLES[rol]?.nombre}</div>
              <button onClick={salir} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-stone-100 text-red-600"><LogOut size={20} /> Salir</button>
            </div>
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
