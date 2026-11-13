<!-- src/components/library/MetadataCandidatesModal.vue -->
<!--
  Модалка «Похожие треки»: показывает группы треков-дубликатов из библиотеки
  (связи через Track.duplicateTrackIds). Каждая группа раскрыта как строка,
  внутри — трек-кандидаты в выпадашке. Кнопка «Сделать основным» для выбора.
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { metadataService } from '@/services/metadata/MetadataService';
import { getPluginName } from '@/plugins/lookup';
import ModalLayout from '@/components/molecules/ModalLayout.vue';
import Button from '@/components/atoms/Button.vue';
import CoverImage from '@/components/ui/CoverImage.vue';
import DropdownMenu from '@/components/molecules/DropdownMenu.vue';
import Icon from '@/components/atoms/Icon.vue';
import type { Track } from '@/types/track';
import type { TrackId } from '@/types/ids';

const props = defineProps<{
  trackIds: TrackId[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const library = useLibraryStore();

/**
 * Группы дубликатов, найденные BFS по duplicateTrackIds среди входного
 * множества. Каждая группа — связный компонент графа (A-B-C = одна группа).
 * Входной массив trackIds может содержать не все связи, поэтому BFS идёт
 * по всей библиотеке: если трек A связан с B, а B не в props.trackIds,
 * всё равно найдём группу A-B.
 */
const groups = computed<Track[][]>(() => {
  const visited = new Set<TrackId>();
  const result: Track[][] = [];

  for (const id of props.trackIds) {
    if (visited.has(id)) continue;

    const track = library.getTrack(id);
    if (!track) continue;

    // BFS: обходим связный компонент дубликатов по всей библиотеке
    const queue: Track[] = [track];
    const component: Track[] = [];
    visited.add(id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);

      for (const dupId of current.duplicateTrackIds) {
        if (visited.has(dupId)) continue;
        const dup = library.getTrack(dupId);
        if (!dup) continue;
        visited.add(dupId);
        queue.push(dup);
      }
    }

    if (component.length >= 2) {
      result.push(component);
    }
  }

  return result;
});

/** Выбор основного трека в группе: groupId → primaryId. */
const primaryByGroup = ref<Map<number, TrackId>>(new Map());

/** Исключённые кандидаты (не склеивать): groupId → Set<trackId>. */
const excludedByGroup = ref<Map<number, Set<TrackId>>>(new Map());

function resetSelections() {
  const next = new Map<number, TrackId>();
  const excluded = new Map<number, Set<TrackId>>();
  groups.value.forEach((group, idx) => {
    const id = metadataService.pickPrimaryTrackId(group.map((t) => t.id));
    if (id) next.set(idx, id);
    excluded.set(idx, new Set());
  });
  primaryByGroup.value = next;
  excludedByGroup.value = excluded;
}

watch(groups, resetSelections, { immediate: true });

function getAlbumName(track: Track): string {
  if (!track.albumId) return 'Без альбома';
  const album = library.getAlbum(track.albumId);
  return album?.name ?? 'Без альбома';
}

/** Трек, выбранный основным в группе (для строки-триггера). */
function primaryTrackOf(group: Track[], groupIdx: number): Track {
  const id = primaryByGroup.value.get(groupIdx);
  return group.find((t) => t.id === id) ?? group[0]!;
}

/** Кандидаты в выпадашке: все, кроме текущего основного и исключённых. */
function candidatesOf(group: Track[], groupIdx: number): Track[] {
  const primaryId = primaryByGroup.value.get(groupIdx) ?? group[0]?.id;
  const excluded = excludedByGroup.value.get(groupIdx);
  return group.filter((t) => t.id !== primaryId && !excluded?.has(t.id));
}

/** Треки, которые пользователь решил не склеивать (отобразить отдельно). */
function excludedTracksOf(group: Track[], groupIdx: number): Track[] {
  const excluded = excludedByGroup.value.get(groupIdx);
  if (!excluded || excluded.size === 0) return [];
  return group.filter((t) => excluded.has(t.id));
}

/** Отображаемое имя источника трека. */
function getSourceLabel(track: Track | undefined): string {
  if (!track?.sources[0]) return '';
  return getPluginName(track.sources[0].pluginId, track.sources[0].pluginId);
}

function setPrimary(groupIdx: number, trackId: TrackId) {
  primaryByGroup.value.set(groupIdx, trackId);
}

function excludeCandidate(groupIdx: number, trackId: TrackId) {
  let set = excludedByGroup.value.get(groupIdx);
  if (!set) {
    set = new Set();
    excludedByGroup.value.set(groupIdx, set);
  }
  set.add(trackId);
  // Пересоздаём Map для реактивности Vue
  excludedByGroup.value = new Map(excludedByGroup.value);
}

function restoreCandidate(groupIdx: number, trackId: TrackId) {
  const set = excludedByGroup.value.get(groupIdx);
  if (!set) return;
  set.delete(trackId);
  excludedByGroup.value = new Map(excludedByGroup.value);
}

function applyAll() {
  groups.value.forEach((group, idx) => {
    const primaryId = primaryByGroup.value.get(idx);
    if (!primaryId) return;
    const excluded = excludedByGroup.value.get(idx);
    const duplicateIds = group.filter((t) => t.id !== primaryId && !excluded?.has(t.id)).map((t) => t.id);
    if (duplicateIds.length === 0) return;
    metadataService.applyDuplicates(primaryId, duplicateIds);
  });
  emit('close');
}
</script>

<template>
  <ModalLayout title="Похожие треки" max-width="lg" @close="emit('close')">
    <div v-if="groups.length === 0" class="py-8 text-center text-sm text-fg-muted">Похожие треки не найдены</div>

    <div v-else class="flex flex-col gap-4">
      <p class="text-xs text-fg-muted">
        Найдены дубликаты: {{ groups.length }}
        {{ groups.length === 1 ? 'группа' : groups.length < 5 ? 'группы' : 'групп' }}. Выберите основной трек в каждой
        группе — остальные будут склеены в него.
      </p>

      <!-- Выпадашка с кандидатами -->
      <template v-for="(group, groupIdx) in groups" :key="group[0]?.id">
        <DropdownMenu fullWidth align="right">
          <template #trigger="{ toggle, setTriggerRef }">
            <div
              :ref="setTriggerRef"
              class="flex flex-col gap-1 rounded-btn border border-hover-bg bg-card-bg p-2"
              :data-testid="`dup-group-${groupIdx}`"
            >
              <!-- Строка-триггер: текущий основной трек -->
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="h-8 w-8 shrink-0 overflow-hidden rounded-btn bg-bg">
                    <CoverImage
                      v-if="primaryTrackOf(group, groupIdx).albumId"
                      :album-id="primaryTrackOf(group, groupIdx).albumId"
                      :alt="primaryTrackOf(group, groupIdx).title"
                      fallback-icon-class="h-4 w-4"
                    />
                    <CoverImage
                      v-else
                      :src="primaryTrackOf(group, groupIdx).coverUrl"
                      :alt="primaryTrackOf(group, groupIdx).title"
                      fallback-icon-class="h-4 w-4"
                    />
                  </div>
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-fg">
                      {{ primaryTrackOf(group, groupIdx).artist }} — {{ primaryTrackOf(group, groupIdx).title }}
                    </p>
                    <p class="truncate text-xs text-fg-muted">
                      {{ getAlbumName(primaryTrackOf(group, groupIdx)) }}
                      <span class="text-fg-subtle mx-1">·</span>
                      {{ getSourceLabel(primaryTrackOf(group, groupIdx)) }}
                    </p>
                  </div>
                  <span
                    class="shrink-0 rounded bg-active/20 px-1.5 py-0.5 text-[10px] font-bold text-active"
                    data-testid="primary-badge"
                    >Основной</span
                  >
                </div>

                <button
                  type="button"
                  class="flex shrink-0 items-center gap-1 rounded-btn bg-bg-elevated px-2 py-1 text-xs text-fg-muted transition hover:bg-hover-bg hover:text-fg"
                  :data-testid="`dup-trigger-${groupIdx}`"
                  @click.stop="toggle"
                >
                  {{ group.length - 1 }} похожих
                  <Icon name="chevron-down" class="h-3 w-3" />
                </button>
              </div>
            </div>
          </template>

          <div class="flex flex-col gap-1 p-2">
            <div
              v-for="track in candidatesOf(group, groupIdx)"
              :key="track.id"
              class="group flex items-center gap-2 rounded-btn p-2 transition hover:bg-hover-bg"
              :data-testid="`dup-candidate-${track.id}`"
            >
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-2 text-left"
                @click="setPrimary(groupIdx, track.id)"
              >
                <div class="h-8 w-8 shrink-0 overflow-hidden rounded-btn bg-bg">
                  <CoverImage
                    v-if="track.albumId"
                    :album-id="track.albumId"
                    :alt="track.title"
                    fallback-icon-class="h-4 w-4"
                  />
                  <CoverImage v-else :src="track.coverUrl" :alt="track.title" fallback-icon-class="h-4 w-4" />
                </div>

                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm text-fg">{{ track.artist }} — {{ track.title }}</p>
                  <p class="truncate text-xs text-fg-muted">
                    {{ getAlbumName(track) }}
                    <span class="text-fg-subtle mx-1">·</span>
                    {{ getSourceLabel(track) }}
                  </p>
                </div>
              </button>

              <button
                type="button"
                class="shrink-0 rounded-btn border border-transparent px-2 py-1 text-[10px] text-fg-muted opacity-0 transition hover:border-active hover:text-active group-hover:opacity-100"
                :data-testid="`dup-exclude-${track.id}`"
                title="Не склеивать этот трек"
                @click.stop="excludeCandidate(groupIdx, track.id)"
              >
                Не склеивать
              </button>
            </div>
          </div>
        </DropdownMenu>

        <!-- Исключённые из склейки кандидаты этого трека -->
        <div v-if="excludedTracksOf(group, groupIdx).length" class="flex flex-col gap-1 pl-10">
          <div
            v-for="track in excludedTracksOf(group, groupIdx)"
            :key="track.id"
            class="flex items-center gap-2 rounded-btn bg-bg/60 p-2 opacity-70"
            :data-testid="`dup-excluded-row-${track.id}`"
          >
            <div class="h-6 w-6 shrink-0 overflow-hidden rounded-btn bg-bg">
              <CoverImage
                v-if="track.albumId"
                :album-id="track.albumId"
                :alt="track.title"
                fallback-icon-class="h-3 w-3"
              />
              <CoverImage v-else :src="track.coverUrl" :alt="track.title" fallback-icon-class="h-3 w-3" />
            </div>
            <p class="min-w-0 flex-1 truncate text-xs text-fg-muted line-through">
              {{ track.artist }} — {{ track.title }}
            </p>
            <button
              type="button"
              class="shrink-0 rounded-btn px-2 py-0.5 text-[10px] text-active transition hover:underline"
              :data-testid="`dup-restore-${track.id}`"
              @click="restoreCandidate(groupIdx, track.id)"
            >
              Вернуть
            </button>
          </div>
        </div>
      </template>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button variant="ghost" @click="emit('close')">Отмена</Button>
        <Button variant="primary" data-testid="apply-duplicates" :disabled="groups.length === 0" @click="applyAll">
          Применить ({{ groups.length }})
        </Button>
      </div>
    </template>
  </ModalLayout>
</template>
