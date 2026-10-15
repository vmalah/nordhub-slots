import { test, expect } from 'playwright/test';
import { openAt, seedBookings, booking } from './helpers';

test.describe('Мои брони @bookings', () => {
  test('пустое состояние, если броней нет @smoke', async ({ page }) => {
    await openAt(page, 'my');
    await expect(page.getByText('У вас пока нет броней')).toBeVisible();
  });

  test('показывает бронь с номером, складом и временем', async ({ page }) => {
    await seedBookings(page, [booking()]);
    await openAt(page, 'my');
    const card = page.getByTestId('booking');
    await expect(card).toContainText('NH-2026-004817');
    await expect(card).toContainText('NordHub · Склад Подольск-2');
    await expect(card).toContainText('16.10.2026, 10:00–11:00');
  });

  test('бронь можно отменить, если до слота 3 часа и больше', async ({ page }) => {
    await seedBookings(page, [booking({ date: '2026-10-15', hour: 13 })]);
    await openAt(page, 'my', '2026-10-15T10:00:00'); // ровно 3 часа — граница
    await page.getByRole('button', { name: 'Отменить бронь' }).click();
    await expect(page.getByText('Бронь отменена')).toBeVisible();
    await expect(page.getByText('У вас пока нет броней')).toBeVisible();
  });

  test('отмена недоступна, если до слота меньше 3 часов', async ({ page }) => {
    await seedBookings(page, [booking({ date: '2026-10-15', hour: 13 })]);
    await openAt(page, 'my', '2026-10-15T10:01:00');
    await expect(page.getByRole('button', { name: 'Отменить бронь' })).toBeDisabled();
    await expect(page.getByText('отмена недоступна')).toBeVisible();
  });
});
