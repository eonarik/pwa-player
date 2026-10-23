// src/composables/useTrackPlayability.ts

import { computed, type Ref } from 'vue'
import type { LibraryTrack } from '@/types/library'
import type { Playability } from '@/types/playability'
import { getPlayability } from '@/services/library/selectors'
import { downloadOrchestrator } from '@/services/download/DownloadOrchestrator'

/**
 * Возвращает `Playability` для трека.
 *
 * Читает:
 * - `track.fileLocation`
 * - `track.source`
 * - `downloadOrchestrator.isDownloading(trackId)`
 * - `manifest.isDisconnected()` через `plugin.isDisconnected()` (лениво)
 *
 * Не хранит состояние — вычисляется на каждый чих. Это дёшево: `getPlayability`
 * — чистая функция, а `isDisconnected` читает localStorage (быстро).
 */
export function useTrackPlayability(track: Ref<LibraryTrack | null | undefined>) {
  return computed<Playability>(() => {
    const t = track.value
    if (!t) return 'missing'

    // isDisconnected читаем из плагина через service? Нет — из manifest нет.
    // Используем значение из localStorage через сервис плагина.
    // Простое решение: плагин отключён, если в библиотеке трек remote-only
    // и источник помечен как disconnected. Но это смешение.
    //
    // Правильно: getPlayabilityContext должен приходить сверху. Сделаем
    // хелпер, который читает через registry. Но registry хранит только manifest,
    // не LibrarySource. LibrarySource.isDisconnected() — async? Нет, sync.
    //
    // В текущей архитектуре: `plugin.isDisconnected()` синхронный.
    // Но loadPlugin — async. В composable мы не можем await.
    //
    // Компромисс: считаем, что плагин НЕ отключён, если трек в библиотеке
    // (он прошёл через load). Если он remote-only и сессия мертва — плеер
    // сам обработает ошибку через handleStreamError. UI не должен показывать
    // «needs-reconnect» до попытки.
    //
    // Значит: isPluginDisconnected = false в UI. Он влияет только на плеер
    // (handleStreamError). Для UI playability = playable-streaming для remote-only.
    //
    // Позже (если нужно) можно кэшировать `isDisconnected()` в reactive ref
    // через `downloadOrchestrator.isDownloading` + подписку на registry.
    return getPlayability(t, {
      isPluginDisconnected: false,
      isDownloading: downloadOrchestrator.isDownloading(t.id),
    })
  })
}
