// Превращает results.json Playwright в короткую сводку для страницы запуска CI.
// Её же удобно отдать AI для разбора падений.
import { readFileSync, existsSync } from 'node:fs';

const file = 'test-results/results.json';
if (!existsSync(file)) {
  console.log('### Результаты тестов\n\nФайл с результатами не найден — тесты не запустились.');
  process.exit(0);
}

const report = JSON.parse(readFileSync(file, 'utf8'));
const rows = [];
let passed = 0;
let failed = 0;
let flaky = 0;

function walk(suite, path = []) {
  const title = suite.title ? [...path, suite.title] : path;
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      const status = t.status; // expected | unexpected | flaky | skipped
      if (status === 'expected') passed++;
      if (status === 'flaky') flaky++;
      if (status === 'unexpected') {
        failed++;
        const result = t.results.at(-1);
        const message = (result?.error?.message ?? '')
          .replace(/\u001b\[[0-9;]*m/g, '')
          .split('\n')
          .find((l) => l.trim()) ?? '';
        rows.push(`| ${[...title, spec.title].filter(Boolean).slice(1).join(' › ')} | ${spec.file}:${spec.line} | ${message.slice(0, 140).replace(/\|/g, '\\|')} |`);
      }
    }
  }
  for (const child of suite.suites ?? []) walk(child, title);
}
for (const s of report.suites ?? []) walk(s);

console.log('### Результаты тестов\n');
console.log(`✅ прошло: **${passed}** · ❌ упало: **${failed}** · ⚠️ нестабильных: **${flaky}**\n`);
if (rows.length) {
  console.log('| Тест | Где | Ошибка |\n| --- | --- | --- |');
  console.log(rows.join('\n'));
  console.log('\nПолный отчёт со скриншотами и трейсами — в артефакте `playwright-report`.');
}
