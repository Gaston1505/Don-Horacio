// Capa de datos. Dos implementaciones con la misma interfaz:
//  - Firebase (Firestore con caché persistente offline): lo que se carga sin señal queda guardado
//    en el dispositivo y se sube solo apenas vuelve la conexión.
//  - Local (modo prueba, mientras firebaseConfig.js no esté completo): todo en localStorage.
//
// Las escrituras NO se esperan desde la UI: con Firestore offline la promesa recién resuelve
// cuando el servidor confirma, pero el cambio ya aparece al instante en la caché local.
import { useEffect, useState, useSyncExternalStore } from "react";
import { initializeApp, deleteApp } from "firebase/app";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, onSnapshot, writeBatch, increment, deleteField, setDoc, getDoc,
} from "firebase/firestore";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInAnonymously, signOut,
  createUserWithEmailAndPassword, sendPasswordResetEmail,
} from "firebase/auth";
import { firebaseConfig, firebaseConfigurado } from "./firebaseConfig";

export const MODO_PRUEBA = !firebaseConfigurado;

let db = null;
let auth = null;
if (!MODO_PRUEBA) {
  const app = initializeApp(firebaseConfig);
  db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  auth = getAuth(app);
}

// ---------- Estado de sincronización ----------
const sync = { online: typeof navigator === "undefined" ? true : navigator.onLine, pendientes: {}, errores: 0 };
let syncSnapshot = { online: sync.online, pendiente: false, errores: 0 };
const syncListeners = new Set();
function emitSync() {
  syncSnapshot = {
    online: sync.online,
    pendiente: Object.values(sync.pendientes).some(Boolean),
    errores: sync.errores,
  };
  syncListeners.forEach((l) => l());
}
if (typeof window !== "undefined") {
  window.addEventListener("online", () => { sync.online = true; emitSync(); });
  window.addEventListener("offline", () => { sync.online = false; emitSync(); });
}
export function useSync() {
  return useSyncExternalStore((l) => { syncListeners.add(l); return () => syncListeners.delete(l); }, () => syncSnapshot);
}
function reportarError(e) {
  console.error(e);
  sync.errores += 1;
  emitSync();
  alert("No se pudo guardar un cambio: " + (e?.message || e) + "\n\nPuede ser falta de permisos para tu usuario.");
}

// ---------- Suscripciones compartidas por colección ----------
const stores = {};
const VACIO = [];
function store(col) {
  if (stores[col]) return stores[col];
  const s = (stores[col] = { data: VACIO, cargado: false, listeners: new Set(), unsub: null });
  const emit = () => s.listeners.forEach((l) => l());
  if (MODO_PRUEBA) {
    s.data = localLeer(col);
    s.cargado = true;
    s.refrescar = () => { s.data = localLeer(col); emit(); };
  } else {
    s.unsub = onSnapshot(
      collection(db, col),
      { includeMetadataChanges: true },
      (snap) => {
        s.data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        s.cargado = true;
        sync.pendientes[col] = snap.metadata.hasPendingWrites;
        emitSync();
        emit();
      },
      (err) => { console.error(col, err); s.cargado = true; s.error = err; emit(); },
    );
  }
  return s;
}
export function useCol(col, enabled = true) {
  const s = enabled ? store(col) : null;
  return useSyncExternalStore(
    (l) => { if (!s) return () => {}; s.listeners.add(l); return () => s.listeners.delete(l); },
    () => (s ? s.data : VACIO),
  );
}
export function useDocData(col, id) {
  const lista = useCol(col);
  return lista.find((d) => d.id === id) || null;
}

// Lectura puntual de un documento (sin suscripción): para archivos grandes que no conviene
// mantener sincronizados en todos los dispositivos.
export async function leerDoc(col, id) {
  if (MODO_PRUEBA) { const d = localMapa(col)[id]; return d ? { id, ...d } : null; }
  const snap = await getDoc(doc(db, col, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ---------- Escrituras ----------
export const inc = (n) => (MODO_PRUEBA ? { __inc: n } : increment(n));
export const borrarCampo = () => (MODO_PRUEBA ? { __del: true } : deleteField());

export function nuevoId(col) {
  if (MODO_PRUEBA) return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return doc(collection(db, col)).id;
}

// ops: [{ op: "set" | "update" | "delete", col, id, data, merge? }]
export function escribir(ops) {
  const meta = { actualizadoPor: usuarioActualUid, actualizadoEn: new Date().toISOString() };
  if (MODO_PRUEBA) {
    const tocadas = new Set();
    for (const o of ops) {
      const m = localMapa(o.col);
      if (o.op === "delete") delete m[o.id];
      else if (o.op === "set" && o.merge) m[o.id] = mezclar(m[o.id] || {}, { ...o.data, ...meta });
      else if (o.op === "set") m[o.id] = aplicarCampos({}, { ...o.data, ...meta });
      else m[o.id] = aplicarCampos(m[o.id] || {}, { ...o.data, ...meta });
      localGuardar(o.col, m);
      tocadas.add(o.col);
    }
    tocadas.forEach((c) => stores[c]?.refrescar?.());
    return Promise.resolve();
  }
  const b = writeBatch(db);
  for (const o of ops) {
    const ref = doc(db, o.col, o.id);
    if (o.op === "delete") b.delete(ref);
    else if (o.op === "set") b.set(ref, { ...o.data, ...meta }, o.merge ? { merge: true } : {});
    else b.update(ref, { ...o.data, ...meta });
  }
  const p = b.commit();
  p.catch(reportarError);
  return p;
}
export function agregar(col, data) {
  const id = nuevoId(col);
  escribir([{ op: "set", col, id, data: { ...data, creadoPor: usuarioActualUid, creadoEn: new Date().toISOString() } }]);
  return id;
}
export const actualizar = (col, id, data) => escribir([{ op: "update", col, id, data }]);
export const fijar = (col, id, data) => escribir([{ op: "set", col, id, data }]);
export const borrar = (col, id) => escribir([{ op: "delete", col, id }]);

// ---------- Implementación local (modo prueba) ----------
const LKEY = (col) => "donhoracio:" + col;
function localMapa(col) {
  try { return JSON.parse(localStorage.getItem(LKEY(col)) || "{}"); } catch { return {}; }
}
function localGuardar(col, m) { localStorage.setItem(LKEY(col), JSON.stringify(m)); }
function localLeer(col) { return Object.entries(localMapa(col)).map(([id, d]) => ({ id, ...d })); }
// set con merge: mezcla objetos anidados (igual que Firestore con { merge: true }).
function mezclar(base, data) {
  const out = { ...base };
  for (const [k, v] of Object.entries(data)) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object" ? mezclar(out[k], v) : v;
  }
  return out;
}
// Soporta "a.b" como ruta (igual que Firestore update) y los centinelas inc/borrarCampo.
function aplicarCampos(base, data) {
  const out = JSON.parse(JSON.stringify(base));
  for (const [k, v] of Object.entries(data)) {
    const partes = k.split(".");
    let obj = out;
    for (let i = 0; i < partes.length - 1; i++) {
      if (typeof obj[partes[i]] !== "object" || obj[partes[i]] === null) obj[partes[i]] = {};
      obj = obj[partes[i]];
    }
    const ult = partes[partes.length - 1];
    if (v && typeof v === "object" && "__inc" in v) obj[ult] = (Number(obj[ult]) || 0) + v.__inc;
    else if (v && typeof v === "object" && v.__del) delete obj[ult];
    else if (v === undefined) continue;
    else obj[ult] = v;
  }
  return out;
}
export function exportarTodoLocal() {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith("donhoracio:")) out[k.slice(11)] = localMapa(k.slice(11));
  }
  return out;
}

// ---------- Autenticación ----------
let usuarioActualUid = null;
const DEMO_KEY = "donhoracio-demo-usuario";

export function useAuth() {
  const [estado, setEstado] = useState({ cargando: true, user: null });
  useEffect(() => {
    if (MODO_PRUEBA) {
      let u = null;
      try { u = JSON.parse(localStorage.getItem(DEMO_KEY) || "null"); } catch {}
      usuarioActualUid = u?.uid || null;
      setEstado({ cargando: false, user: u });
      const h = () => {
        let v = null;
        try { v = JSON.parse(localStorage.getItem(DEMO_KEY) || "null"); } catch {}
        usuarioActualUid = v?.uid || null;
        setEstado({ cargando: false, user: v });
      };
      window.addEventListener("donhoracio-demo-auth", h);
      return () => window.removeEventListener("donhoracio-demo-auth", h);
    }
    return onAuthStateChanged(auth, (u) => {
      usuarioActualUid = u?.uid || null;
      setEstado({ cargando: false, user: u ? { uid: u.uid, email: u.email } : null });
    });
  }, []);
  return estado;
}

export async function ingresar(email, password) {
  if (MODO_PRUEBA) {
    const u = { uid: "demo-" + (email || "admin"), email };
    localStorage.setItem(DEMO_KEY, JSON.stringify(u));
    window.dispatchEvent(new Event("donhoracio-demo-auth"));
    return;
  }
  await signInWithEmailAndPassword(auth, email.trim(), password);
}
// Ingreso simple para Eduardo y Martín: nombre + código del campo, sin email ni contraseña.
// Se crea una sesión anónima en el dispositivo (queda abierta para siempre) y su perfil con rol
// "capataz"; las reglas de Firestore solo lo aceptan si el código existe en la colección
// "codigos" (que nadie más que el administrador puede leer).
export async function entrarConCodigo(nombre, codigo) {
  const cod = codigo.trim().toUpperCase();
  if (MODO_PRUEBA) {
    const u = { uid: "demo-" + nombre.trim().toLowerCase(), email: null };
    localStorage.setItem(DEMO_KEY, JSON.stringify(u));
    escribir([{ op: "set", col: "usuarios", id: u.uid, data: { nombre: nombre.trim(), rol: "capataz", codigo: cod } }]);
    window.dispatchEvent(new Event("donhoracio-demo-auth"));
    return;
  }
  const cred = await signInAnonymously(auth);
  try {
    await setDoc(doc(db, "usuarios", cred.user.uid), { nombre: nombre.trim(), rol: "capataz", codigo: cod, creadoEn: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    await cred.user.delete().catch(() => signOut(auth));
    const err = new Error("codigo");
    err.code = "codigo-invalido: " + (e.code || e.message);
    throw err;
  }
}

export async function salir() {
  if (MODO_PRUEBA) {
    localStorage.removeItem(DEMO_KEY);
    window.dispatchEvent(new Event("donhoracio-demo-auth"));
    return;
  }
  await signOut(auth);
}
export async function recuperarClave(email) {
  if (MODO_PRUEBA) return;
  await sendPasswordResetEmail(auth, email.trim());
}

// Crea la cuenta de otro usuario sin cerrar la sesión del administrador: se usa una segunda
// instancia de Firebase sólo para el alta y después se descarta.
export async function crearCuentaUsuario(email, password) {
  if (MODO_PRUEBA) return "demo-" + email;
  const sec = initializeApp(firebaseConfig, "alta-" + Date.now());
  try {
    const cred = await createUserWithEmailAndPassword(getAuth(sec), email.trim(), password);
    await signOut(getAuth(sec));
    return cred.user.uid;
  } finally {
    await deleteApp(sec);
  }
}

// Suscripción a un único documento (para el perfil propio y config, que un capataz puede leer
// aunque no pueda listar toda la colección).
export function useDocSub(col, id) {
  const lista = useCol(col, MODO_PRUEBA);
  const [estado, setEstado] = useState({ cargado: false, data: null });
  useEffect(() => {
    if (MODO_PRUEBA || !id) return;
    return onSnapshot(
      doc(db, col, id),
      (snap) => setEstado({ cargado: true, data: snap.exists() ? { id: snap.id, ...snap.data() } : null }),
      (err) => { console.error(col, id, err); setEstado({ cargado: true, data: null, error: err }); },
    );
  }, [col, id]);
  if (MODO_PRUEBA) return { cargado: true, data: lista.find((d) => d.id === id) || null };
  return estado;
}
