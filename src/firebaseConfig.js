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
  apiKey: "AIzaSyB0tW7H0XhcIL7Xljsa9GAs0jUzWSHsX4s",
  authDomain: "don-horacio.firebaseapp.com",
  projectId: "don-horacio",
  storageBucket: "don-horacio.firebasestorage.app",
  messagingSenderId: "137980845852",
  appId: "1:137980845852:web:d1cc6a3438a28e7b9364d9",
};

export const firebaseConfigurado = !Object.values(firebaseConfig).some((v) => !v || v === "PEGAR_ACA");
