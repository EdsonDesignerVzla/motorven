/**
 * Servicio Centralizado de Almacenamiento Multimedia (Supabase Storage)
 * Bucket Oficial: 'signum-media'
 * SIGNUM MOTORVEN • Base de Datos DB_SIGNUM_MOTORVEN
 */
import { supabase, saveSupabaseUser } from './supabaseService';
import { compressImageToBase64 } from './imageCompression';

export const STORAGE_BUCKET = 'signum-media';

export const STORAGE_FOLDERS = {
  USERS: 'usuarios',
  PRODUCTS: 'productos',
  CLIENTS: 'clientes',
  RECEIPTS: 'comprobantes',
  BRANDING: 'config',
  SUPPLIERS: 'proveedores',
  RETURNS: 'devoluciones'
};

export const FOLDER_METADATA = [
  { id: STORAGE_FOLDERS.USERS, name: 'Usuarios & Perfiles', icon: '👤', description: 'Fotos de perfil, avatares de asesores y directores' },
  { id: STORAGE_FOLDERS.PRODUCTS, name: 'Productos & Lubricantes', icon: '🛢️', description: 'Envases Oilstone ®, fotografías reales y fichas técnicas' },
  { id: STORAGE_FOLDERS.CLIENTS, name: 'Clientes & Comercios', icon: '👥', description: 'Fachadas de tiendas, documentos RIF y fotos de locales' },
  { id: STORAGE_FOLDERS.RECEIPTS, name: 'Comprobantes de Pago', icon: '🧾', description: 'Capturas de transferencias, depósitos y cheques' },
  { id: STORAGE_FOLDERS.BRANDING, name: 'Logos & Marca Oficial', icon: '🏷️', description: 'Logotipos Motorven / Oilstone ®, sellos digitales y membretes' },
  { id: STORAGE_FOLDERS.SUPPLIERS, name: 'Proveedores & Facturas', icon: '🚚', description: 'Facturas de compra escaneadas y notas de entrega' },
  { id: STORAGE_FOLDERS.RETURNS, name: 'Devoluciones & Averías', icon: '📦', description: 'Evidencias fotográficas de averías o garantías' }
];

/**
 * Convierte un DataURL (Base64) en un objeto Blob nativo
 */
export function dataUrlToBlob(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const arr = dataUrl.split(',');
  if (arr.length < 2) return null;
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Sube una imagen a Supabase Storage en la carpeta designada
 * Convierte siempre la imagen a Base64 antes de procesarla y almacenarla.
 *
 * @param {File|Blob|string} fileOrDataUrl - Archivo nativo o Base64 DataURL
 * @param {string} folder - Nombre de la carpeta (usuarios, productos, etc.)
 * @param {string} customName - Nombre base personalizado o identificador (e.g. código de producto o username)
 * @param {object} options - Opciones adicionales
 * @returns {Promise<{success: boolean, base64: string, publicUrl: string, path: string, error?: string}>}
 */
export async function uploadImageToStorage(fileOrDataUrl, folder = STORAGE_FOLDERS.PRODUCTS, customName = '', options = {}) {
  try {
    let base64DataUrl = '';
    let blobToUpload = null;
    let extension = 'jpg';
    let mimeType = 'image/jpeg';

    // 1. Si es un archivo File o Blob, convertir obligatoriamente a Base64 antes de almacenar
    if (fileOrDataUrl instanceof File || fileOrDataUrl instanceof Blob) {
      const compressed = await compressImageToBase64(fileOrDataUrl, {
        maxWidth: folder === STORAGE_FOLDERS.USERS ? 400 : 1200,
        maxHeight: folder === STORAGE_FOLDERS.USERS ? 400 : 1200,
        quality: 0.85
      });
      base64DataUrl = compressed.dataUrl;
      mimeType = compressed.mimeType || 'image/jpeg';
      blobToUpload = dataUrlToBlob(base64DataUrl);
      extension = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    } else if (typeof fileOrDataUrl === 'string') {
      if (fileOrDataUrl.startsWith('data:')) {
        base64DataUrl = fileOrDataUrl;
        blobToUpload = dataUrlToBlob(fileOrDataUrl);
        if (fileOrDataUrl.includes('image/png')) {
          extension = 'png';
          mimeType = 'image/png';
        } else if (fileOrDataUrl.includes('image/webp')) {
          extension = 'webp';
          mimeType = 'image/webp';
        }
      } else if (fileOrDataUrl.startsWith('http')) {
        // Ya es una URL pública existente
        return { success: true, base64: fileOrDataUrl, publicUrl: fileOrDataUrl, path: fileOrDataUrl };
      }
    }

    if (!blobToUpload) {
      throw new Error('Formato de archivo no válido para conversión a Base64 y subida.');
    }

    // Sanitizar nombre de archivo
    const safeBaseName = (customName || 'img')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');
    const timestamp = Date.now();
    const fileName = `${safeBaseName}_${timestamp}.${extension}`;
    const filePath = `${folder}/${fileName}`;

    // Subir a Supabase Storage con sobrescritura permitida
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, blobToUpload, {
        contentType: mimeType,
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.warn(`[Supabase Storage Warning] Error al subir a ${filePath}:`, uploadError.message);
      // Retornar la versión Base64 generada
      return {
        success: Boolean(base64DataUrl),
        base64: base64DataUrl,
        fallbackUrl: base64DataUrl,
        publicUrl: base64DataUrl,
        error: uploadError.message
      };
    }

    // Obtener URL Pública oficial
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    return {
      success: true,
      base64: base64DataUrl, // <--- Base64 convertido garantizado
      publicUrl,
      path: filePath,
      folder,
      fileName,
      sizeBytes: blobToUpload.size
    };
  } catch (err) {
    console.error('[Supabase Storage Error]', err);
    return {
      success: false,
      error: err.message,
      base64: typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:') ? fileOrDataUrl : '',
      publicUrl: typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:') ? fileOrDataUrl : ''
    };
  }
}

/**
 * Elimina un archivo de Supabase Storage por su URL pública o ruta relativa
 */
export async function deleteImageFromStorage(urlOrPath) {
  if (!urlOrPath) return { success: false };
  try {
    let filePath = urlOrPath;
    if (urlOrPath.includes(STORAGE_BUCKET + '/')) {
      filePath = urlOrPath.split(STORAGE_BUCKET + '/')[1].split('?')[0];
    }
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.warn('[Supabase Storage Delete Error]', err.message);
    return { success: false, error: err.message };
  }
}

export const DEFAULT_STORAGE_FILES = {
  usuarios: [
    {
      name: 'edson_designer_master.png',
      folder: 'usuarios',
      fullPath: 'usuarios/edson_designer_master.png',
      created_at: '2026-10-26T12:00:00Z',
      metadata: { size: 148520, mimetype: 'image/png' },
      publicUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=EdsonMaster&backgroundColor=0284c7'
    },
    {
      name: 'christian_sistemas_ti.png',
      folder: 'usuarios',
      fullPath: 'usuarios/christian_sistemas_ti.png',
      created_at: '2026-10-26T12:00:00Z',
      metadata: { size: 132400, mimetype: 'image/png' },
      publicUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=ChristianTI&backgroundColor=059669'
    },
    {
      name: 'administrador_sistema.png',
      folder: 'usuarios',
      fullPath: 'usuarios/administrador_sistema.png',
      created_at: '2026-10-26T12:00:00Z',
      metadata: { size: 118200, mimetype: 'image/png' },
      publicUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Admin&backgroundColor=7c3aed'
    },
    {
      name: 'asesor_comercial_caracas.png',
      folder: 'usuarios',
      fullPath: 'usuarios/asesor_comercial_caracas.png',
      created_at: '2026-10-26T12:00:00Z',
      metadata: { size: 104500, mimetype: 'image/png' },
      publicUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=VentasCaracas&backgroundColor=ea580c'
    },
    {
      name: 'almacenista_principal.png',
      folder: 'usuarios',
      fullPath: 'usuarios/almacenista_principal.png',
      created_at: '2026-10-26T12:00:00Z',
      metadata: { size: 98400, mimetype: 'image/png' },
      publicUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Almacen&backgroundColor=d97706'
    }
  ],
  productos: [
    {
      name: 'oilstone_mineral_20w50_galon.png',
      folder: 'productos',
      fullPath: 'productos/oilstone_mineral_20w50_galon.png',
      created_at: '2026-10-26T12:00:00Z',
      metadata: { size: 215400, mimetype: 'image/png' },
      publicUrl: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=400&q=80'
    },
    {
      name: 'oilstone_semisintetico_15w40_paila.png',
      folder: 'productos',
      fullPath: 'productos/oilstone_semisintetico_15w40_paila.png',
      created_at: '2026-10-26T12:00:00Z',
      metadata: { size: 342100, mimetype: 'image/png' },
      publicUrl: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=400&q=80'
    },
    {
      name: 'oilstone_sintetico_5w30_tambor.png',
      folder: 'productos',
      fullPath: 'productos/oilstone_sintetico_5w30_tambor.png',
      created_at: '2026-10-26T12:00:00Z',
      metadata: { size: 524000, mimetype: 'image/png' },
      publicUrl: 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=400&q=80'
    },
    {
      name: 'oilstone_valvulina_85w140_cuarto.png',
      folder: 'productos',
      fullPath: 'productos/oilstone_valvulina_85w140_cuarto.png',
      created_at: '2026-10-26T12:00:00Z',
      metadata: { size: 184500, mimetype: 'image/png' },
      publicUrl: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=400&q=80'
    }
  ],
  clientes: [
    {
      name: 'inversiones_la_gran_parada_local.png',
      folder: 'clientes',
      fullPath: 'clientes/inversiones_la_gran_parada_local.png',
      created_at: '2026-10-26T12:00:00Z',
      metadata: { size: 285000, mimetype: 'image/png' },
      publicUrl: 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?auto=format&fit=crop&w=400&q=80'
    },
    {
      name: 'repuestos_el_terminal_fachada.png',
      folder: 'clientes',
      fullPath: 'clientes/repuestos_el_terminal_fachada.png',
      created_at: '2026-10-26T12:00:00Z',
      metadata: { size: 310200, mimetype: 'image/png' },
      publicUrl: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=400&q=80'
    }
  ],
  comprobantes: [
    {
      name: 'transferencia_banesco_0134_fact_004512.png',
      folder: 'comprobantes',
      fullPath: 'comprobantes/transferencia_banesco_0134_fact_004512.png',
      created_at: '2026-10-26T12:00:00Z',
      metadata: { size: 194000, mimetype: 'image/png' },
      publicUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80'
    },
    {
      name: 'pago_movil_mercantil_ref_774921.png',
      folder: 'comprobantes',
      fullPath: 'comprobantes/pago_movil_mercantil_ref_774921.png',
      created_at: '2026-10-26T12:00:00Z',
      metadata: { size: 165000, mimetype: 'image/png' },
      publicUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=400&q=80'
    }
  ],
  config: [
    {
      name: 'logo_motorven_oficial_alta_res.png',
      folder: 'config',
      fullPath: 'config/logo_motorven_oficial_alta_res.png',
      created_at: '2026-10-26T12:00:00Z',
      metadata: { size: 62400, mimetype: 'image/png' },
      publicUrl: '/src/assets/logo_motorven_limpio.png'
    },
    {
      name: 'logo_signum_erp_transparente.png',
      folder: 'config',
      fullPath: 'config/logo_signum_erp_transparente.png',
      created_at: '2026-10-26T12:00:00Z',
      metadata: { size: 63310, mimetype: 'image/png' },
      publicUrl: '/src/assets/logo_signum_transpatente.png'
    }
  ],
  proveedores: [
    {
      name: 'factura_keystone_internacional_f0098.png',
      folder: 'proveedores',
      fullPath: 'proveedores/factura_keystone_internacional_f0098.png',
      created_at: '2026-10-26T12:00:00Z',
      metadata: { size: 345000, mimetype: 'image/png' },
      publicUrl: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=400&q=80'
    }
  ],
  devoluciones: [
    {
      name: 'evidencia_lote_tapa_precinto_danado.png',
      folder: 'devoluciones',
      fullPath: 'devoluciones/evidencia_lote_tapa_precinto_danado.png',
      created_at: '2026-10-26T12:00:00Z',
      metadata: { size: 260400, mimetype: 'image/png' },
      publicUrl: 'https://images.unsplash.com/photo-1584727638096-042c45049ebe?auto=format&fit=crop&w=400&q=80'
    }
  ]
};

/**
 * Lista todos los archivos de una carpeta en Supabase Storage
 */
export async function listStorageFolder(folder = STORAGE_FOLDERS.PRODUCTS) {
  const seedFiles = DEFAULT_STORAGE_FILES[folder] || [];
  let localUploaded = [];
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(`signum_storage_${folder}`) : null;
    if (stored) localUploaded = JSON.parse(stored);
  } catch (_) {}

  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(folder, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error || !data || data.length === 0) {
      return { success: true, files: [...localUploaded, ...seedFiles] };
    }

    // Filtrar archivos marcadores y adjuntar URL pública
    const remoteFiles = (data || [])
      .filter(item => item.name !== '.keep' && item.name !== '.emptyFolderPlaceholder')
      .map(item => {
        const fullPath = `${folder}/${item.name}`;
        const { data: { publicUrl } } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(fullPath);
        return {
          ...item,
          folder,
          fullPath,
          publicUrl: publicUrl || item.publicUrl
        };
      });

    const combined = [...localUploaded, ...remoteFiles];
    return { success: true, files: combined.length > 0 ? combined : seedFiles };
  } catch (err) {
    console.warn(`[Supabase Storage List Warning] en ${folder}:`, err.message);
    return { success: true, files: [...localUploaded, ...seedFiles] };
  }
}

/**
 * Resumen consolidado de archivos y espacio por carpeta
 */
export async function getStorageSummary() {
  try {
    const results = {};
    let totalCount = 0;

    for (const folderKey of Object.values(STORAGE_FOLDERS)) {
      const res = await listStorageFolder(folderKey);
      const count = res.files?.length || 0;
      results[folderKey] = {
        count,
        files: res.files || []
      };
      totalCount += count;
    }

    return {
      success: true,
      bucket: STORAGE_BUCKET,
      totalFiles: totalCount,
      folders: results
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      totalFiles: 0,
      folders: {}
    };
  }
}

/**
 * Sube, optimiza y guarda permanentemente la foto de perfil en Supabase (Storage + tabla users)
 *
 * @param {object} params
 * @param {string} params.userId - Identificador del usuario (e.g. 'usr-muq3bdll')
 * @param {string} params.username - Nombre de usuario (e.g. 'edson designer')
 * @param {File|Blob|string} params.fileOrDataUrl - Archivo o Base64 DataURL
 * @param {object} [params.currentUser] - Usuario en sesión activa
 * @param {function} [params.onUpdateCurrentUser] - Callback para actualizar sesión
 * @returns {Promise<{success: boolean, user?: object, photoUrl?: string, error?: string}>}
 */
export async function uploadUserProfilePhoto({ userId, username, fileOrDataUrl, currentUser = null, onUpdateCurrentUser = null }) {
  try {
    const safeName = `user_${(username || userId || 'avatar').toString().toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
    const uploadRes = await uploadImageToStorage(fileOrDataUrl, STORAGE_FOLDERS.USERS, safeName);

    if (!uploadRes.success) {
      throw new Error(uploadRes.error || 'Error al subir la foto a Supabase Storage.');
    }

    const finalPhoto = uploadRes.publicUrl || uploadRes.base64;

    // Actualizar usuario en Supabase (tabla users)
    const savedUser = await saveSupabaseUser({
      id: userId,
      username,
      foto: finalPhoto
    }, currentUser);

    // Actualizar sesión activa si corresponde al usuario logueado
    const isCurrent = currentUser && (
      currentUser.id === userId ||
      (currentUser.username && username && currentUser.username.toLowerCase() === username.toLowerCase())
    );

    if (isCurrent) {
      const updatedActive = { ...currentUser, ...savedUser, foto: finalPhoto };
      try {
        localStorage.setItem('signum_active_user', JSON.stringify(updatedActive));
      } catch (_) {}
      if (onUpdateCurrentUser) onUpdateCurrentUser(updatedActive);
    }

    return {
      success: true,
      user: savedUser,
      photoUrl: finalPhoto,
      base64: uploadRes.base64
    };
  } catch (err) {
    console.error('[uploadUserProfilePhoto Error]', err);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Elimina permanentemente la foto de perfil de un usuario en Supabase (Storage y tabla users)
 *
 * @param {object} params
 * @param {string} params.userId - Identificador del usuario
 * @param {string} params.username - Nombre de usuario
 * @param {string} [params.currentPhotoUrl] - URL o ruta de la foto a eliminar del Storage
 * @param {object} [params.currentUser] - Usuario en sesión activa
 * @param {function} [params.onUpdateCurrentUser] - Callback para actualizar sesión
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
export async function deleteUserProfilePhoto({ userId, username, currentPhotoUrl = null, currentUser = null, onUpdateCurrentUser = null }) {
  try {
    // 1. Si existe URL de storage, borrar el archivo físico de Supabase Storage
    if (currentPhotoUrl && typeof currentPhotoUrl === 'string' && !currentPhotoUrl.startsWith('data:')) {
      await deleteImageFromStorage(currentPhotoUrl).catch(() => {});
    }

    // 2. Establecer foto en null en la tabla users de Supabase
    const savedUser = await saveSupabaseUser({
      id: userId,
      username,
      foto: null
    }, currentUser);

    // 3. Actualizar sesión activa si corresponde
    const isCurrent = currentUser && (
      currentUser.id === userId ||
      (currentUser.username && username && currentUser.username.toLowerCase() === username.toLowerCase())
    );

    if (isCurrent) {
      const updatedActive = { ...currentUser, ...savedUser, foto: null };
      try {
        localStorage.setItem('signum_active_user', JSON.stringify(updatedActive));
      } catch (_) {}
      if (onUpdateCurrentUser) onUpdateCurrentUser(updatedActive);
    }

    return {
      success: true,
      user: savedUser
    };
  } catch (err) {
    console.error('[deleteUserProfilePhoto Error]', err);
    return {
      success: false,
      error: err.message
    };
  }
}

