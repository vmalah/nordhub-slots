import { test, expect, Page } from 'playwright/test';
import { openAt, showSlots, seedBookings, booking } from './helpers';

// SCRUM-5 · Бронирование слота на разгрузку.
// Ожидаемые результаты — из AC и тест-кейсов TC-001…TC-013 (документ
// «SCRUM-5 · Чек-лист и тест-кейсы P1»), а не из текущего поведения кода.
// «Сейчас» во всех тестах — 15.10.2026 10:00 (Москва), если не задано иное.

const WAREHOUSE = 'NordHub · Склад Подольск-2';
const WAREHOUSE_2 = 'NordHub · Склад Химки-1';

type BookingForm = {
  warehouse?: string;
  date?: string;
  hour?: number | null;
  vehicleType?: string;
  plate?: string;
  pallets?: string;
  weight?: string;
  comment?: string;
};

/** Валидные данные TC-001. */
const VALID: Required<BookingForm> = {
  warehouse: WAREHOUSE,
  date: '2026-10-16',
  hour: 10,
  vehicleType: 'Фура (тент, до 20 т)',
  plate: 'А123ВС 777',
  pallets: '18',
  weight: '12,4',
  comment: '',
};

const slot = (page: Page, hour: number) => page.locator(`[data-testid="slot"][data-hour="${hour}"]`);
const submit = (page: Page) => page.getByRole('button', { name: 'Забронировать' });
const successHeading = (page: Page) => page.getByRole('heading', { name: 'Слот забронирован' });
const formAlert = (page: Page) => page.getByRole('alert');
/** Ошибка валидации у поля формы (data-field — имя поля в разметке формы). */
const fieldError = (page: Page, field: string) => page.locator(`[data-field="${field}"] .error`);

/** Заполнить форму бронирования. hour: null — слот не выбирать. */
async function fillBooking(page: Page, overrides: BookingForm = {}) {
  const f = { ...VALID, ...overrides };
  await showSlots(page, f.warehouse, f.date);
  if (f.hour !== null) await slot(page, f.hour).click();
  if (f.vehicleType) await page.getByLabel('Тип ТС').selectOption({ label: f.vehicleType });
  await page.getByLabel('Госномер ТС').fill(f.plate);
  await page.getByLabel('Количество паллет').fill(f.pallets);
  await page.getByLabel('Вес груза').fill(f.weight);
  await page.getByLabel('Комментарий для склада').fill(f.comment);
}

/** Создать бронь через форму и вернуть её номер. */
async function bookViaForm(page: Page, overrides: BookingForm = {}) {
  await fillBooking(page, overrides);
  await submit(page).click();
  await expect(successHeading(page)).toBeVisible();
  return (await page.getByTestId('booking-number').textContent())!.trim();
}

/** Отправка отклонена валидацией: алерт, ошибка у поля, броней нет. */
async function expectRejected(page: Page, field: string) {
  await expect(formAlert(page)).toBeVisible();
  await expect(fieldError(page, field)).toBeVisible();
  await expect(successHeading(page)).toHaveCount(0);
  await page.getByRole('link', { name: 'Мои брони' }).click();
  await expect(page.getByText('У вас пока нет броней')).toBeVisible();
}

test.describe('Бронирование слота @booking', () => {
  test.beforeEach(async ({ page }) => {
    await openAt(page, 'schedule');
  });

  // ---------- TC-001: основной сценарий ----------

  test('AC-10 · бронь свободного слота без комментария: экран успеха с номером и деталями @smoke', async ({ page }) => {
    await fillBooking(page);
    await expect(slot(page, 10)).toContainText('Выбран');
    await submit(page).click();

    await expect(successHeading(page)).toBeVisible();
    await expect(page.getByTestId('booking-number')).toHaveText(/^NH-2026-\d{6}$/);
    await expect(page.getByText(WAREHOUSE)).toBeVisible();
    await expect(page.getByText('16.10.2026, 10:00–11:00')).toBeVisible();
    await expect(page.getByText('Фура (тент, до 20 т) · А123ВС 777')).toBeVisible();
    await expect(page.getByText(/^18 паллет/)).toBeVisible();
  });

  test('AC-10 · созданная бронь видна в «Мои брони», её слот становится занятым @smoke', async ({ page }) => {
    const number = await bookViaForm(page);

    await page.getByRole('link', { name: 'К моим броням' }).click();
    await expect(page.getByTestId('booking')).toHaveCount(1);
    await expect(page.getByTestId('booking')).toContainText(number);

    await page.getByRole('link', { name: 'Бронирование' }).click();
    await showSlots(page, WAREHOUSE, '2026-10-16');
    await expect(slot(page, 10)).toContainText('Занят');
    await expect(slot(page, 10)).toBeDisabled();
  });

  // ---------- TC-002: дата разгрузки, граничные значения ----------
  // Границы при 10:00 не зависят от В4: «сегодня» и «+14 дней» однозначны по AC-2.

  test('AC-2 · граница min − 1: вчерашняя дата — нельзя', async ({ page }) => {
    await fillBooking(page, { date: '2026-10-14', hour: 14 });
    await submit(page).click();
    await expectRejected(page, 'date');
  });

  test('AC-2 · граница min: сегодняшняя дата — можно', async ({ page }) => {
    await fillBooking(page, { date: '2026-10-15', hour: 14 });
    await submit(page).click();
    await expect(successHeading(page)).toBeVisible();
  });

  test('AC-2 · граница max: сегодня + 14 дней (29.10) — можно', async ({ page }) => {
    await fillBooking(page, { date: '2026-10-29', hour: 14 });
    await submit(page).click();
    await expect(successHeading(page)).toBeVisible();
  });

  test('AC-2 · граница max + 1: сегодня + 15 дней (30.10) — нельзя', async ({ page }) => {
    await fillBooking(page, { date: '2026-10-30', hour: 14 });
    await submit(page).click();
    await expectRejected(page, 'date');
  });

  // ---------- TC-004, TC-005, CL-13: выбор слота ----------

  test('AC-3 · занятый слот нельзя выбрать, без слота бронь не создаётся', async ({ page }) => {
    await fillBooking(page, { hour: null });
    await expect(slot(page, 9)).toBeDisabled();
    await expect(slot(page, 9)).toContainText('Занят');
    await expect(page.locator('[data-testid="slot"][aria-pressed="true"]')).toHaveCount(0);

    await submit(page).click();
    await expectRejected(page, 'hour');
  });

  test('AC-3 · смена даты после выбора слота: занятый слот новой даты не бронируется', async ({ page }) => {
    // 16.10 08:00 свободен, 17.10 08:00 занят другим перевозчиком.
    await fillBooking(page, { date: '2026-10-16', hour: 8 });
    await page.getByLabel('Дата разгрузки').fill('2026-10-17');
    await submit(page).click();
    // Способ (сброс выбора или ошибка) не описан; в обоих случаях требуется выбрать время заново.
    await expectRejected(page, 'hour');
  });

  test('AC-3 · смена склада после выбора слота: без повторного выбора бронь не создаётся', async ({ page }) => {
    await fillBooking(page, { warehouse: WAREHOUSE, hour: 8 });
    await page.locator('#warehouse').selectOption({ label: WAREHOUSE_2 });
    await submit(page).click();
    await expectRejected(page, 'hour');
  });

  // ---------- CL-15: окно бронирования ----------

  test('AC-4 · уже начавшийся слот сегодня забронировать нельзя', async ({ page }) => {
    await openAt(page, 'schedule', '2026-10-15T13:30:00');
    await showSlots(page, WAREHOUSE, '2026-10-15');
    const started = slot(page, 13);
    // Способ не описан: слот недоступен для выбора ИЛИ ошибка при отправке.
    if (await started.isDisabled()) {
      await expect(started).toBeDisabled();
      return;
    }
    await fillBooking(page, { date: '2026-10-15', hour: 13 });
    await submit(page).click();
    await expectRejected(page, 'hour');
  });

  // ---------- TC-007: госномер ----------

  for (const { value, title } of [
    { value: '', title: 'пустой' },
    { value: '   ', title: 'из одних пробелов' },
    { value: '12345', title: 'не по формату («12345»)' },
  ]) {
    test(`AC-6 · госномер ${title} — нельзя`, async ({ page }) => {
      await fillBooking(page, { plate: value });
      await submit(page).click();
      await expectRejected(page, 'plate');
    });
  }

  for (const plate of ['А123ВС 777', 'В456КМ 77']) {
    test(`AC-6 · валидный госномер «${plate}» — можно, сохраняется как введён`, async ({ page }) => {
      await fillBooking(page, { plate });
      await submit(page).click();
      await expect(successHeading(page)).toBeVisible();
      await expect(page.getByText(`Фура (тент, до 20 т) · ${plate}`)).toBeVisible();
    });
  }

  // ---------- TC-008 (часть), CL-24: паллеты ----------

  test('AC-7 · граница min − 1: 0 паллет — нельзя', async ({ page }) => {
    await fillBooking(page, { pallets: '0' });
    await submit(page).click();
    await expectRejected(page, 'pallets');
  });

  test('AC-7 · граница min: 1 паллета — можно', async ({ page }) => {
    await fillBooking(page, { pallets: '1' });
    await submit(page).click();
    await expect(successHeading(page)).toBeVisible();
    await expect(page.getByText(/^1 паллет/)).toBeVisible();
  });

  for (const value of ['', '1,5', '-3', 'abc', '1e1']) {
    test(`AC-7 · невалидное количество паллет «${value}» — нельзя`, async ({ page }) => {
      await fillBooking(page, { pallets: value });
      await submit(page).click();
      await expectRejected(page, 'pallets');
    });
  }

  // ---------- TC-009, CL-27: вес ----------

  test('AC-8 · дробный вес с запятой сохраняется без потерь: 12,4', async ({ page }) => {
    await fillBooking(page, { weight: '12,4' });
    await submit(page).click();
    await expect(successHeading(page)).toBeVisible();
    await expect(page.getByText(/паллет · /)).toHaveText(/ · 12[,.]4$/);
  });

  test('AC-8 · граница max: вес 20 — можно', async ({ page }) => {
    await fillBooking(page, { weight: '20' });
    await submit(page).click();
    await expect(successHeading(page)).toBeVisible();
  });

  test('AC-8 · граница max + 0,1: вес 20,1 — нельзя', async ({ page }) => {
    await fillBooking(page, { weight: '20,1' });
    await submit(page).click();
    await expectRejected(page, 'weight');
  });

  for (const value of ['0', '-1', 'abc', '20abc']) {
    test(`AC-8 · невалидный вес «${value}» — нельзя`, async ({ page }) => {
      await fillBooking(page, { weight: value });
      await submit(page).click();
      await expectRejected(page, 'weight');
    });
  }

  // ---------- TC-010: пустая форма ----------

  test('AC-10 · пустая форма: алерт, ошибки у обязательных полей, у комментария ошибки нет', async ({ page }) => {
    await submit(page).click();
    await expect(formAlert(page)).toContainText('Исправьте ошибки в форме');
    for (const field of ['hour', 'vehicleType', 'plate', 'pallets', 'weight']) {
      await expect(fieldError(page, field), `ошибка у поля ${field}`).toBeVisible();
    }
    await expect(fieldError(page, 'comment')).toHaveCount(0);
    await expect(successHeading(page)).toHaveCount(0);
  });

  // ---------- TC-011, TC-012: повторные действия и номер брони ----------

  test('AC-10 · двойной клик «Забронировать» создаёт одну бронь', async ({ page }) => {
    await fillBooking(page);
    await submit(page).dblclick();
    await expect(successHeading(page)).toBeVisible();

    await page.getByRole('link', { name: 'Мои брони' }).click();
    await expect(page.getByTestId('booking')).toHaveCount(1);
  });

  test('AC-10 · номер новой брони уникален после отмены другой брони', async ({ page }) => {
    // К форме возвращаемся через «Мои брони»: с экрана успеха пункт меню
    // «Бронирование» не открывает форму (хэш уже #/schedule).
    const toForm = async () => {
      await page.getByRole('link', { name: 'Мои брони' }).click();
      await page.getByRole('link', { name: 'Бронирование' }).click();
    };

    const n1 = await bookViaForm(page, { hour: 10 });
    await toForm();
    const n2 = await bookViaForm(page, { hour: 11 });
    expect(n2).not.toBe(n1);

    await page.getByRole('link', { name: 'Мои брони' }).click();
    await page.getByTestId('booking').filter({ hasText: n1 }).getByRole('button', { name: 'Отменить бронь' }).click();
    await expect(page.getByTestId('booking')).toHaveCount(1);

    await page.getByRole('link', { name: 'Бронирование' }).click();
    const n3 = await bookViaForm(page, { hour: 14 });
    expect(n3, `номер ${n3} уже был выдан`).not.toBe(n1);
    expect(n3, `номер ${n3} совпадает с действующей бронью`).not.toBe(n2);
  });
});

// Брони кладутся в хранилище ДО первого открытия страницы: повторный goto
// на тот же URL с другим хэшем не перезагружает страницу и seed не срабатывает.
test.describe('Бронирование слота: с существующими бронями @booking', () => {
  test('AC-3 · своя бронь показана в сетке как занятый слот', async ({ page }) => {
    await seedBookings(page, [booking({ date: '2026-10-16', hour: 10 })]);
    await openAt(page, 'schedule');
    await showSlots(page, WAREHOUSE, '2026-10-16');
    await expect(slot(page, 10)).toContainText('Занят');
    await expect(slot(page, 10)).toBeDisabled();
  });

  // TC-013 (часть): отмена освобождает слот
  test('AC-11 · после отмены брони её слот снова свободен', async ({ page }) => {
    await seedBookings(page, [booking({ date: '2026-10-15', hour: 13 })]);
    await openAt(page, 'my'); // 10:00, до слота 3 часа — отмена доступна
    await page.getByRole('button', { name: 'Отменить бронь' }).click();
    await expect(page.getByText('Бронь отменена')).toBeVisible();

    // Переход без перезагрузки: иначе seed вернул бы отменённую бронь.
    await page.getByRole('link', { name: 'Бронирование' }).click();
    await showSlots(page, WAREHOUSE, '2026-10-15');
    await expect(slot(page, 13)).toContainText('Свободно');
  });
});

// Правило не определено — автотест закрепил бы спорное поведение.
// Снять fixme после ответов аналитика (коды вопросов — из документа с тест-кейсами).
test.describe('Бронирование слота: ждём ответа аналитика @booking', () => {
  test.fixme('AC-4 · до слота 2:00 — можно, 1:59 — нельзя (В1: 2 ч или 1 ч; В4: граница)', async () => {});
  test.fixme('AC-7 · 33 паллеты — можно, 34 — нельзя (В2: 33 или 30)', async () => {});
  test.fixme('AC-2 · переход суток 23:59 → 00:00 по поясу склада (В4)', async () => {});
  test.fixme('AC-5 · в списке типов ТС ровно 3 значения (В7: «Контейнеровоз»)', async () => {});
  test.fixme('AC-6 · госномер латиницей и без пробела (В8: формат)', async () => {});
});
