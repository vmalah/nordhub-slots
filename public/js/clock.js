// Время приложения. Для тестов текущее время можно зафиксировать
// параметром ?now=2026-10-15T10:00:00 — это делает проверки
// с окнами бронирования и отмены детерминированными.

export function getNow() {
  const fixed = new URLSearchParams(location.search).get('now');
  return fixed ? new Date(fixed) : new Date();
}

export function pad(n) {
  return String(n).padStart(2, '0');
}

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function slotStart(date, hour) {
  return new Date(`${date}T${pad(hour)}:00:00`);
}

export function hoursUntil(target, now = getNow()) {
  return (target - now) / 36e5;
}
