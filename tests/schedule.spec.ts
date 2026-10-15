import { test, expect } from 'playwright/test';
import { openAt, showSlots } from './helpers';

test.describe('Расписание слотов @schedule', () => {
  test.beforeEach(async ({ page }) => {
    await openAt(page, 'schedule');
  });

  test('показывает 8 часовых слотов с 08:00 до 17:00 @smoke', async ({ page }) => {
    await showSlots(page, 'NordHub · Склад Подольск-2', '2026-10-16');
    const slots = page.getByTestId('slot');
    await expect(slots).toHaveCount(8);
    await expect(slots.first()).toContainText('08:00–09:00');
    await expect(slots.last()).toContainText('16:00–17:00');
  });

  test('обеденный слот 12:00–13:00 не показывается', async ({ page }) => {
    await showSlots(page, 'NordHub · Склад Подольск-2', '2026-10-16');
    await expect(page.getByText('12:00–13:00')).toHaveCount(0);
  });

  test('слоты других перевозчиков отмечены как занятые', async ({ page }) => {
    await showSlots(page, 'NordHub · Склад Подольск-2', '2026-10-16');
    await expect(page.locator('[data-testid="slot"][data-hour="9"]')).toContainText('Занят');
    await expect(page.locator('[data-testid="slot"][data-hour="13"]')).toContainText('Занят');
    await expect(page.locator('[data-testid="slot"][data-hour="10"]')).toContainText('Свободно');
  });

  test('при смене склада меняется занятость', async ({ page }) => {
    await showSlots(page, 'NordHub · Склад Химки-1', '2026-10-16');
    await expect(page.locator('[data-testid="slot"][data-hour="11"]')).toContainText('Занят');
    await expect(page.locator('[data-testid="slot"][data-hour="9"]')).toContainText('Свободно');
  });

  // Старый тест: ищет кнопку по тексту, а не по data-testid.
  test('кнопка поиска слотов доступна', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Показать слоты' })).toBeEnabled();
  });
});
