// SCRUM-5: правила бронирования слота на разгрузку.
import { getNow, slotStart, hoursUntil } from './clock.js';

export const VEHICLE_TYPES = [
  'Фура (тент, до 20 т)',
  'Рефрижератор',
  'Малотоннажное (до 3,5 т)',
];

export const RULES = {
  maxDaysAhead: 14,
  minHoursBeforeSlot: 2,
  minPallets: 1,
  maxPallets: 33,
  maxWeight: 20,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const PLATE_RE = /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2} \d{2,3}$/;

export function validateBooking(form, now = getNow()) {
  const errors = {};

  if (!form.warehouseId) errors.warehouseId = 'Выберите склад';

  // Дата: не в прошлом и не дальше чем на 14 дней вперёд
  if (!form.date) {
    errors.date = 'Укажите дату';
  } else {
    // Сравниваем календарные дни, а не миллисекунды от текущего момента
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const days = Math.round((new Date(`${form.date}T00:00:00`) - today) / DAY_MS);
    if (days < 0) errors.date = 'Дата не может быть в прошлом';
    else if (days > RULES.maxDaysAhead) errors.date = 'Бронирование доступно не более чем на 14 дней вперёд';
  }

  // Слот: выбран и до его начала осталось достаточно времени
  if (form.hour == null) {
    errors.hour = 'Выберите время разгрузки';
  } else if (form.date && hoursUntil(slotStart(form.date, form.hour), now) < RULES.minHoursBeforeSlot) {
    errors.hour = `Бронирование доступно не позднее чем за ${RULES.minHoursBeforeSlot} час до начала слота`;
  }

  if (!form.vehicleType) errors.vehicleType = 'Выберите тип ТС';

  const plate = (form.plate || '').trim().toUpperCase();
  if (!plate) errors.plate = 'Укажите госномер';
  else if (!PLATE_RE.test(plate)) errors.plate = 'Неверный формат госномера';

  const pallets = Number(form.pallets);
  if (!Number.isInteger(pallets) || pallets < RULES.minPallets || pallets > RULES.maxPallets) {
    errors.pallets = `От ${RULES.minPallets} до ${RULES.maxPallets} паллет`;
  }

  const weight = Number(String(form.weight).replace(',', '.')); // «20,5» → 20.5
  if (!(weight > 0)) errors.weight = 'Укажите вес груза';
  else if (weight > RULES.maxWeight) errors.weight = 'Превышен допустимый вес';

  return errors;
}
