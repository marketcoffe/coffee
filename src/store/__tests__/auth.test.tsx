import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock supabaseClient before importing useApp
const mockSupabase = {
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    setSession: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
  })),
  rpc: vi.fn(),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(),
      getPublicUrl: vi.fn(),
    })),
  },
};

vi.mock('../store/supabaseClient', () => ({
  supabase: mockSupabase,
}));

// Mock fetch for edge functions
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

Object.defineProperty(navigator, 'userAgent', { value: 'test-agent' });

// Import after mocks
const { useApp } = await import('../store/AppContext');

describe('AppContext - Auth Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    sessionStorageMock.getItem.mockReturnValue(null);
    mockFetch.mockReset();
  });

  describe('registerUser', () => {
    it('creates user via Supabase Auth and sets current user', async () => {
      const mockUser = { id: 'user-123', email: 'test@test.com', user_metadata: { nombre: 'Test User', username: 'testuser', telefono: '+58412345678' } };
      
      mockSupabase.auth.signUp.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });
      
      mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null });

      const { result } = renderHook(() => useApp());
      
      let newUser: unknown;
      await act(async () => {
        newUser = await result.current.registerUser('Test User', 'testuser', 'test@test.com', '+58412345678', 'password123');
      });

      expect(newUser).toBeDefined();
      expect((newUser as { id: string }).id).toBe('user-123');
      expect(result.current.currentUser).toEqual(expect.objectContaining({ nombre: 'Test User' }));
    });

    it('throws on auth error', async () => {
      mockSupabase.auth.signUp.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Email already exists', status: 400 },
      });

      const { result } = renderHook(() => useApp());

      await expect(
        act(async () => result.current.registerUser('Test', 'test', 'test@test.com', '+58412345678', 'pass'))
      ).rejects.toThrow('Email already exists');
    });

    it('throws on rate limit (429)', async () => {
      mockSupabase.auth.signUp.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Rate limit', status: 429 },
      });

      const { result } = renderHook(() => useApp());

      await expect(
        act(async () => result.current.registerUser('Test', 'test', 'test@test.com', '+58412345678', 'pass'))
      ).rejects.toThrow('Límite de intentos alcanzado');
    });
  });

  describe('loginUser', () => {
    it('calls edge function and sets user on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: { id: 'user-123', email: 'test@test.com', username: 'testuser', nombre: 'Test User', telefono: '+58412345678' },
          session_token: 'mock-token',
          attempts_remaining: 5,
        }),
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { puntos_fidelidad: 100, puntos_historicos: 200, loyalty_points: 100, loyalty_lifetime_points: 200, codigo_referido: 'REF123', referred_by: '', referral_count: 0, sede_preferida_id: '', is_pwa_installed: false, created_at: '2026-01-01' },
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.auth.setSession.mockResolvedValueOnce({ data: { session: {} }, error: null });

      const { result } = renderHook(() => useApp());

      let loggedUser: unknown;
      await act(async () => {
        loggedUser = await result.current.loginUser('test@test.com', 'password123');
      });

      expect(loggedUser).toBeDefined();
      expect((loggedUser as { id: string }).id).toBe('user-123');
      expect(result.current.currentUser).toEqual(expect.objectContaining({ nombre: 'Test User' }));
      expect(mockSupabase.auth.setSession).toHaveBeenCalled();
    });

    it('returns null on failed login', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: 'Credenciales incorrectas.',
          locked: false,
          attempts_remaining: 4,
        }),
      });

      const { result } = renderHook(() => useApp());

      let loggedUser: unknown;
      await act(async () => {
        loggedUser = await result.current.loginUser('test@test.com', 'wrongpass');
      });

      expect(loggedUser).toBeNull();
    });

    it('returns null on locked account', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 423,
        json: async () => ({
          success: false,
          error: 'Cuenta bloqueada.',
          locked: true,
          locked_until: '2026-08-28T12:00:00Z',
          attempts_remaining: 0,
          retry_after_seconds: 900,
        }),
      });

      const { result } = renderHook(() => useApp());

      let loggedUser: unknown;
      await act(async () => {
        loggedUser = await result.current.loginUser('test@test.com', 'wrongpass');
      });

      expect(loggedUser).toBeNull();
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('sends reset email via Supabase', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValueOnce({ error: null });

      const { result } = renderHook(() => useApp());

      let res: { success: boolean; error?: string } = { success: false };
      await act(async () => {
        res = await result.current.sendPasswordResetEmail('test@test.com');
      });

      expect(res.success).toBe(true);
      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('test@test.com', expect.any(Object));
    });

    it('returns error on failure', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { message: 'User not found' } });

      const { result } = renderHook(() => useApp());

      let res: { success: boolean; error?: string } = { success: false };
      await act(async () => {
        res = await result.current.sendPasswordResetEmail('nonexistent@test.com');
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('User not found');
    });
  });

  describe('logoutUser', () => {
    it('signs out and clears current user', async () => {
      mockSupabase.auth.signOut.mockResolvedValueOnce({ error: null });

      const { result } = renderHook(() => useApp());
      result.current.setCurrentUser({ id: '1', nombre: 'Test', email: 'test@test.com', telefono: '+58412345678', contrasena: 'auth_managed', createdAt: new Date().toISOString(), puntos_fidelidad: 0, puntos_historicos: 0, codigo_referido: '', referred_by: '', referral_count: 0, sede_preferida_id: '', is_pwa_installed: false, loyalty_points: 0, loyalty_lifetime_points: 0 });

      await act(async () => {
        await result.current.logoutUser();
      });

      expect(result.current.currentUser).toBeNull();
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    it('updates user data without password', async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const { result } = renderHook(() => useApp());
      result.current.setCurrentUser({ id: '1', nombre: 'Test', email: 'test@test.com', telefono: '+58412345678', contrasena: 'auth_managed', createdAt: new Date().toISOString(), puntos_fidelidad: 0, puntos_historicos: 0, codigo_referido: '', referred_by: '', referral_count: 0, sede_preferida_id: '', is_pwa_installed: false, loyalty_points: 0, loyalty_lifetime_points: 0 });

      act(() => {
        result.current.updateUser({ nombre: 'Nuevo Nombre', telefono: '+58412999999' });
      });

      expect(result.current.currentUser?.nombre).toBe('Nuevo Nombre');
      expect(result.current.currentUser?.telefono).toBe('+58412999999');
    });

    it('does not include contrasena in update payload', async () => {
      const updateSpy = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      mockSupabase.from.mockReturnValue({ update: updateSpy });

      const { result } = renderHook(() => useApp());
      result.current.setCurrentUser({ id: '1', nombre: 'Test', email: 'test@test.com', telefono: '+58412345678', contrasena: 'auth_managed', createdAt: new Date().toISOString(), puntos_fidelidad: 0, puntos_historicos: 0, codigo_referido: '', referred_by: '', referral_count: 0, sede_preferida_id: '', is_pwa_installed: false, loyalty_points: 0, loyalty_lifetime_points: 0 });

      act(() => {
        result.current.updateUser({ nombre: 'Nuevo', contrasena: 'should-not-be-sent' });
      });

      expect(updateSpy).toHaveBeenCalledWith(expect.not.objectContaining({ contrasena: expect.anything() }));
    });
  });

  describe('updateUserByAdmin', () => {
    it('updates user by admin without password', async () => {
      const updateSpy = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      mockSupabase.from.mockReturnValue({ update: updateSpy });

      const { result } = renderHook(() => useApp());
      result.current.setUsers([{ id: 'user-1', nombre: 'Old', email: 'old@test.com', telefono: '+58412345678', contrasena: 'auth_managed', createdAt: new Date().toISOString(), puntos_fidelidad: 0, puntos_historicos: 0, codigo_referido: '', referred_by: '', referral_count: 0, sede_preferida_id: '', is_pwa_installed: false, loyalty_points: 0, loyalty_lifetime_points: 0 }]);

      act(() => {
        result.current.updateUserByAdmin('user-1', { nombre: 'Updated by Admin', email: 'new@test.com' });
      });

      expect(result.current.users[0].nombre).toBe('Updated by Admin');
      expect(result.current.users[0].email).toBe('new@test.com');
      expect(updateSpy).toHaveBeenCalledWith(expect.not.objectContaining({ contrasena: expect.anything() }));
    });
  });
});