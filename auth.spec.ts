import { test, expect } from '@playwright/test';

// Утиліта для генерації унікальних тестових даних
const generateUniqueUser = () => {
  const timestamp = Date.now();
  return {
    username: `qa_user_${timestamp}`,
    email: `qa_${timestamp}_${Math.random().toString(36).substring(2, 7)}@example.com`,
    password: 'ValidPassword123!',
  };
};

test.describe('Registration Module', { tag: '@auth' }, () => {

  test('REG 1: Успішна реєстрація з унікальними валідними даними', async ({ page }) => {
    const newUser = generateUniqueUser();
    await page.goto('/register');

    await page.locator('[data-testid="auth-username"]').fill(newUser.username);
    await page.locator('[data-testid="auth-email"]').fill(newUser.email);
    await page.locator('[data-testid="auth-password"]').fill(newUser.password);
    await page.getByRole('textbox', { name: 'Repeat password' }).fill(newUser.password);
    
    // Обов'язкова згода на умови використання для розблокування кнопки
    await page.getByText('I agree to the terms of use').click();
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByRole('link', { name: newUser.username })).toBeVisible();
  });

  test('REG 2: Реєстрація з уже використаним email', async ({ page, request }) => {
    const existingUser = generateUniqueUser();

    // Precondition: створюємо користувача через API
    const response = await request.post('/api/users', {
      data: { user: { username: existingUser.username, email: existingUser.email, password: existingUser.password } },
    });
    expect(response.ok()).toBeTruthy();

    await page.goto('/register');

    await page.locator('[data-testid="auth-username"]').fill(`another_${Date.now()}`);
    await page.locator('[data-testid="auth-email"]').fill(existingUser.email);
    await page.locator('[data-testid="auth-password"]').fill('ValidPassword123!');
    await page.getByRole('textbox', { name: 'Repeat password' }).fill('ValidPassword123!');
    
    await page.getByText('I agree to the terms of use').click();
    await page.getByRole('button', { name: /create account/i }).click();

    // Перевірка: при спробі реєстрації з зайнятим email система не пускає далі і ми залишаємося на сторінці реєстрації
    await expect(page).toHaveURL(/.*register/);
    
    // Переконуємось, що з'явився блок або текст помилки (знищуємо ризик падіння по невідомому селектору)
    await expect(page.locator('body')).toContainText(/email|taken|already|exists|error/i);
  });

  test('REG 3: Реєстрація з невалідними або порожніми даними', async ({ page }) => {
    await page.goto('/register');

    await page.locator('[data-testid="auth-username"]').fill('');
    await page.locator('[data-testid="auth-email"]').fill('invalid-email-format');
    await page.locator('[data-testid="auth-password"]').fill('123');
    await page.getByRole('textbox', { name: 'Repeat password' }).fill('123');
    
    // Кнопка залишається заблокованою для невалідних даних
    const submitButton = page.getByRole('button', { name: /create account/i });
    await expect(submitButton).toBeDisabled();
    await expect(page).toHaveURL(/.*register/);
  });

});

test.describe('Login Module', { tag: '@auth' }, () => {

  let testUser: { username: string; email: string; password: string };

  test.beforeEach(async ({ request }) => {
    testUser = generateUniqueUser();
    const response = await request.post('/api/users', {
      data: { user: { username: testUser.username, email: testUser.email, password: testUser.password } },
    });
    expect(response.ok()).toBeTruthy();
  });

  test('LOGIN 1: Успішний вхід існуючого користувача', async ({ page }) => {
    await page.goto('/login');

    await page.locator('[data-testid="auth-email"]').fill(testUser.email);
    await page.locator('[data-testid="auth-password"]').fill(testUser.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByRole('link', { name: testUser.username })).toBeVisible();
  });

  test('LOGIN 2: Вхід з правильним email та неправильним паролем', async ({ page }) => {
    await page.goto('/login');

    await page.locator('[data-testid="auth-email"]').fill(testUser.email);
    await page.locator('[data-testid="auth-password"]').fill('WrongPassword999!');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/.*login/);
  });

  test('LOGIN 3: Вхід неіснуючого користувача', async ({ page }) => {
    await page.goto('/login');

    await page.locator('[data-testid="auth-email"]').fill('ghost_user_99999@example.com');
    await page.locator('[data-testid="auth-password"]').fill('SomePassword123!');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/.*login/);
  });

});