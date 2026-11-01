# SIGNUM MOTORVEN - Despliegue en GitHub Pages

Este directorio `dist/` contiene la compilación estática de producción lista para ser desplegada en **GitHub Pages** o cualquier servidor web (Vercel, Netlify, Cloudflare Pages, etc.).

## 📦 Contenido del Paquete

* **`index.html`**: Punto de entrada principal de la aplicación.
* **`404.html`**: Redirección para Single Page Application (SPA), asegurando que al recargar páginas o rutas en GitHub Pages no aparezca error 404.
* **`.nojekyll`**: Archivo clave para GitHub Pages que desactiva el procesamiento de Jekyll, permitiendo la carga de todos los archivos y subcarpetas.
* **`assets/`**:
  * `index-*.js`: Código fuente empaquetado de la aplicación con la base de datos real del año 2026 pre-cargada (2.493 facturas, 155.199,9 Litros, cobranzas e histórico completo) y el Centro de Ayuda actualizado.
  * `index-*.css`: Estilos visuales corporativos oficiales de Grupo Motorven.
  * `index.es-*.js`, `html2canvas-*.js`, `purify.es-*.js`: Librerías de generación y exportación de reportes PDF oficiales SENIAT.
  * Logos corporativos en alta definición.
* **Iconos y Favicons**: `favicon.png`, `favicon.svg`, `icons.svg`.

---

## 🚀 Pasos para Subir y Desplegar en GitHub vía Upload

1. **Crear o abrir tu repositorio en GitHub:**
   * Entra a [github.com](https://github.com) e inicia sesión.
   * Crea un nuevo repositorio (por ejemplo `signum-motorven` o el nombre de tu preferencia) en modo **Público** (o Privado si tienes GitHub Pro/Teams).

2. **Subir los archivos mediante Upload (Web):**
   * En la página de tu repositorio, haz clic en **Add file** -> **Upload files**.
   * Arrastra **todos los archivos y la carpeta `assets/`** que están dentro de esta carpeta `dist/` directamente a la ventana del navegador.
   * En la parte inferior, escribe un mensaje de commit (ej. `Despliegue versión 2026 con Centro de Ayuda actualizado`) y haz clic en **Commit changes**.

3. **Activar GitHub Pages:**
   * En tu repositorio de GitHub, entra en la pestaña **Settings** (Configuración) en la barra superior.
   * En el menú lateral izquierdo, selecciona **Pages**.
   * Bajo la sección **Build and deployment**:
     * **Source:** Selecciona `Deploy from a branch`.
     * **Branch:** Selecciona `main` (o `master`) y la carpeta `/ (root)`.
     * Haz clic en **Save** (Guardar).

4. **¡Listo! Acceso Web:**
   * En 1 a 2 minutos, GitHub te proporcionará tu enlace público oficial:
     `https://<tu-usuario>.github.io/<tu-repositorio>/`
