import { test, expect, Page } from 'playwright/test';
import { openAt, seedBookings, booking } from './helpers';

// SCRUM-5 · Бронирование слота на разгрузку.
// Каждый тест ссылается на критерий приёмки (AC) из задачи в Jira.
// «Сейчас» во всех тестах — 15.10.2026 10:00 (Москва), если не указано иное.

const WAREHOUSE = 'NordHub · Склад Подольск-2';

async function pickSlot(page: Page, date: string, hour: number) {
  await page.locator('#warehouse').selectOption({ label: WAREHOUSE });
  await page.locator('#date').fill(date);
  await page.getByTestId('show-slots').click();
  await page.locator(`[data-testid="slot"][data-hour="${hour}"]`).click();
}

async function fillCargo(page: Page, data: Partial<Record<'vehicle' | 'plate' | 'pallets' | 'weight', string>> = {}) {
  await page.locator('#vehicleType').selectOption({ label: data.vehicle ?? 'Фура (тент, до 20 т)' });
  await page.locator('#plate').fill(data.plate ?? 'А123ВС 777');
  await page.locator('#pallets').fill(data.pallets ?? '18');
  await page.locator('#weight').fill(data.weight ?? '12.4');
}

const submit = (page: Page) => page.getByRole('button', { name: 'Забронировать' }).click();
const success = (page: Page) => page.getByRole('heading', { name: 'Слот забронирован' });
const fieldError = (page: Page, field: string) => page.locator(`[data-field="${field}"] .error`);

test.describe('Бронирование слота · SCRUM-5 @booking', () => {
  test('AC-10 · успешное бронирование: экран успеха, бронь в списке, слот занят @smoke', async ({ page }) => {
    await openAt(page, 'schedule');
    await pickSlot(page, '2026-10-16', 10);
    await fillCargo(page);
    await submit(page);

    await expect(success(page)).toBeVisible();
    await expect(page.getByTestId('booking-number')).toHaveText(/^NH-2026-\d{6}$/);

    await page.getByRole('link', { name: 'К моим броням' }).click();
    await expect(page.getByTestId('booking')).toContainText('16.10.2026, 10:00–11:00');

    await page.getByRole('link', { name: 'Бронирование' }).click();
    await page.locator('#date').fill('2026-10-16');
    await page.getByTestId('show-slots').click();
    await expect(page.locator('[data-testid="slot"][data-hour="10"]')).toBeDisabled();
  });

  test('AC-3 · занятый слот нельзя выбрать', async ({ page }) => {
    await openAt(page, 'schedule');
    await page.locator('#date').fill('2026-10-16');
    await page.getByTestId('show-slots').click();
    await expect(page.locator('[data-testid="slot"][data-hour="9"]')).toBeDisabled();
  });

  test('AC-3 · в расписании 8 слотов, последний 16:00–17:00', async ({ page }) => {
    await openAt(page, 'schedule');
    await page.locator('#date').fill('2026-10-16');
    await page.getByTestId('show-slots').click();
    await expect(page.getByTestId('slot')).toHaveCount(8);
    await expect(page.getByTestId('slot').last()).toContainText('16:00–17:00');
  });

  test('AC-2 · можно забронировать слот на сегодня', async ({ page }) => {
    await openAt(page, 'schedule');
    await pickSlot(page, '2026-10-15', 14); // через 4 часа
    await fillCargo(page);
    await submit(page);
    await expect(success(page)).toBeVisible();
  });

  test('AC-2 · граница: ровно через 14 дней — можно', async ({ page }) => {
    await openAt(page, 'schedule');
    await pickSlot(page, '2026-10-29', 10);
    await fillCargo(page);
    await submit(page);
    await expect(success(page)).toBeVisible();
  });

  test('AC-2 · граница: через 15 дней — нельзя', async ({ page }) => {
    await openAt(page, 'schedule');
    await pickSlot(page, '2026-10-30', 10);
    await fillCargo(page);
    await submit(page);
    await expect(fieldError(page, 'date')).toBeVisible();
  });

  test('AC-4 · слот, до которого меньше 2 часов, забронировать нельзя', async ({ page }) => {
    await openAt(page, 'schedule');
    await pickSlot(page, '2026-10-15', 11); // через 1 час
    await fillCargo(page);
    await submit(page);
    await expect(fieldError(page, 'hour')).toBeVisible();
    await expect(success(page)).toHaveCount(0);
  });

  test('AC-5 · в списке типов ТС ровно три типа из требований', async ({ page }) => {
    await openAt(page, 'schedule');
    const options = page.locator('#vehicleType option:not([value=""])');
    await expect(options).toHaveText([
      'Фура (тент, до 20 т)',
      'Рефрижератор',
      'Малотоннажное (до 3,5 т)',
    ]);
  });

  test('AC-6 · госномер обязателен', async ({ page }) => {
    await openAt(page, 'schedule');
    await pickSlot(page, '2026-10-16', 10);
    await fillCargo(page, { plate: '' });
    await submit(page);
    await expect(fieldError(page, 'plate')).toHaveText('Укажите госномер');
  });

  test('AC-7 · граничные значения паллет: 0 и 34 — ошибка', async ({ page }) => {
    await openAt(page, 'schedule');
    await pickSlot(page, '2026-10-16', 10);
    for (const value of ['0', '34']) {
      await fillCargo(page, { pallets: value });
      await submit(page);
      await expect(fieldError(page, 'pallets'), `паллет: ${value}`).toBeVisible();
    }
  });

  test('AC-7 · граничное значение: 33 паллеты — можно', async ({ page }) => {
    await openAt(page, 'schedule');
    await pickSlot(page, '2026-10-16', 10);
    await fillCargo(page, { pallets: '33' });
    await submit(page);
    await expect(success(page)).toBeVisible();
  });

  test('AC-8 · вес больше 20 с дробной частью через запятую — ошибка', async ({ page }) => {
    await openAt(page, 'schedule');
    await pickSlot(page, '2026-10-16', 10);
    await fillCargo(page, { weight: '20,5' });
    await submit(page);
    await expect(fieldError(page, 'weight')).toBeVisible();
  });

  test('AC-10 · двойной клик по «Забронировать» создаёт одну бронь', async ({ page }) => {
    await openAt(page, 'schedule');
    await pickSlot(page, '2026-10-16', 10);
    await fillCargo(page);
    await page.getByRole('button', { name: 'Забронировать' }).dblclick();
    await expect(success(page)).toBeVisible();

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nordhub.bookings') || '[]'));
    expect(saved).toHaveLength(1);
  });

  test('собственная бронь отображается как занятый слот', async ({ page }) => {
    await seedBookings(page, [booking({ date: '2026-10-16', hour: 15 })]);
    await openAt(page, 'schedule');
    await page.locator('#date').fill('2026-10-16');
    await page.getByTestId('show-slots').click();
    await expect(page.locator('[data-testid="slot"][data-hour="15"]')).toBeDisabled();
  });
});
