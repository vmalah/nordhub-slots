import { Page } from 'playwright/test';

/** «Сейчас» для всех тестов, если тест не задаёт своё время. */
export const NOW = '2026-10-15T10:00:00';

/** Открыть страницу с зафиксированным текущим временем. */
export async function openAt(page: Page, hash: string, now = NOW) {
  await page.goto(`/?now=${now}#/${hash}`);
}

/** Положить брони пользователя в хранилище до загрузки страницы. */
export async function seedBookings(page: Page, bookings: object[]) {
  await page.addInitScript((list) => {
    localStorage.setItem('nordhub.bookings', JSON.stringify(list));
  }, bookings);
}

/** Показать слоты склада на дату на странице расписания. */
export async function showSlots(page: Page, warehouse: string, date: string) {
  await page.locator('#warehouse').selectOption({ label: warehouse });
  await page.locator('#date').fill(date);
  await page.getByTestId('show-slots').click();
}

export const booking = (overrides: object = {}) => ({
  id: 'b-1',
  number: 'NH-2026-004817',
  warehouseId: 'pdl-2',
  date: '2026-10-16',
  hour: 10,
  vehicleType: 'Фура (тент, до 20 т)',
  plate: 'А123ВС 777',
  pallets: 18,
  weight: 12.4,
  ...overrides,
});
