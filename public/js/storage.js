// Брони пользователя. В демо хранятся в localStorage браузера.

const KEY = 'nordhub.bookings';

export function getBookings() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

export function saveBookings(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function removeBooking(id) {
  saveBookings(getBookings().filter((b) => b.id !== id));
}
