import { WAREHOUSES, warehouseName } from './data.js';
import { getSlots, slotLabel } from './slots.js';
import { getBookings, removeBooking } from './storage.js';
import { getNow, toISODate, formatDate, slotStart, hoursUntil } from './clock.js';
import { VEHICLE_TYPES, RULES, validateBooking } from './booking.js';
import { createBooking } from './api.js';

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

// ---------- Расписание и бронирование (SCRUM-5) ----------

let selectedHour = null;

function renderSchedule() {
  const today = toISODate(getNow());
  selectedHour = null;
  app.innerHTML = `
    <section class="page">
      <h1>Бронирование слота на разгрузку</h1>
      <p class="muted">Выберите склад, дату и свободное время. Подтверждение придёт на e-mail.</p>
      <form class="card" id="booking-form" novalidate>
        <div id="form-alert"></div>
        <div class="row">
          <label class="field" data-field="warehouseId">Склад
            <select id="warehouse" name="warehouseId">
              ${WAREHOUSES.map((w) => `<option value="${w.id}">${w.name}</option>`).join('')}
            </select>
          </label>
          <label class="field" data-field="date">Дата разгрузки
            <input id="date" name="date" type="date" value="${today}">
          </label>
        </div>
        <button type="button" id="show" class="btn" data-testid="show-slots">Найти слоты</button>
        <div id="slots" data-field="hour"></div>
        <div class="row">
          <label class="field" data-field="vehicleType">Тип ТС
            <select id="vehicleType" name="vehicleType">
              <option value="">Выберите тип</option>
              ${VEHICLE_TYPES.map((t) => `<option>${t}</option>`).join('')}
            </select>
          </label>
          <label class="field" data-field="plate">Госномер ТС
            <input id="plate" name="plate" placeholder="А123ВС 777">
          </label>
        </div>
        <div class="row">
          <label class="field" data-field="pallets">Количество паллет
            <input id="pallets" name="pallets" inputmode="numeric">
          </label>
          <label class="field" data-field="weight">Вес груза
            <input id="weight" name="weight" inputmode="decimal">
            <span class="hint">Не более ${RULES.maxWeight}</span>
          </label>
        </div>
        <label class="field" data-field="comment">Комментарий для склада
          <textarea id="comment" name="comment" rows="2" placeholder="Например: нужна гидроборт-разгрузка"></textarea>
          <span class="hint">Необязательно</span>
        </label>
        <div class="actions">
          <button type="reset" class="btn">Отмена</button>
          <button type="submit" class="btn primary" id="submit">Забронировать</button>
        </div>
      </form>
    </section>`;

  document.getElementById('show').addEventListener('click', showSlots);
  document.getElementById('booking-form').addEventListener('submit', submitBooking);
}

function showSlots() {
  const warehouseId = document.getElementById('warehouse').value;
  const date = document.getElementById('date').value;
  const slots = getSlots(warehouseId, date, getBookings());
  selectedHour = null;
  const box = document.getElementById('slots');
  box.innerHTML = `
    <p class="label">Время разгрузки</p>
    <ul class="slot-grid" aria-label="Слоты">
      ${slots
        .map(
          (s) => `
        <li><button type="button" class="slot ${s.busy ? 'busy' : 'free'}" data-testid="slot"
            data-hour="${s.hour}" ${s.busy ? 'disabled' : ''} aria-pressed="false">
          <span class="time">${s.label}</span>
          <span class="state">${s.busy ? 'Занят' : 'Свободно'}</span>
        </button></li>`,
        )
        .join('')}
    </ul>
    <p class="hint">Бронирование доступно не позднее чем за ${RULES.minHoursBeforeSlot} час до начала слота</p>`;

  box.querySelectorAll('button.slot:not(:disabled)').forEach((btn) => {
    btn.addEventListener('click', () => {
      box.querySelectorAll('button.slot').forEach((b) => {
        b.classList.remove('selected');
        b.setAttribute('aria-pressed', 'false');
        if (!b.disabled) b.querySelector('.state').textContent = 'Свободно';
      });
      btn.classList.add('selected');
      btn.setAttribute('aria-pressed', 'true');
      btn.querySelector('.state').textContent = 'Выбран';
      selectedHour = Number(btn.dataset.hour);
    });
  });
}

function readForm() {
  const f = document.getElementById('booking-form');
  return {
    warehouseId: f.warehouseId.value,
    date: f.date.value,
    hour: selectedHour,
    vehicleType: f.vehicleType.value,
    plate: f.plate.value,
    pallets: f.pallets.value,
    weight: f.weight.value,
    comment: f.comment.value,
  };
}

function showErrors(errors) {
  document.querySelectorAll('[data-field]').forEach((el) => {
    el.classList.remove('invalid');
    el.querySelector('.error')?.remove();
  });
  const alert = document.getElementById('form-alert');
  alert.innerHTML = '';
  if (Object.keys(errors).length === 0) return;

  alert.innerHTML = '<div class="alert" role="alert">Исправьте ошибки в форме, чтобы продолжить</div>';
  for (const [field, message] of Object.entries(errors)) {
    const el = document.querySelector(`[data-field="${field}"]`);
    if (!el) continue;
    el.classList.add('invalid');
    el.insertAdjacentHTML('beforeend', `<span class="error">${message}</span>`);
  }
}

async function submitBooking(event) {
  event.preventDefault();
  const form = readForm();
  const errors = validateBooking(form);
  showErrors(errors);
  if (Object.keys(errors).length > 0) return;

  const submitButton = document.getElementById('submit');
  if (submitButton.disabled) return; // защита от двойной отправки
  submitButton.disabled = true;
  const booking = await createBooking({
    ...form,
    plate: form.plate.trim().toUpperCase(),
    pallets: Number(form.pallets),
    weight: parseFloat(form.weight),
  });
  renderSuccess(booking);
}

function renderSuccess(b) {
  app.innerHTML = `
    <section class="page">
      <div class="card" style="align-items:center;text-align:center">
        <h1>Слот забронирован</h1>
        <p class="muted" style="margin:0">Номер брони: <span data-testid="booking-number">${b.number}</span></p>
        <dl class="details" style="align-self:stretch;margin:0">
          <div><dt>Склад</dt><dd>${warehouseName(b.warehouseId)}</dd></div>
          <div><dt>Дата и время</dt><dd>${formatDate(b.date)}, ${slotLabel(b.hour)}</dd></div>
          <div><dt>Транспорт</dt><dd>${b.vehicleType} · ${b.plate}</dd></div>
          <div><dt>Груз</dt><dd>${b.pallets} паллет · ${b.weight}</dd></div>
        </dl>
        <p class="hint">Отменить бронь можно не позднее чем за ${CANCEL_MIN_HOURS} часа до начала слота.</p>
        <div class="actions">
          <a class="btn primary" href="#/my">К моим броням</a>
        </div>
      </div>
    </section>`;
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
