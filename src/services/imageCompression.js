/**
 * Utilidad Central de Conversión y Compresión a Base64
 * SIGNUM MOTORVEN • Base de Datos DB_SIGNUM_MOTORVEN
 *
 * Convierte cualquier foto o imagen subida desde cualquier dispositivo
 * a formato Base64 (DataURL) antes de persistirla en Supabase o Storage.
 */

/**
 * Convierte un archivo nativo File o Blob a DataURL (Base64 puro) sin pérdida
 */
export async function fileToBase64(file) {
  if (!file) throw new Error("No se proporcionó ningún archivo.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Error al leer el archivo en Base64."));
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const base64Content = (dataUrl || '').split(',')[1] || '';
      const byteLength = Math.round((base64Content.length * 3) / 4);
      resolve({
        dataUrl,
        sizeBytes: byteLength,
        sizeKb: Number((byteLength / 1024).toFixed(1)),
        mimeType: file.type || 'image/jpeg'
      });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Convierte y optimiza cualquier imagen a Base64 respetando sus proporciones
 * Ideal para productos, lubricantes, comprobantes y fachadas.
 * 
 * @param {File|Blob|string} fileOrDataUrl
 * @param {object} options { maxWidth, maxHeight, quality, mimeType }
 * @returns {Promise<{ dataUrl: string, width: number, height: number, sizeBytes: number, sizeKb: number, mimeType: string }>}
 */
export async function compressImageToBase64(fileOrDataUrl, options = {}) {
  const {
    maxWidth = 1000,
    maxHeight = 1000,
    quality = 0.82,
    mimeType = 'image/jpeg'
  } = options;

  if (!fileOrDataUrl) {
    throw new Error("No se seleccionó ningún archivo de imagen.");
  }

  // Si ya es un Base64 DataURL y es ligero (<100KB), validarlo
  if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:')) {
    const base64Content = fileOrDataUrl.split(',')[1] || '';
    const byteLength = Math.round((base64Content.length * 3) / 4);
    if (byteLength < 100 * 1024) {
      return {
        dataUrl: fileOrDataUrl,
        sizeBytes: byteLength,
        sizeKb: Number((byteLength / 1024).toFixed(1)),
        mimeType: fileOrDataUrl.substring(5, fileOrDataUrl.indexOf(';')) || mimeType
      };
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("No se pudo procesar la imagen seleccionada."));

    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        // Calcular escalado proporcional si supera límites
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL(mimeType, quality);
        const base64Content = dataUrl.split(',')[1] || '';
        const byteLength = Math.round((base64Content.length * 3) / 4);

        resolve({
          dataUrl,
          width,
          height,
          sizeBytes: byteLength,
          sizeKb: Number((byteLength / 1024).toFixed(1)),
          mimeType
        });
      } catch (err) {
        reject(err);
      }
    };

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Error al leer el archivo de imagen."));
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}

/**
 * Compresión optimizada en formato Base64 ligero para fichas de clientes (RIF/Cédula y Local Comercial).
 * Garantiza archivos livianos (<= ~75 KB) para no recargar el sistema, localStorage ni la BD JSON.
 *
 * @param {File|Blob|string} fileOrDataUrl
 * @param {object} options { maxBytes, maxWidth, maxHeight, quality }
 * @returns {Promise<{ dataUrl: string, width: number, height: number, sizeBytes: number, sizeKb: number, mimeType: string }>}
 */
export async function compressClientImageToBase64(fileOrDataUrl, options = {}) {
  const {
    maxBytes = 75 * 1024,
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.72
  } = options;

  let result = await compressImageToBase64(fileOrDataUrl, {
    maxWidth,
    maxHeight,
    quality,
    mimeType: 'image/jpeg'
  });

  if (result.sizeBytes > maxBytes) {
    result = await compressImageToBase64(result.dataUrl, {
      maxWidth: 640,
      maxHeight: 640,
      quality: 0.56,
      mimeType: 'image/jpeg'
    });
  }

  if (result.sizeBytes > maxBytes) {
    result = await compressImageToBase64(result.dataUrl, {
      maxWidth: 540,
      maxHeight: 540,
      quality: 0.45,
      mimeType: 'image/jpeg'
    });
  }

  return result;
}

/**
 * Compresión de fotos de perfil y avatares (cuadrado 1:1 centrado)
 */
export async function compressProfileImage(file, options = {}) {
  const {
    maxSize = 250, // 250x250 px para máxima fidelidad en HD
    quality = 0.82,
    mimeType = 'image/jpeg'
  } = options;

  if (!file) {
    throw new Error("No se seleccionó ningún archivo de imagen.");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Error al leer el archivo de imagen."));

    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("No se pudo procesar la imagen seleccionada."));

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          // Recorte centrado en formato cuadrado 1:1
          const minSide = Math.min(img.width, img.height);
          const sx = (img.width - minSide) / 2;
          const sy = (img.height - minSide) / 2;

          const finalSize = Math.min(maxSize, minSide);
          canvas.width = finalSize;
          canvas.height = finalSize;

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, finalSize, finalSize);

          const dataUrl = canvas.toDataURL(mimeType, quality);
          const base64Content = dataUrl.split(',')[1] || '';
          const byteLength = Math.round((base64Content.length * 3) / 4);

          resolve({
            dataUrl,
            width: finalSize,
            height: finalSize,
            sizeBytes: byteLength,
            sizeKb: Number((byteLength / 1024).toFixed(1)),
            mimeType
          });
        } catch (err) {
          reject(err);
        }
      };

      img.src = e.target.result;
    };

    reader.readAsDataURL(file);
  });
}
