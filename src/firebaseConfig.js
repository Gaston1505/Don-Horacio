// Configuración del proyecto Firebase de Don Horacio.
//
// Mientras esto quede con los valores "PEGAR_ACA", la app funciona en MODO PRUEBA: todo se
// guarda solamente en el navegador de ese dispositivo (sirve para probarla y cargar datos de
// ejemplo, pero no se comparte entre usuarios).
//
// Para usarla en serio con papá y el capataz: crear un proyecto en https://console.firebase.google.com,
// activar Authentication (email/contraseña) y Firestore, y pegar acá el objeto "firebaseConfig"
// que da la consola (Configuración del proyecto → Tus apps → Web). Estos valores NO son secretos:
// el acceso lo controlan las reglas de firestore.rules de esta carpeta.
export const firebaseConfig = {
  apiKey: "PEGAR_ACA",
  authDomain: "PEGAR_ACA",
  projectId: "PEGAR_ACA",
  storageBucket: "PEGAR_ACA",
  messagingSenderId: "PEGAR_ACA",
  appId: "PEGAR_ACA",
};

export const firebaseConfigurado = !Object.values(firebaseConfig).some((v) => !v || v === "PEGAR_ACA");
