// e2e/helpers/fs-mock.ts

import { Page } from '@playwright/test';

export async function mockFileSystem(page: Page, fixtures: Record<string, string | Uint8Array>) {
  const safeFixtures: Record<string, string | number[]> = {};
  for (const [path, content] of Object.entries(fixtures)) {
    if (typeof content === 'string') {
      safeFixtures[path] = content;
    } else {
      safeFixtures[path] = Array.from(content);
    }
  }

  await page.addInitScript(async (fixturesData) => {
    const setupOPFS = async () => {
      const root = await (navigator.storage as any).getDirectory();

      // Очищаем
      for await (const [name] of (root as any).entries()) {
        await (root as any).removeEntry(name, { recursive: true });
      }

      // Создаем файлы
      for (const [path, content] of Object.entries(fixturesData)) {
        const parts = path.split('/');
        const fileName = parts.pop()!;
        let dir = root;
        for (const part of parts) {
          dir = await dir.getDirectoryHandle(part, { create: true });
        }
        const fileHandle = await dir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        const data =
          typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content as number[]);
        await writable.write(data);
        await writable.close();
      }
      return root;
    };

    (window as any).__initOPFS = setupOPFS;
    (window as any).showDirectoryPicker = async () => {
      return await setupOPFS();
    };
  }, safeFixtures);
}

export async function initOPFS(page: Page) {
  await page.evaluate(async () => {
    if ((window as any).__initOPFS) {
      await (window as any).__initOPFS();
    }
  });
}

/**
 * Создаёт OPFS-структуру, имитирующую папку скачивания (downloadDir),
 * и мокает showDirectoryPicker так, чтобы при запросе папки скачивания
 * возвращался этот корень.
 */
export async function mockDownloadDir(page: Page, fixtures: Record<string, string | Uint8Array>) {
  const safeFixtures: Record<string, string | number[]> = {};
  for (const [path, content] of Object.entries(fixtures)) {
    if (typeof content === 'string') {
      safeFixtures[path] = content;
    } else {
      safeFixtures[path] = Array.from(content);
    }
  }

  await page.addInitScript(async (fixturesData) => {
    const setupDownloads = async () => {
      const root = await (navigator.storage as any).getDirectory();

      // Удаляем старую папку Downloads, если есть
      try {
        await root.removeEntry('Downloads', { recursive: true });
      } catch {}

      const downloadsDir = await root.getDirectoryHandle('Downloads', { create: true });

      for (const [path, content] of Object.entries(fixturesData)) {
        const parts = path.split('/');
        const fileName = parts.pop()!;
        let dir = downloadsDir;
        for (const part of parts) {
          dir = await dir.getDirectoryHandle(part, { create: true });
        }
        const fileHandle = await dir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        const data =
          typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content as number[]);
        await writable.write(data);
        await writable.close();
      }
      return downloadsDir;
    };

    (window as any).__initDownloads = setupDownloads;

    // Перехватываем showDirectoryPicker. Если вызывается из DownloadSpaceService,
    // нам нужно вернуть папку Downloads.
    (window as any).showDirectoryPicker = async () => {
      return await setupDownloads();
    };
  }, safeFixtures);
}

export async function initDownloads(page: Page) {
  await page.evaluate(async () => {
    if ((window as any).__initDownloads) {
      await (window as any).__initDownloads();
    }
  });
}
