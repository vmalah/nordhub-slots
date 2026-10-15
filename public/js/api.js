// Имитация API склада. Ответ приходит с задержкой, как от настоящего сервера.
import { getBookings, saveBookings } from './storage.js';

const LATENCY_MS = 600;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function nextNumber() {
  const n = 4817 + getBookings().length;
  return `NH-2026-${String(n).padStart(6, '0')}`;
}

export async function createBooking(data) {
  await delay(LATENCY_MS);
  const booking = { ...data, id: crypto.randomUUID(), number: nextNumber() };
  saveBookings([...getBookings(), booking]);
  return booking;
}
