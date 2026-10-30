# SIGNUM MOTORVEN — Paquete de Despliegue para GitHub

Este directorio `dist/` contiene la compilación estática de producción lista para ser desplegada directamente mediante **Upload** en **GitHub Pages** (o en servicios como Vercel, Netlify o Cloudflare Pages).

---

## 📦 Estructura Completa del Despliegue

Todo lo que ves dentro de la carpeta `dist/` es lo que debes subir a la raíz del repositorio de GitHub:

```text
dist/
├── assets/                                     <-- Carpeta con scripts JS, CSS y logos
│   ├── index-CW6yhMFh.js                       <-- Núcleo de la Aplicación React 19
│   ├── index-CzFMTw0r.css                      <-- Estilos corporativos Motorven / Oilstone
│   ├── real-data-dump-rPN60rnK.js              <-- Catálogo 2026 y datos offline sincronizados
│   ├── vendor-charts-C9S0Qh6G.js               <-- Motor de gráficos Recharts / BI
│   ├── vendor-icons-CKu2SB9x.js                <-- Iconografía Lucide
│   ├── vendor-pdf-aCPJmZbo.js                  <-- Motor de generación de reportes PDF oficiales
│   ├── vendor-react-D1XJUk3y.js                <-- Runtime React & DOM
│   ├── vendor-BYYBu5oQ.js                      <-- Dependencias de soporte
│   ├── rolldown-runtime-QTnfLwEv.js            <-- Runtime del empaquetador
│   ├── logo_motorven_limpio-gfA4aTD7.png       <-- Logo oficial Motorven
│   └── logo_signum_transpatente-DJ9DK7zJ.png   <-- Logo oficial Signum
├── .nojekyll                                   <-- OBLIGATORIO: desactiva Jekyll en GitHub Pages
├── index.html                                  <-- Punto de entrada principal (rutas relativas base: './')
├── 404.html                                    <-- Fallback SPA para recarga de rutas sin error 404
├── favicon.png                                 <-- Favicon corporativo
├── favicon.svg                                 <-- Favicon vectorial
├── icons.svg                                   <-- Sprite de iconos
├── logo_motorven_limpio.png                    <-- Logo para metadatos y vistas
├── logo_signum_transpatente.png                <-- Logo para encabezados
├── Ficha_Tecnica_KPI_Volumen_en_Bodega.pdf     <-- Ficha técnica oficial descargable
└── README.md                                   <-- Esta guía de despliegue
```

---

## 🚀 Paso a Paso: Despliegue Manual vía Upload en GitHub

### 1. Preparar o abrir el repositorio en GitHub
1. Ingresa a [github.com](https://github.com) e inicia sesión.
2. Crea un repositorio nuevo (ejemplo: `signum-motorven-app`).
   - Puedes colocarlo en **Público** (o **Privado** si tienes GitHub Pro/Team).
   - Marca la casilla **Add a README file** para que el repositorio se cree con la rama `main` activa.

### 2. Subir los archivos vía "Upload files"
1. Dentro del repositorio en GitHub, haz clic en el botón **Add file** (arriba a la derecha) y luego en **Upload files**.
2. Abre en tu computadora la carpeta local:
   `c:\Users\edson\Documents\APP WEB\SIGNUM MOTORVEN\dist`
3. Selecciona **TODO el contenido de `dist`** (incluyendo la carpeta `assets/`, `index.html`, `404.html`, `.nojekyll`, imágenes, etc.).
4. Arrástralo a la ventana de GitHub en tu navegador.
   *(Nota: Asegúrate de que la carpeta `assets` se cargue con todos sus archivos interiores).*
5. En la parte inferior, escribe en el commit:
   `Despliegue inicial de producción SIGNUM MOTORVEN 2026`
6. Haz clic en el botón verde **Commit changes**.

> **Nota sobre el archivo `.nojekyll`**:
> Como `.nojekyll` es un archivo que inicia con punto, en algunos navegadores los archivos ocultos no se arrastran. Si notas que no se subió, haz clic en **Add file** -> **Create new file**, nómbralo `.nojekyll`, déjalo completamente vacío y haz clic en **Commit changes**.

### 3. Activar GitHub Pages
1. En la barra superior de tu repositorio, haz clic en **Settings** (Configuración).
2. En el menú de la izquierda, baja hasta la sección **Code and automation** y haz clic en **Pages**.
3. En **Build and deployment**:
   - **Source**: selecciona `Deploy from a branch`.
   - **Branch**: selecciona `main` y en la carpeta elige `/ (root)`.
   - Haz clic en **Save** (Guardar).

### 4. Acceder a la Aplicación
En aproximadamente 1 a 2 minutos, GitHub terminará el despliegue y te mostrará el enlace oficial:
👉 `https://<tu-usuario>.github.io/<nombre-del-repositorio>/`

