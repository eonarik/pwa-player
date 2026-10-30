// e2e/helpers/test-utils.ts

import { Page, expect } from '@playwright/test';

/**
 * Логирует ошибки из консоли браузера и неотловленные исключения.
 */
export function setupPageLogs(page: Page) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error(`[BROWSER ERROR] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    console.error(`[PAGE ERROR] ${err.message}`);
  });
  page.on('requestfailed', (req) => {
    console.warn(`[REQUEST FAILED] ${req.url()} - ${req.failure()?.errorText}`);
  });
}

/**
 * Ждёт, пока загрузится приложение (исчезнет AppLoader).
 */
export async function waitForAppBootstrap(page: Page) {
  // Ждем, пока исчезнет лоадер
  await expect(page.locator('.app-boot-loader')).toBeHidden({ timeout: 15000 });
}

/**
 * Читает IndexedDB store 'keyval-store' и возвращает значение по ключу.
 */
export async function getIDBValue<T>(page: Page, key: string): Promise<T | null> {
  return await page.evaluate(async (k) => {
    return new Promise((resolve) => {
      const req = indexedDB.open('keyval-store');
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('keyval')) {
          resolve(null);
          return;
        }
        const tx = db.transaction('keyval', 'readonly');
        const store = tx.objectStore('keyval');
        const getReq = store.get(k);
        getReq.onsuccess = () => resolve(getReq.result ?? null);
        getReq.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  }, key);
}
