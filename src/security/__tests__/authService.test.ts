import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { secureLogin, checkAccountLockout, secureClientLogin, checkClientAccountLockout, requestWhatsAppReset, resetPasswordViaPanel, logSecurityEvent, buildWhatsAppRecoveryURL } from '../authService';

// Mock supabase
const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('../store/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Mock fetch for edge functions
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Store original location
const originalOrigin = window.location.origin;

beforeEach(() => {
  // Reset mocks
  mockRpc.mockClear();
  mockFrom.mockClear();
  mockFetch.mockClear();
  // Reset window.location.origin via defineProperty
  Object.defineProperty(window, 'location', {
    value: { ...window.location, origin: 'http://localhost:3000' },
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, origin: originalOrigin },
    configurable: true,
  });
  vi.clearAllMocks();
});

describe('authService - Admin/Operator Auth', () => {
  describe('secureLogin', () => {
    it('returns success result on valid credentials', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true, user_id: '123', email: 'admin@test.com', role: 'admin' },
        error: null,
      });

      const result = await secureLogin('admin@test.com', 'password123');
      expect(result.success).toBe(true);
      expect(result.user_id).toBe('123');
      expect(result.role).toBe('admin');
    });

    it('returns error on RPC failure', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid credentials' },
      });

      const result = await secureLogin('admin@test.com', 'wrong');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Error de conexión. Intente de nuevo.');
    });

    it('handles network exception', async () => {
      mockRpc.mockRejectedValueOnce(new Error('Network error'));

      const result = await secureLogin('admin@test.com', 'password123');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Error inesperado. Intente de nuevo.');
    });
  });

  describe('checkAccountLockout', () => {
    it('returns lockout status', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { locked: false, attempts_remaining: 3, retry_after_seconds: 0 },
        error: null,
      });

      const result = await checkAccountLockout('admin@test.com');
      expect(result.locked).toBe(false);
      expect(result.attempts_remaining).toBe(3);
    });

    it('handles RPC error gracefully', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Error' } });

      const result = await checkAccountLockout('admin@test.com');
      expect(result.locked).toBe(false);
      expect(result.attempts_remaining).toBe(5);
    });
  });
});

describe('authService - Client Auth (New)', () => {
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('secureClientLogin', () => {
    it('returns success with user data on valid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: { id: '123', email: 'client@test.com', username: 'client123', nombre: 'Cliente Test', telefono: '+58412345678' },
          session_token: 'mock-token',
          attempts_remaining: 5,
        }),
      });

      const result = await secureClientLogin('client@test.com', 'password123');
      expect(result.success).toBe(true);
      expect(result.user?.email).toBe('client@test.com');
      expect(result.session_token).toBe('mock-token');
    });

    it('returns locked status when account is locked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 423,
        json: async () => ({
          success: false,
          error: 'Cuenta bloqueada temporalmente.',
          locked: true,
          locked_until: '2026-08-28T12:00:00Z',
          attempts_remaining: 0,
          retry_after_seconds: 900,
        }),
      });

      const result = await secureClientLogin('client@test.com', 'wrong');
      expect(result.success).toBe(false);
      expect(result.locked).toBe(true);
      expect(result.retry_after_seconds).toBe(900);
    });

    it('handles network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await secureClientLogin('client@test.com', 'password123');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Error inesperado. Intente de nuevo.');
    });
  });

  describe('checkClientAccountLockout', () => {
    it('returns lockout status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          locked: false,
          attempts_remaining: 4,
          retry_after_seconds: 0,
          ip_attempts_remaining: 18,
        }),
      });

      const result = await checkClientAccountLockout('client@test.com');
      expect(result.locked).toBe(false);
      expect(result.attempts_remaining).toBe(4);
      expect(result.ip_attempts_remaining).toBe(18);
    });

    it('handles network error gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await checkClientAccountLockout('client@test.com');
      expect(result.locked).toBe(false);
      expect(result.attempts_remaining).toBe(5);
    });
  });
});

describe('authService - Password Recovery', () => {
  describe('requestWhatsAppReset', () => {
    it('returns token on success', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true, token: '123456', phone: '+58412345678', user_nombre: 'Test User' },
        error: null,
      });

      const result = await requestWhatsAppReset('user@test.com');
      expect(result.success).toBe(true);
      expect(result.token).toBe('123456');
    });

    it('handles RPC error', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Error' } });

      const result = await requestWhatsAppReset('user@test.com');
      expect(result.success).toBe(false);
    });
  });

  describe('resetPasswordViaPanel', () => {
    it('resets password successfully', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true, message: 'Password updated', target_email: 'user@test.com' },
        error: null,
      });

      const result = await resetPasswordViaPanel('user-123', 'newpass123', 'admin-123');
      expect(result.success).toBe(true);
    });
  });
});

describe('authService - Security Events', () => {
  describe('logSecurityEvent', () => {
    it('inserts event into audit logs', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ insert: mockInsert });

      await logSecurityEvent('test_event', 'user@test.com', { key: 'value' });

      expect(mockFrom).toHaveBeenCalledWith('security_audit_logs');
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'test_event',
        identifier: 'user@test.com',
      }));
    });

    it('handles insert error gracefully', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: { message: 'Error' } });
      mockFrom.mockReturnValue({ insert: mockInsert });

      // Should not throw
      await expect(logSecurityEvent('test_event', 'user@test.com')).resolves.toBeUndefined();
    });
  });
});

describe('authService - Utility Functions', () => {
  describe('buildWhatsAppRecoveryURL', () => {
    it('builds correct WhatsApp URL', () => {
      const url = buildWhatsAppRecoveryURL('+58 412 345 678', '123456', 'Juan Pérez');
      expect(url).toContain('wa.me/58412345678');
      expect(url).toContain('Juan%20P%C3%A9rez');
      expect(url).toContain('123456');
    });

    it('handles phone without special characters', () => {
      const url = buildWhatsAppRecoveryURL('58412345678', '654321', 'Test');
      expect(url).toContain('wa.me/58412345678');
    });
  });
});