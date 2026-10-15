import { WAREHOUSES, warehouseName } from './data.js';
import { getSlots, slotLabel } from './slots.js';
import { getBookings, removeBooking } from './storage.js';
import { getNow, toISODate, formatDate, slotStart, hoursUntil } from './clock.js';

const CANCEL_MIN_HOURS = 3; // AC-11: отмена не позднее чем за 3 часа

const app = document.getElementById('app');

function render() {
  const route = location.hash.replace('#/', '') || 'schedule';
  document.querySelectorAll('[data-nav]').forEach((a) => {
    a.classList.toggle('active', a.dataset.nav === route);
  });
  if (route === 'my') renderMyBookings();
  else renderSchedule();
}

function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.hidden = true), 2500);
}

// ---------- Расписание ----------

function renderSchedule() {
  const today = toISODate(getNow());
  app.innerHTML = `
    <section class="page">
      <h1>Расписание разгрузки</h1>
      <p class="muted">Выберите склад и дату, чтобы увидеть свободные слоты.</p>
      <div class="card">
        <div class="row">
          <label class="field">Склад
            <select id="warehouse">
              ${WAREHOUSES.map((w) => `<option value="${w.id}">${w.name}</option>`).join('')}
            </select>
          </label>
          <label class="field">Дата разгрузки
            <input id="date" type="date" value="${today}">
          </label>
        </div>
        <button id="show" class="btn primary" data-testid="show-slots">Показать слоты</button>
        <div id="slots"></div>
      </div>
    </section>`;

  document.getElementById('show').addEventListener('click', () => {
    const warehouseId = document.getElementById('warehouse').value;
    const date = document.getElementById('date').value;
    const slots = getSlots(warehouseId, date);
    document.getElementById('slots').innerHTML = `
      <p class="label">Время разгрузки</p>
      <ul class="slot-grid" aria-label="Слоты">
        ${slots
          .map(
            (s) => `
          <li class="slot ${s.busy ? 'busy' : 'free'}" data-testid="slot" data-hour="${s.hour}">
            <span class="time">${s.label}</span>
            <span class="state">${s.busy ? 'Занят' : 'Свободно'}</span>
          </li>`,
          )
          .join('')}
      </ul>`;
  });
}

// ---------- Мои брони ----------

function renderMyBookings() {
  const bookings = getBookings().sort(
    (a, b) => slotStart(a.date, a.hour) - slotStart(b.date, b.hour),
  );

  if (bookings.length === 0) {
    app.innerHTML = `
      <section class="page">
        <h1>Мои брони</h1>
        <p class="empty">У вас пока нет броней</p>
      </section>`;
    return;
  }

  app.innerHTML = `
    <section class="page">
      <h1>Мои брони</h1>
      <p class="muted">Отменить бронь можно не позднее чем за ${CANCEL_MIN_HOURS} часа до начала слота.</p>
      <ul class="booking-list">
        ${bookings.map(bookingCard).join('')}
      </ul>
    </section>`;

  app.querySelectorAll('[data-cancel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      removeBooking(btn.dataset.cancel);
      toast('Бронь отменена');
      renderMyBookings();
    });
  });
}

function bookingCard(b) {
  const canCancel = hoursUntil(slotStart(b.date, b.hour)) >= CANCEL_MIN_HOURS;
  return `
    <li class="booking" data-testid="booking">
      <div>
        <div class="number">${b.number}</div>
        <div class="meta">${warehouseName(b.warehouseId)} · ${formatDate(b.date)}, ${slotLabel(b.hour)}</div>
        <div class="meta">${b.vehicleType} · ${b.plate}</div>
      </div>
      <div class="side">
        <button class="btn" data-cancel="${b.id}" ${canCancel ? '' : 'disabled'}>Отменить бронь</button>
        ${canCancel ? '' : '<span class="hint">До начала слота меньше 3 часов — отмена недоступна</span>'}
      </div>
    </li>`;
}

window.addEventListener('hashchange', render);
render();
