// e2e/plugins/20-logii-changes.spec.ts

import { test, expect } from '@playwright/test';
import { mockLogii, bootstrapLogii, openLogiiSeason, type DiskItem } from '../helpers/logii-helpers';

const SEASON = 'logii.2024-11-08';

const TREE: Record<string, DiskItem[]> = {
  '': [{ type: 'dir', name: SEASON, path: `disk:/${SEASON}` }],
  [SEASON]: [{ type: 'dir', name: 'userA', path: `disk:/${SEASON}/userA` }],
  [`${SEASON}/userA`]: [
    { type: 'file', name: 'intro.logii.txt', path: `disk:/${SEASON}/userA/intro.logii.txt`, modified: '2024-11-08T20:10:00Z', size: 50 },
    { type: 'dir', name: '1', path: `disk:/${SEASON}/userA/1` },
  ],
  [`${SEASON}/userA/1`]: [
    { type: 'file', name: 'track1.mp3', path: `disk:/${SEASON}/userA/1/track1.mp3`, isAudio: true, modified: '2024-11-08T20:12:00Z', size: 1024 },
    { type: 'file', name: 'vibe.txt', path: `disk:/${SEASON}/userA/1/vibe.txt`, modified: '2024-11-08T20:15:00Z', size: 42 },
  ],
};

test.describe('Logii: колокольчик уведомлений', () => {
  test.beforeEach(async ({ page }) => {
    await mockLogii(page, { diskTree: TREE });
    await bootstrapLogii(page);
    await openLogiiSeason(page, '2024-11-08');
  });

  test('колокольчик виден и кликабелен', async ({ page }) => {
    await expect(page.getByTestId('logii-changes-toggle')).toBeVisible();

    // Панель с событиями показывается только если events.length > 0.
    // При пустом снимке (первый скан) событий нет — проверяем, что клик не ломает UI.
    await page.getByTestId('logii-changes-toggle').click();

    // Если панель появилась (события есть) — закрываем; иначе её просто нет.
    const panel = page.getByTestId('logii-changes-panel');
    if (await panel.isVisible().catch(() => false)) {
      await page.getByTestId('logii-changes-close').click();
      await expect(panel).toBeHidden();
    }
  });

  test('бейдж unread при событиях', async ({ page }) => {
    // Простая проверка UI: если events массив пуст, бейдж не виден.
    // Реальная генерация событий — в юнит-тестах diffSnapshots.
    await expect(page.getByTestId('logii-changes-badge')).not.toBeVisible();
  });

  test('уведомление об изменении файла', async ({ page }) => {
    // 1. Вход в автора → первый скан → снимок записан, событий нет
    await page.getByText('userA', { exact: true }).first().click();

    // Ждём завершения скана: папка 1 появится в колонке папок
    await expect(page.getByTestId('logii-folder-1')).toBeVisible({ timeout: 15000 });

    // Бейджа нет — это первый снимок
    await expect(page.getByTestId('logii-changes-badge')).not.toBeVisible();

    // 2. Мутируем modified у vibe.txt в моке
    const vibeFile = TREE['logii.2024-11-08/userA/1'].find((f) => f.name === 'vibe.txt')!;
    vibeFile.modified = '2024-11-08T21:00:00Z';

    // 3. Нажимаем refresh (кнопка ↻ в LogiiPanel) → force-скан с колбэками
    const refreshBtn = page.getByTestId('logii-refresh');
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();

    // 4. Ждём бейдж
    await expect(page.getByTestId('logii-changes-badge')).toBeVisible();

    // 5. Кликаем на колокольчик → панель с событием
    await page.getByTestId('logii-changes-toggle').click();
    await expect(page.getByTestId('logii-changes-panel')).toBeVisible();

    // 6. Проверяем событие
    const changeItem = page.getByTestId('logii-change-item-0');
    await expect(changeItem).toBeVisible();
    await expect(changeItem.getByText('vibe.txt')).toBeVisible();
  });

  test('уведомление об удалении файла', async ({ page }) => {
    // 1. Вход в автора → первый скан
    await page.getByText('userA', { exact: true }).first().click();

    // Ждём завершения скана
    await expect(page.getByTestId('logii-folder-1')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('logii-changes-badge')).not.toBeVisible();

    // 2. Удаляем vibe.txt из мока
    const vibeIdx = TREE['logii.2024-11-08/userA/1'].findIndex((f) => f.name === 'vibe.txt');
    expect(vibeIdx).toBeGreaterThan(-1);
    TREE['logii.2024-11-08/userA/1'].splice(vibeIdx, 1);

    // 3. Refresh → force-скан
    await page.getByTestId('logii-refresh').click();

    // 4. Бейдж показывает удаление
    await expect(page.getByTestId('logii-changes-badge')).toBeVisible();

    // 5. Проверяем событие
    await page.getByTestId('logii-changes-toggle').click();
    await expect(page.getByTestId('logii-changes-panel')).toBeVisible();
    await expect(page.getByTestId('logii-change-item-0')).toBeVisible();
  });
});
