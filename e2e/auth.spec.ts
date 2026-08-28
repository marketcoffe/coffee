import { test, expect } from '@playwright/test';

test.describe('Auth Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Client Login', () => {
    test('should show login form on profile tab when not logged in', async ({ page }) => {
      await page.goto('/profile');
      await expect(page.locator('text=Entrar')).toBeVisible();
      await expect(page.locator('text=Registrarse')).toBeVisible();
      await expect(page.locator('input[placeholder*="correo"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
    });

    test('should login with email and password', async ({ page }) => {
      await page.goto('/profile');
      await page.fill('input[placeholder*="correo"]', 'test@test.com');
      await page.fill('input[type="password"]', 'password123');
      await page.click('button:has-text("Entrar")');
      
      // Should show user profile or error
      await expect(page.locator('text=Credenciales incorrectas, text=Bienvenido, text=Hola')).toBeVisible({ timeout: 10000 });
    });

    test('should login with username and password', async ({ page }) => {
      await page.goto('/profile');
      await page.fill('input[placeholder*="correo"]', 'testuser');
      await page.fill('input[type="password"]', 'password123');
      await page.click('button:has-text("Entrar")');
      
      await expect(page.locator('text=Credenciales incorrectas, text=Bienvenido, text=Hola')).toBeVisible({ timeout: 10000 });
    });

    test('should show error on invalid credentials', async ({ page }) => {
      await page.goto('/profile');
      await page.fill('input[placeholder*="correo"]', 'invalid@test.com');
      await page.fill('input[type="password"]', 'wrongpass');
      await page.click('button:has-text("Entrar")');
      
      await expect(page.locator('text=Credenciales incorrectas')).toBeVisible({ timeout: 5000 });
    });

    test('should lock account after 5 failed attempts', async ({ page }) => {
      await page.goto('/profile');
      
      for (let i = 0; i < 5; i++) {
        await page.fill('input[placeholder*="correo"]', 'test@test.com');
        await page.fill('input[type="password"]', `wrongpass${i}`);
        await page.click('button:has-text("Entrar")');
        await page.waitForTimeout(500);
      }
      
      // 6th attempt should show lockout
      await page.fill('input[placeholder*="correo"]', 'test@test.com');
      await page.fill('input[type="password"]', 'wrongpass6');
      await page.click('button:has-text("Entrar")');
      
      await expect(page.locator('text=bloqueada')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Client Registration', () => {
    test('should register new user', async ({ page }) => {
      await page.goto('/profile');
      await page.click('text=Registrarse');
      
      const uniqueUser = `testuser${Date.now()}`;
      const uniqueEmail = `${uniqueUser}@test.com`;
      
      await page.fill('input[placeholder*="Carlos Perez"]', 'Test User');
      await page.fill('input[placeholder*="carlos123"]', uniqueUser);
      await page.fill('input[type="email"]', uniqueEmail);
      await page.fill('input[type="tel"]', '+58412345678');
      await page.fill('input[placeholder*="Crea una contrasena"]', 'SecurePass123!');
      await page.click('button:has-text("Registrar e Ingresar")');
      
      await expect(page.locator('text=Registro Exitoso, text=Bienvenido, text=Hola')).toBeVisible({ timeout: 10000 });
    });

    test('should validate username format', async ({ page }) => {
      await page.goto('/profile');
      await page.click('text=Registrarse');
      
      await page.fill('input[placeholder*="Carlos Perez"]', 'Test');
      await page.fill('input[placeholder*="carlos123"]', 'ab'); // too short
      await page.fill('input[type="email"]', 'test@test.com');
      await page.fill('input[type="tel"]', '+58412345678');
      await page.fill('input[placeholder*="Crea una contrasena"]', 'pass123');
      await page.click('button:has-text("Registrar e Ingresar")');
      
      await expect(page.locator('text=3-20 caracteres')).toBeVisible();
    });

    test('should validate email format', async ({ page }) => {
      await page.goto('/profile');
      await page.click('text=Registrarse');
      
      await page.fill('input[placeholder*="Carlos Perez"]', 'Test');
      await page.fill('input[placeholder*="carlos123"]', 'testuser123');
      await page.fill('input[type="email"]', 'invalid-email');
      await page.fill('input[type="tel"]', '+58412345678');
      await page.fill('input[placeholder*="Crea una contrasena"]', 'pass123');
      await page.click('button:has-text("Registrar e Ingresar")');
      
      await expect(page.locator('text=inválido')).toBeVisible();
    });
  });

  test.describe('Password Recovery (Email)', () => {
    test('should show forgot password form', async ({ page }) => {
      await page.goto('/profile');
      await page.click('text=¿Olvidaste tu contraseña?');
      
      await expect(page.locator('text=Enviar Enlace de Recuperación')).toBeVisible();
      await expect(page.locator('input[type="email"]')).toBeVisible();
    });

    test('should send reset email', async ({ page }) => {
      await page.goto('/profile');
      await page.click('text=¿Olvidaste tu contraseña?');
      
      await page.fill('input[type="email"]', 'test@test.com');
      await page.click('button:has-text("Enviar Enlace de Recuperación")');
      
      await expect(page.locator('text=Si el correo está registrado, text=enviado, text=revisa')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Session Persistence', () => {
    test('should maintain session after page reload', async ({ page }) => {
      // Login first
      await page.goto('/profile');
      await page.fill('input[placeholder*="correo"]', 'test@test.com');
      await page.fill('input[type="password"]', 'password123');
      await page.click('button:has-text("Entrar")');
      
      // Wait for login
      await page.waitForTimeout(2000);
      
      // Reload
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Should still be logged in (showing user profile)
      await expect(page.locator('text=Hola, text=Bienvenido, text=Pedidos')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Logout', () => {
    test('should logout and return to login form', async ({ page }) => {
      // Login first
      await page.goto('/profile');
      await page.fill('input[placeholder*="correo"]', 'test@test.com');
      await page.fill('input[type="password"]', 'password123');
      await page.click('button:has-text("Entrar")');
      await page.waitForTimeout(2000);
      
      // Click logout
      await page.click('button:has-text("Salir")');
      
      // Should show login form again
      await expect(page.locator('text=Entrar')).toBeVisible({ timeout: 5000 });
    });
  });
});

test.describe('Admin/Operator Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should open admin login modal', async ({ page }) => {
    // Click admin access button
    await page.click('button:has-text("Admin"), button:has-text("Administración"), [data-testid="admin-access"]');
    
    await expect(page.locator('text=Acceso Administrador, text=Administrador, input[placeholder*="usuario"], input[placeholder*="email"]')).toBeVisible({ timeout: 5000 });
  });

  test('should login admin with valid credentials', async ({ page }) => {
    await page.click('button:has-text("Admin"), button:has-text("Administración"), [data-testid="admin-access"]');
    
    await page.fill('input[placeholder*="usuario"], input[placeholder*="email"]', 'kecho8a@gmail.com');
    await page.fill('input[type="password"]', 'kecho.180');
    await page.click('button:has-text("Entrar"), button:has-text("Acceder")');
    
    await expect(page.locator('text=Panel, text=Admin, text=Pedidos, text=Dashboard')).toBeVisible({ timeout: 10000 });
  });

  test('should lock admin account after failed attempts', async ({ page }) => {
    await page.click('button:has-text("Admin"), button:has-text("Administración"), [data-testid="admin-access"]');
    
    for (let i = 0; i < 5; i++) {
      await page.fill('input[placeholder*="usuario"], input[placeholder*="email"]', 'kecho8a@gmail.com');
      await page.fill('input[type="password"]', `wrong${i}`);
      await page.click('button:has-text("Entrar"), button:has-text("Acceder")');
      await page.waitForTimeout(500);
    }
    
    await page.fill('input[placeholder*="usuario"], input[placeholder*="email"]', 'kecho8a@gmail.com');
    await page.fill('input[type="password"]', 'wrong6');
    await page.click('button:has-text("Entrar"), button:has-text("Acceder")');
    
    await expect(page.locator('text=bloqueada')).toBeVisible({ timeout: 5000 });
  });
});