import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// URL y Clave anónima de Supabase inyectadas desde las variables de entorno de Vite
// .trim() elimina trailing newlines/whitespace del .env que causan HTTP 401 en WebSocket
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// ═══ MOCK AUTH para testing sin Supabase ═══
const MOCK_USERS_KEY = 'trv_mock_users';
const MOCK_SESSION_KEY = 'trv_mock_session';

interface MockUser {
  id: string;
  email: string;
  username: string;
  password: string;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
  created_at: string;
}

const getMockUsers = (): MockUser[] => {
  try {
    const stored = localStorage.getItem(MOCK_USERS_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  // Usuarios por defecto
  const defaults: MockUser[] = [
    { id: 'admin-001', email: 'kecho8a@gmail.com', username: 'maketo', password: 'admin123', user_metadata: { nombre: 'Admin', role: 'admin' }, app_metadata: { role: 'admin' }, created_at: new Date().toISOString() },
    { id: 'operator-001', email: 'op@gmail.com', username: 'operador', password: '123456', user_metadata: { nombre: 'Operador', role: 'operator' }, app_metadata: { role: 'operator' }, created_at: new Date().toISOString() },
    { id: 'customer-001', email: 'marketcoffee.ve@gmail.com', username: 'marketcoffee', password: '123456', user_metadata: { nombre: 'Cliente', role: 'customer' }, app_metadata: { role: 'customer' }, created_at: new Date().toISOString() },
  ];
  localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(defaults));
  return defaults;
};

const saveMockUsers = (users: MockUser[]) => localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));

const createMockSession = (user: MockUser) => ({
  user: { id: user.id, email: user.email, user_metadata: user.user_metadata, app_metadata: user.app_metadata },
  access_token: 'mock-token-' + user.id,
  expires_at: Date.now() + 3600000,
});

const createMockClient = (): SupabaseClient => {
  const mock: any = {
    from: () => mock,
    select: () => mock,
    insert: () => mock,
    update: () => mock,
    delete: () => mock,
    eq: () => mock,
    neq: () => mock,
    gt: () => mock,
    lt: () => mock,
    gte: () => mock,
    lte: () => mock,
    like: () => mock,
    ilike: () => mock,
    is: () => mock,
    in: () => mock,
    contains: () => mock,
    containedBy: () => mock,
    rangeGt: () => mock,
    rangeLt: () => mock,
    rangeGte: () => mock,
    rangeLte: () => mock,
    overlaps: () => mock,
    textSearch: () => mock,
    match: () => mock,
    not: () => mock,
    or: () => mock,
    filter: () => mock,
    single: () => ({ data: null, error: null }),
    maybeSingle: () => ({ data: null, error: null }),
    order: () => mock,
    limit: () => mock,
    range: () => mock,
    upsert: () => mock,
    then: (cb: (result: { data: unknown[]; error: null }) => void) => cb({ data: [], error: null }),
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
        remove: async () => ({ error: null }),
        list: async () => ({ data: [], error: null }),
      }),
    },
    auth: {
      getSession: async () => {
        try {
          const stored = localStorage.getItem(MOCK_SESSION_KEY);
          if (stored) {
            const session = JSON.parse(stored);
            if (session.expires_at > Date.now()) return { data: { session }, error: null };
            localStorage.removeItem(MOCK_SESSION_KEY);
          }
        } catch { /* ignore */ }
        return { data: { session: null }, error: null };
      },
      getUser: async () => {
        try {
          const stored = localStorage.getItem(MOCK_SESSION_KEY);
          if (stored) {
            const session = JSON.parse(stored);
            return { data: { user: session.user }, error: null };
          }
        } catch { /* ignore */ }
        return { data: { user: null }, error: null };
      },
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        const users = getMockUsers();
        const input = email.trim().toLowerCase();
        const user = users.find(u =>
          (u.username.toLowerCase() === input || u.email.toLowerCase() === input) && u.password === password.trim()
        );
        if (!user) return { data: { user: null, session: null }, error: { message: 'Credenciales incorrectas' } };
        const session = createMockSession(user);
        localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(session));
        return { data: { user: session.user, session }, error: null };
      },
      signUp: async ({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, unknown> } }) => {
        const users = getMockUsers();
        if (users.find(u => u.email === email.trim().toLowerCase())) {
          return { data: { user: null, session: null }, error: { message: 'El usuario ya existe' } };
        }
        const newUser: MockUser = {
          id: 'mock-' + Date.now(),
          email: email.trim().toLowerCase(),
          username: (options?.data?.username as string) || email.trim().split('@')[0],
          password: password.trim(),
          user_metadata: options?.data || {},
          app_metadata: {},
          created_at: new Date().toISOString(),
        };
        users.push(newUser);
        saveMockUsers(users);
        const session = createMockSession(newUser);
        localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(session));
        return { data: { user: session.user, session }, error: null };
      },
      signOut: async () => {
        localStorage.removeItem(MOCK_SESSION_KEY);
        return { error: null };
      },
      updateUser: async ({ password }: { password?: string }) => {
        try {
          const stored = localStorage.getItem(MOCK_SESSION_KEY);
          if (stored) {
            const session = JSON.parse(stored);
            if (password) {
              const users = getMockUsers();
              const idx = users.findIndex(u => u.id === session.user.id);
              if (idx >= 0) { users[idx].password = password; saveMockUsers(users); }
            }
          }
        } catch { /* ignore */ }
        return { data: { user: null }, error: null };
      },
      resetPasswordForEmail: async () => ({ data: null, error: null }),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe: () => {},
          },
        },
      }),
    },
    channel: () => {
      const channelMock: any = {
        send: async () => ({ error: null }),
        on: () => channelMock,
        subscribe: () => channelMock,
        unsubscribe: async () => {},
        track: async () => ({ error: null }),
        untrack: async () => ({ error: null }),
      };
      return channelMock;
    },
    removeChannel: async () => {},
    removeAllChannels: async () => {},
    rpc: async (fn: string, params?: { [key: string]: unknown }) => {
      if (fn === 'lookup_admin_email') {
        const users = getMockUsers();
        const username = (params?.p_username as string || '').toLowerCase();
        const user = users.find(u => u.username.toLowerCase() === username);
        return user ? { data: user.email, error: null } : { data: null, error: null };
      }
      return { data: [], error: null };
    },
  };
  return mock;
};

// No-op lock: bypasses Supabase's navigator.locks which breaks in some browsers
// (TypeError: e is not a function). Sessions use localStorage, no cross-tab lock needed.
const noopLock = async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn();

// ═══ CLIENT INITIALIZATION (production-safe) ═══
// Wrapped in try-catch so that if createClient throws during module evaluation,
// the app falls back to mock client instead of crashing the entire vendor-supabase chunk.
let supabase: SupabaseClient;
let usingMockClient = false;

try {
  if (supabaseUrl && supabaseAnonKey) {
    // Validate URL format before passing to createClient
    new URL(supabaseUrl);
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: true,
        flowType: 'pkce',
        lock: noopLock,
      }
    });
  } else {
    console.warn('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — using mock client');
    supabase = createMockClient();
    usingMockClient = true;
  }
} catch (err) {
  console.error('[Supabase] createClient failed, falling back to mock client:', err);
  supabase = createMockClient();
  usingMockClient = true;
}

export { supabase, usingMockClient };

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const MAX_INPUT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_OUTPUT_SIZE_BYTES = 2 * 1024 * 1024;  // 2MB
const MAX_HEIGHT_PX = 1200;

/**
 * Comprime una imagen y la devuelve como un Blob listo para subir.
 * Incluye validación de tipo MIME, tamaño y manejo robusto de errores.
 */
export const compressImage = async (
  file: File,
  options: { maxWidth?: number; quality?: number; format?: 'image/webp' | 'image/jpeg' | 'image/png' } = {}
): Promise<Blob> => {
  const { maxWidth = 800, quality = 0.8, format = 'image/webp' } = options;

  // Validación de tipo MIME
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(`Tipo de archivo no permitido: ${file.type || 'desconocido'}. Use JPG, PNG, GIF o WebP.`);
  }

  // Validación de tamaño antes de procesar
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

        // Limitar ancho
        if (width > maxWidth) {
          height = Math.round((maxWidth * height) / width);
          width = maxWidth;
        }
        // Limitar altura para imágenes extremadamente alargadas
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
              reject(new Error('Error al comprimir imagen. El formato podría no ser soportado por este navegador.'));
              return;
            }
            // Si excede el tamaño máximo, reintentar con calidad reducida
            if (blob.size > MAX_OUTPUT_SIZE_BYTES) {
              canvas.toBlob(
                (retryBlob) => {
                  if (retryBlob) resolve(retryBlob);
                  else reject(new Error('No se pudo comprimir la imagen. Intente con una imagen más pequeña.'));
                },
                format,
                0.5
              );
            } else {
              resolve(blob);
            }
          },
          format,
          quality
        );
      };
      img.onerror = () => reject(new Error('No se pudo cargar la imagen. El archivo podría estar corrupto.'));
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo. Intente con otro archivo.'));
  });
};

const UPLOAD_MAX_RETRIES = 2;
const UPLOAD_RETRY_DELAY_MS = 1000;

/**
 * Sube un archivo a un bucket de Supabase Storage con reintentos.
 * Retorna la URL pública del archivo.
 */
export const uploadFileToStorage = async (
  file: File | Blob,
  bucket: string,
  folder: string,
  retries = UPLOAD_MAX_RETRIES
): Promise<string> => {
  const fileExt = file instanceof File ? file.name.split('.').pop() : 'webp';
  const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
  const filePath = `${folder}/${fileName}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type || 'image/webp'
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      if (!urlData?.publicUrl) throw new Error('No se pudo obtener la URL pública del archivo subido');
      return urlData.publicUrl;
    } catch (err: any) {
      lastError = err;
      if (attempt < retries) {
        console.warn(`[Storage] Intento ${attempt + 1}/${retries + 1} falló, reintentando en ${UPLOAD_RETRY_DELAY_MS * (attempt + 1)}ms...`, err.message);
        await new Promise(r => setTimeout(r, UPLOAD_RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }

  console.error('[Storage Upload Error]', lastError?.message, 'bucket:', bucket, 'path:', filePath, 'type:', file.type, 'size:', file.size);
  throw lastError || new Error('Error al subir archivo después de varios intentos');
};

/**
 * Comprime una imagen a WebP y la sube a Supabase Storage.
 * Función centralizada para que todos los uploads de imagen pasen por aquí.
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
    format: 'image/webp'
  });

  // Validación de tamaño del blob comprimido
  const MAX_COMPRESSED_SIZE = 2 * 1024 * 1024; // 2MB
  if (compressed.size > MAX_COMPRESSED_SIZE) {
    console.warn(`[UploadImage] Blob comprimido excede 2MB (${(compressed.size / 1024 / 1024).toFixed(1)}MB), reintentando con calidad baja`);
    const recompressed = await compressImage(file, {
      maxWidth: options.maxWidth ?? 800,
      quality: 0.4,
      format: 'image/webp'
    });
    return uploadFileToStorage(recompressed, bucket, folder);
  }

  return uploadFileToStorage(compressed, bucket, folder);
};

/**
 * Obtiene la URL pública de un archivo en Supabase Storage
 */
export const getPublicUrl = (bucket: string, path: string): string => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};