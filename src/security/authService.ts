import { supabase } from '../store/supabaseClient';

export interface LoginSeguroResult {
  success: boolean;
  user_id?: string;
  email?: string;
  username?: string;
  nombre?: string;
  role?: 'admin' | 'operator' | 'customer';
  active?: boolean;
  sede_id?: string;
  locked?: boolean;
  locked_until?: string;
  attempts_remaining?: number;
  error?: string;
}

export interface ResetWhatsAppResult {
  success: boolean;
  message?: string;
  token?: string;
  phone?: string;
  user_nombre?: string;
  expires_at?: string;
  user_id?: string;
  error?: string;
}

export interface LockoutStatus {
  locked: boolean;
  locked_until?: string;
  attempts_remaining: number;
  retry_after_seconds: number;
}

function getClientIP(): string {
  try {
    const stored = sessionStorage.getItem('trv_client_ip');
    if (stored) return stored;
  } catch { /* ignore */ }
  return '0.0.0.0';
}

function getUserAgent(): string {
  return navigator.userAgent || 'unknown';
}

export async function secureLogin(
  identifier: string,
  password: string
): Promise<LoginSeguroResult> {
  try {
    const { data, error } = await supabase.rpc('login_seguro', {
      p_identifier: identifier.trim(),
      p_password: password.trim(),
      p_ip_address: getClientIP() || null,
      p_user_agent: getUserAgent(),
    });

    if (error) {
      console.error('[AuthService] login_seguro RPC error:', error.message);
      return {
        success: false,
        error: 'Error de conexión. Intente de nuevo.',
        locked: false,
        attempts_remaining: 5,
      };
    }

    return data as LoginSeguroResult;
  } catch (err) {
    console.error('[AuthService] secureLogin exception:', err);
    return {
      success: false,
      error: 'Error inesperado. Intente de nuevo.',
      locked: false,
      attempts_remaining: 5,
    };
  }
}

export async function checkAccountLockout(identifier: string): Promise<LockoutStatus> {
  try {
    const { data, error } = await supabase.rpc('check_account_lockout', {
      p_identifier: identifier.trim(),
    });

    if (error) {
      return { locked: false, attempts_remaining: 5, retry_after_seconds: 0 };
    }

    return data as LockoutStatus;
  } catch {
    return { locked: false, attempts_remaining: 5, retry_after_seconds: 0 };
  }
}

export async function requestWhatsAppReset(identifier: string): Promise<ResetWhatsAppResult> {
  try {
    const { data, error } = await supabase.rpc('solicitar_reset_whatsapp', {
      p_identifier: identifier.trim(),
    });

    if (error) {
      console.error('[AuthService] solicitar_reset_whatsapp error:', error.message);
      return {
        success: false,
        error: 'Error al generar código de recuperación.',
      };
    }

    return data as ResetWhatsAppResult;
  } catch (err) {
    console.error('[AuthService] requestWhatsAppReset exception:', err);
    return {
      success: false,
      error: 'Error inesperado al solicitar recuperación.',
    };
  }
}

export async function resetPasswordViaPanel(
  userId: string,
  newPassword: string,
  adminId: string
): Promise<{ success: boolean; message?: string; target_email?: string }> {
  try {
    const { data, error } = await supabase.rpc('reset_password_manual', {
      p_user_id: userId,
      p_new_password: newPassword,
      p_admin_id: adminId,
    });

    if (error) {
      console.error('[AuthService] reset_password_manual error:', error.message);
      return {
        success: false,
        message: error.message || 'Error al restablecer contraseña.',
      };
    }

    return data as { success: boolean; message?: string; target_email?: string };
  } catch (err) {
    console.error('[AuthService] resetPasswordViaPanel exception:', err);
    return {
      success: false,
      message: 'Error inesperado al restablecer contraseña.',
    };
  }
}

export async function logSecurityEvent(
  eventType: string,
  identifier: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('security_audit_logs').insert({
      event_type: eventType,
      identifier,
      ip_address: getClientIP() || null,
      user_agent: getUserAgent(),
      metadata: metadata || {},
    });
  } catch (err) {
    console.warn('[AuthService] logSecurityEvent failed (non-critical):', err);
  }
}

export function buildWhatsAppRecoveryURL(
  phone: string,
  token: string,
  userName: string
): string {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const message = encodeURIComponent(
    `Hola, solicito recuperación de contraseña para la cuenta de *${userName}*.\n\nMi código de verificación es: *${token}*\n\nPor favor, generar mi nueva contraseña. Gracias.`
  );
  return `https://wa.me/${cleanPhone}?text=${message}`;
}
