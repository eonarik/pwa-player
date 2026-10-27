<!-- src/views/DislikesView.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDislikesStore } from '@/stores/dislikes'
import { pluralize } from '@/utils/pluralize'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import PageHeader from '@/components/ui/PageHeader.vue'
import Button from '@/components/ui/Button.vue'
import ShowSourceCheckbox from '@/components/ui/ShowSourceCheckbox.vue'
import TrackListPage from '@/components/library/TrackListPage.vue'

const dislikes = useDislikesStore()
const { sortedEntries } = storeToRefs(dislikes)

const isEmpty = computed(() => sortedEntries.value.length === 0)

function clearDislikes() {
  const confirmed = window.confirm('Очистить список дизлайков?')
  if (!confirmed) return
  dislikes.clear()
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <PageHeader title="Дизлайки" :subtitle="pluralize(sortedEntries.length, ['трек', 'трека', 'треков'])">
      <ShowSourceCheckbox />
      <Button v-if="!isEmpty" variant="danger" size="sm" @click="clearDislikes">Очистить</Button>
    </PageHeader>

    <TrackListPage title="" :tracks="sortedEntries" :is-snapshot="true" :show-search="true" :show-filter="true"
      :show-play-all="true" :show-batch-add="true">

      <template #track-meta="{ track }">
        <span v-if="sortedEntries.find(s => s.id === track.id)" class="mr-2 text-[10px] tabular-nums text-fg-subtle">
          {{formatRelativeTime(sortedEntries.find(s => s.id === track.id)!.dislikedAt)}}
        </span>
      </template>
    </TrackListPage>
  </div>
</template>
