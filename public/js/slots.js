import { BUSY } from './data.js';
import { pad } from './clock.js';

export const DAY_START = 8; // первый слот 08:00
export const DAY_END = 17; // последний слот заканчивается в 17:00
export const LUNCH_HOUR = 12; // 12:00–13:00 — обед, слота нет

export function slotLabel(hour) {
  return `${pad(hour)}:00–${pad(hour + 1)}:00`;
}

export function getSlots(warehouseId, date) {
  const busy = BUSY[`${warehouseId}|${date}`] || [];
  const slots = [];
  for (let h = DAY_START; h < DAY_END; h++) {
    if (h === LUNCH_HOUR) continue;
    slots.push({ hour: h, label: slotLabel(h), busy: busy.includes(h) });
  }
  return slots;
}
