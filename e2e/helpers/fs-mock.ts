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
    // Переопределяем showDirectoryPicker
    (window as any).showDirectoryPicker = async () => {
      // Возвращаем настоящий FileSystemDirectoryHandle из OPFS
      const root = await (navigator.storage as any).getDirectory();

      // Очищаем предыдущие файлы
      for await (const [name] of (root as any).entries()) {
        await (root as any).removeEntry(name, { recursive: true });
      }

      // Создаем файлы из фикстур
      for (const [path, content] of Object.entries(fixturesData)) {
        const parts = path.split('/');
        const fileName = parts.pop()!;
        let dir = root;

        for (const part of parts) {
          dir = await dir.getDirectoryHandle(part, { create: true });
        }

        const fileHandle = await dir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();

        const data = typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content);

        await writable.write(data);
        await writable.close();
      }

      return root;
    };
  }, safeFixtures);
}

export async function initOPFS(page: Page) {
  void page;
}
