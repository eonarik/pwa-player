// src/services/audio/audioService/resources.ts

/**
 * Владелец текущего objectURL/File.
 * Отвечает за освобождение ресурсов (revokeObjectURL, сброс ссылки на File).
 */
export class ResourceHolder {
  private currentObjectUrl: string | null = null;
  private currentFile: File | null = null;

  setObjectUrl(url: string, file: File | null = null): void {
    this.currentObjectUrl = url;
    this.currentFile = file;
  }

  setFile(file: File | null): void {
    this.currentFile = file;
  }

  clearObjectUrl(): void {
    this.currentObjectUrl = null;
  }

  releaseInternal(): void {
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
    this.currentFile = null;
  }

  get hasObjectUrl(): boolean {
    return this.currentObjectUrl !== null;
  }
}
