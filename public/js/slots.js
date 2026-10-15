import { BUSY } from './data.js';
import { pad } from './clock.js';

export const DAY_START = 8; // первый слот 08:00
export const LUNCH_HOUR = 12; // 12:00–13:00 — обед, слота нет
export const DAY_END = 17; // последний слот заканчивается в 17:00

export function slotLabel(hour) {
  return `${pad(hour)}:00–${pad(hour + 1)}:00`;
}

/**
 * Слоты склада на дату. Слот занят, если его занял другой перевозчик
 * или он уже есть в бронях пользователя.
 */
export function getSlots(warehouseId, date, ownBookings = []) {
  const busy = new Set([
    ...(BUSY[`${warehouseId}|${date}`] || []),
    ...ownBookings.filter((b) => b.warehouseId === warehouseId && b.date === date).map((b) => b.hour),
  ]);

  return Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i)
    .filter((h) => h !== LUNCH_HOUR)
    .map((h) => ({ hour: h, label: slotLabel(h), busy: busy.has(h) }));
}
