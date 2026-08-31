import { supabase } from './supabaseClient';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_INPUT_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_OUTPUT_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_HEIGHT_PX = 1200;
const UPLOAD_MAX_RETRIES = 2;
const UPLOAD_RETRY_DELAY_MS = 1000;

/**
 * Comprime una imagen del browser a WebP usando canvas nativo.
 * Valida tipo MIME, tamaño de entrada y dimensiones máximas.
 */
export const compressImage = async (
  file: File,
  options: { maxWidth?: number; quality?: number } = {}
): Promise<Blob> => {
  const { maxWidth = 800, quality = 0.8 } = options;

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(`Tipo de archivo no permitido: ${file.type || 'desconocido'}. Use JPG, PNG o WebP.`);
  }

  if (file.size > MAX_INPUT_SIZE_BYTES) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    throw new Error(`Archivo demasiado grande (${sizeMB}MB). Máximo permitido: 10MB.`);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((maxWidth * height) / width);
          width = maxWidth;
        }
        if (height > MAX_HEIGHT_PX) {
          width = Math.round((MAX_HEIGHT_PX * width) / height);
          height = MAX_HEIGHT_PX;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo crear el contexto del canvas. Intente con otro navegador.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Error al comprimir imagen. Formato no soportado.'));
              return;
            }
            if (blob.size > MAX_OUTPUT_SIZE_BYTES) {
              canvas.toBlob(
                (retryBlob) => {
                  if (retryBlob) resolve(retryBlob);
                  else reject(new Error('No se pudo comprimir la imagen. Intente con una más pequeña.'));
                },
                'image/webp',
                0.5
              );
            } else {
              resolve(blob);
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => reject(new Error('No se pudo cargar la imagen. El archivo podría estar corrupto.'));
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo. Intente con otro.'));
  });
};

/**
 * Sube un archivo a un bucket de Supabase Storage con reintentos.
 * Usa /api/upload-image (service_role) para evitar problemas de RLS.
 * Retorna la URL pública del archivo.
 */
export const uploadFileToStorage = async (
  file: File | Blob,
  bucket: string,
  folder: string,
  retries = UPLOAD_MAX_RETRIES
): Promise<string> => {
  const fileExt = file instanceof File ? file.name.split('.').pop() || 'webp' : 'webp';
  const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
  const filePath = `${folder}/${fileName}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Try API endpoint first (bypasses RLS with service_role)
      const formData = new FormData();
      const blob = file instanceof Blob ? file : new Blob([file as unknown as BlobPart]);
      formData.append('file', blob, fileName);
      formData.append('bucket', bucket);
      formData.append('folder', folder);

      const resp = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      const result = await resp.json().catch(() => ({}));

      if (resp.ok && result.url) {
        return result.url;
      }

      // Fallback: direct Supabase client (works if user has auth session)
      console.warn('[Storage] API upload failed, trying direct Supabase:', result.error);
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type || 'image/webp',
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      if (!urlData?.publicUrl) throw new Error('No se pudo obtener la URL pública del archivo subido');
      return urlData.publicUrl;
    } catch (err: any) {
      lastError = err;
      if (attempt < retries) {
        console.warn(
          `[Storage] Intento ${attempt + 1}/${retries + 1} falló, reintentando en ${UPLOAD_RETRY_DELAY_MS * (attempt + 1)}ms...`,
          err.message
        );
        await new Promise((r) => setTimeout(r, UPLOAD_RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }

  console.error('[Storage Upload Error]', lastError?.message, 'bucket:', bucket, 'path:', filePath);
  throw lastError || new Error('Error al subir archivo después de varios intentos');
};

/**
 * Función centralizada: comprime imagen + sube a Supabase Storage + retorna URL pública.
 * TODOS los uploads de imagen del admin DEBEN usar esta función.
 */
export const uploadImage = async (
  file: File,
  bucket: string,
  folder: string,
  options: { maxWidth?: number; quality?: number } = {}
): Promise<string> => {
  const compressed = await compressImage(file, {
    maxWidth: options.maxWidth ?? 800,
    quality: options.quality ?? 0.82,
  });

  if (compressed.size > MAX_OUTPUT_SIZE_BYTES) {
    console.warn(
      `[StorageService] Blob comprimido excede 2MB (${(compressed.size / 1024 / 1024).toFixed(1)}MB), reintentando con calidad baja`
    );
    const recompressed = await compressImage(file, {
      maxWidth: options.maxWidth ?? 800,
      quality: 0.4,
    });
    return uploadFileToStorage(recompressed, bucket, folder);
  }

  return uploadFileToStorage(compressed, bucket, folder);
};

/**
 * Obtiene la URL pública de un archivo en Supabase Storage.
 */
export const getPublicUrl = (bucket: string, path: string): string => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

/**
 * Elimina un archivo de Supabase Storage.
 */
export const deleteFileFromStorage = async (
  bucket: string,
  paths: string[]
): Promise<void> => {
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) {
    console.error('[Storage Delete Error]', error.message, 'bucket:', bucket, 'paths:', paths);
    throw error;
  }
};
