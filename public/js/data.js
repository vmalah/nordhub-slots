// Демо-данные: склады и занятые другими перевозчиками слоты.
// В реальном проекте это ответы API склада.

export const WAREHOUSES = [
  { id: 'pdl-2', name: 'NordHub · Склад Подольск-2' },
  { id: 'khm-1', name: 'NordHub · Склад Химки-1' },
];

// Ключ: `${warehouseId}|${YYYY-MM-DD}` → часы начала занятых слотов.
export const BUSY = {
  'pdl-2|2026-10-16': [9, 13],
  'pdl-2|2026-10-17': [8, 10, 14],
  'khm-1|2026-10-16': [11],
};

export function warehouseName(id) {
  return WAREHOUSES.find((w) => w.id === id)?.name ?? id;
}
