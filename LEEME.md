# Don Horacio — app de manejo del campo

App web instalable (PWA) para celular, iPad y computadora. Funciona **sin señal**: lo que se
carga en el campo queda guardado en el dispositivo y se sube solo cuando vuelve la conexión.

Se publica en: `https://gaston1505.github.io/don-horacio/`

## Qué hace

- **Mapa satelital** del campo: dibujar cada potrero tocando sus esquinas (se pegan a los
  vecinos, así los alambrados compartidos coinciden), o **recorrer las esquinas con el GPS**
  a caballo / en la camioneta. Calcula hectáreas, perímetro y **metros de cada lado**.
- **Importar desde Google Earth** (KML) o QGIS (GeoJSON), y exportar en los mismos formatos.
- **Puntos** en el mapa: aguadas, molinos, tranqueras, corrales, pluviómetros, problemas.
- **"Estás en el potrero X"** con el GPS del teléfono.
- **Guardar el mapa offline** (descarga las imágenes satelitales del campo con WiFi).
- **Croquis a escala** de cada potrero (lados L1, L2…, vértices, norte, escala) y del campo
  entero, para imprimir / PDF o mandar por WhatsApp. Cada lado tiene notas del alambrado y su
  historial de reparaciones.
- **Rotación**: tablero con el estado de cada potrero (ocupado, listo, recuperándose, recién
  salido), línea de tiempo de pastoreos, fecha en que cada potrero queda listo y cálculo de
  cuántos potreros hacen falta para cumplir los descansos.
- **Mover lote**: registra salida y entrada (con altura del pasto) en un solo paso.
- **Hacienda**: lotes con composición por categoría, EV, carga (EV/ha) instantánea y global,
  nacimientos, compras, ventas, muertes, destetes/cambios de categoría.
- **Lluvias**: registro, acumulado anual comparado con el año anterior a la misma fecha,
  gráfico mensual y lluvia caída desde que un potrero se desocupó.
- **Historial de cada potrero**: pastoreos, siembras, fertilizaciones, aplicaciones, aforos,
  alambrados… y estadísticas del último año (días ocupado, descanso promedio, EV·día/ha).
- **Usuarios y roles**: Administrador (Gastón), Encargado (papá), Capataz.

## Probarla ya (modo prueba)

Mientras `src/firebaseConfig.js` tenga los valores `PEGAR_ACA`, la app funciona en **modo
prueba**: se ingresa con cualquier email y los datos quedan solo en ese navegador. En Inicio
hay un botón **"Cargar datos de ejemplo"** para ver todo funcionando.

```bash
cd don-horacio
npm install
npm run dev
```

## Ponerla en marcha de verdad (una sola vez, ~15 minutos)

1. Entrar a https://console.firebase.google.com → **Agregar proyecto** → nombre `don-horacio`
   (sin Google Analytics).
2. **Authentication** → Comenzar → habilitar **Correo electrónico/contraseña**.
   En *Configuración → Dominios autorizados* agregar `gaston1505.github.io`.
3. **Firestore Database** → Crear base de datos → modo producción → ubicación
   `southamerica-east1` (São Paulo).
4. En Firestore → **Reglas**: pegar el contenido de `firestore.rules` de esta carpeta → Publicar.
5. **Configuración del proyecto** (engranaje) → *Tus apps* → ícono web `</>` → registrar app
   → copiar el objeto `firebaseConfig` y pegarlo en `src/firebaseConfig.js`.
6. **Authentication → Usuarios → Agregar usuario**: crear tu cuenta (email + contraseña).
7. Subir los cambios a `main` → se publica sola. Entrar con tu cuenta: la primera vez te
   pregunta tu nombre y quedás como **administrador**.
8. En **Ajustes → Usuarios** dar de alta a papá (Encargado) y al capataz (Capataz).

El plan gratuito de Firebase (Spark) alcanza de sobra para este uso.

## Uso sin señal

- Instalarla en el teléfono (Safari → Compartir → *Agregar a inicio*; Android → *Instalar app*).
- Ingresar una vez con señal: la sesión queda abierta.
- En **Mapa → Guardar offline**, con WiFi, bajar las imágenes del campo.
- Arriba a la derecha se ve el estado: *Sin señal · por subir* → *Subiendo…* → *Al día*.

## Técnica

React + Vite + Tailwind, Leaflet + Geoman (dibujo), imágenes satelitales Esri, Firebase
Auth + Firestore con caché persistente offline, service worker (vite-plugin-pwa) que guarda la
app y las imágenes del mapa. Los cálculos de superficie y distancia son geodésicos (`src/geo.js`).
