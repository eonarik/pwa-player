// src/composables/useCollectionActions.ts

import { ref, watch, type Ref } from 'vue';
import { getCollectionActions } from '@/plugins/extensions';
import type { PluginCollectionAction, CollectionActionProgress } from '@/plugins/types';
import type { Track } from '@/types/track';
import { logger } from '@/utils/logger';

export interface UseCollectionActionsReturn {
  visibleCollectionActions: Ref<PluginCollectionAction[]>;
  actionProgress: Ref<Record<string, CollectionActionProgress | null>>;
  runAction: (action: PluginCollectionAction, tracks: Track[]) => Promise<void>;
  actionLabel: (action: PluginCollectionAction) => string;
  isActionBusy: (action: PluginCollectionAction) => boolean;
}

export function useCollectionActions(tracks: Ref<Track[]>): UseCollectionActionsReturn {
  const allCollectionActions = getCollectionActions();
  const visibleCollectionActions = ref<PluginCollectionAction[]>([]);
  const actionProgress = ref<Record<string, CollectionActionProgress | null>>({});
  let actionCheckId = 0;

  async function refreshVisibleActions(currentTracks: Track[]): Promise<void> {
    const id = ++actionCheckId;
    const result: PluginCollectionAction[] = [];

    for (const action of allCollectionActions) {
      try {
        const ok = await action.shouldShow(currentTracks);
        if (ok) result.push(action);
      } catch (err) {
        logger.warn(`[collectionActions] shouldShow failed for "${action.id}"`, err);
      }
    }

    if (id === actionCheckId) {
      visibleCollectionActions.value = result;
    }
  }

  watch(
    tracks,
    (t) => {
      void refreshVisibleActions(t);
    },
    { immediate: true },
  );

  async function runAction(action: PluginCollectionAction, currentTracks: Track[]): Promise<void> {
    if (actionProgress.value[action.id]) return;

    const ctx = {
      setProgress: (p: CollectionActionProgress | null) => {
        actionProgress.value = { ...actionProgress.value, [action.id]: p };
      },
    };

    try {
      await action.run(currentTracks, ctx);
    } catch (err) {
      logger.error(`[collectionActions] run failed for "${action.id}"`, err);
    } finally {
      actionProgress.value = { ...actionProgress.value, [action.id]: null };
    }
  }

  function actionLabel(action: PluginCollectionAction): string {
    const progress = actionProgress.value[action.id];
    if (progress) {
      const foundPart = typeof progress.found === 'number' ? ` · найдено ${progress.found}` : '';
      return `${action.label}: ${progress.done}/${progress.total}${foundPart}`;
    }
    return action.label;
  }

  function isActionBusy(action: PluginCollectionAction): boolean {
    return Boolean(actionProgress.value[action.id]);
  }

  return {
    visibleCollectionActions,
    actionProgress,
    runAction,
    actionLabel,
    isActionBusy,
  };
}
