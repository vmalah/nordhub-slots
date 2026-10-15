#!/usr/bin/env bash
# Подготовка окружения для автотестов.
# 1) Обычный путь: npm install + браузер.
# 2) Запасной путь для облачных сред без доступа к npm (например, сессия Claude Code):
#    используем предустановленный Playwright, если он есть в системе.
set -u

if npm install --no-audit --no-fund >/dev/null 2>&1; then
  npx playwright install chromium >/dev/null 2>&1 || true
  echo "OK: зависимости установлены из npm"
  exit 0
fi

for dir in /opt/npm-tools/node_modules "$(npm root -g 2>/dev/null)"; do
  if [ -d "$dir/playwright" ] && [ -d "$dir/playwright-core" ]; then
    mkdir -p node_modules/.bin
    ln -sfn "$dir/playwright" node_modules/playwright
    ln -sfn "$dir/playwright-core" node_modules/playwright-core
    ln -sfn ../playwright/cli.js node_modules/.bin/playwright
    echo "OK: npm недоступен, подключён предустановленный Playwright из $dir"
    exit 0
  fi
done

echo "Не удалось подготовить Playwright: нет доступа к npm и нет предустановленной версии" >&2
exit 1
