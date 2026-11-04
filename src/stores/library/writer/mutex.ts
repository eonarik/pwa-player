// src/stores/library/writer/mutex.ts

let chain: Promise<unknown> = Promise.resolve();

/**
 * Сериализует все write-операции LibraryWriter.
 *
 * Все мутаторы (setLibrary, addTracks, updateTrackSources, removeTrack,
 * setFolderScanState и т.д.) выполняются строго по очереди. Это гарантирует,
 * что async setLibrary не будет перезаписан синхронным updateTrackSources
 * в середине своего выполнения.
 *
 * Чтение (getTrack, getAlbum, ...) — без мьютекса (синхронное, Vue reactivity).
 */
export function withWriteLock<T>(fn: () => Promise<T> | T): Promise<T> {
  const run = chain.then(
    () => fn(),
    () => fn(),
  );
  chain = run.catch(() => undefined);
  return run;
}
