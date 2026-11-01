// src/services/files/setupHandlers.ts

import { registerFileHandler, type FileHandlerContext } from './FileHandlerRegistry';
import { modalService } from '@/services/ui/ModalService';
import { toastService } from '@/services/ui/ToastService';
import TextEditorModal from '@/components/library/TextEditorModal.vue';
import ImagePreviewModal from '@/components/library/ImagePreviewModal.vue';
import type { FolderFile } from '@/types';

export function setupFileHandlers(): void {
  // TXT
  registerFileHandler('.txt', (file, ctx) => {
    void modalService.show({
      title: file.name,
      type: 'custom',
      component: TextEditorModal,
      props: {
        file: { name: file.name, remotePath: file.urlPath, path: file.name },
        pluginId: ctx.pluginId,
      },
      disableBackdropClose: true,
    });
  });

  // Картинки
  const imageHandler = (file: FolderFile, ctx: FileHandlerContext) => {
    void modalService.show({
      title: file.name,
      type: 'custom',
      component: ImagePreviewModal,
      props: {
        file: { name: file.name, remotePath: file.urlPath, path: file.name },
        pluginId: ctx.pluginId,
      },
      disableBackdropClose: false,
    });
  };

  registerFileHandler('.jpg', imageHandler);
  registerFileHandler('.jpeg', imageHandler);
  registerFileHandler('.png', imageHandler);
  registerFileHandler('.webp', imageHandler);
  registerFileHandler('.gif', imageHandler);

  // Заглушки
  registerFileHandler('.pdf', () => {
    toastService.info('Просмотр PDF скоро появится');
  });
  registerFileHandler('.epub', () => {
    toastService.info('Чтение EPUB скоро появится');
  });
}
