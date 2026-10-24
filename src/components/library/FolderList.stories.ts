// src/components/library/FolderList.stories.ts
import type { Meta, StoryObj } from '@storybook/vue3'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import FolderList from './FolderList.vue'
import type { Folder, LibraryTrack } from '@/types/library'

const meta: Meta<typeof FolderList> = {
  title: 'Library/FolderList',
  component: FolderList,
  decorators: [
    () => ({
      setup() {
        const library = useLibraryStore()
        const player = usePlayerStore()

        // 1. Сбрасываем состояние
        library.clear()

        // 2. Создаём мок-папки
        const rootFolder: Folder = {
          id: 'folder:mock:root',
          name: 'Music',
          parentId: null,
          path: '',
          childFolderIds: ['folder:mock:sub1', 'folder:mock:sub2', 'folder:mock:sub3'],
          trackIds: [],
          totalTrackCount: 15,
          source: 'local',
          scanState: 'scanned',
        }

        const sub1: Folder = {
          id: 'folder:mock:sub1',
          name: 'Nostalgy',
          parentId: 'folder:mock:root',
          path: 'Nostalgy',
          childFolderIds: [],
          trackIds: ['track:mock:1', 'track:mock:2'],
          totalTrackCount: 2,
          source: 'local',
          scanState: 'scanned',
        }

        const sub2: Folder = {
          id: 'folder:mock:sub2',
          name: 'Scanning Folder',
          parentId: 'folder:mock:root',
          path: 'Scanning Folder',
          childFolderIds: [],
          trackIds: [],
          totalTrackCount: 0,
          source: 'local',
          scanState: 'scanning', // показывает спиннер
        }

        const sub3: Folder = {
          id: 'folder:mock:sub3',
          name: 'Empty Folder',
          parentId: 'folder:mock:root',
          path: 'Empty Folder',
          childFolderIds: [],
          trackIds: [],
          totalTrackCount: 0,
          source: 'local',
          scanState: 'scanned', // будет "пусто"
        }

        const mockTracks: LibraryTrack[] = [
          {
            id: 'track:mock:1',
            pluginId: 'local',
            folderId: 'folder:mock:sub1',
            title: 'Song 1',
            artist: 'Artist 1',
            album: 'Album 1',
            filename: '01.mp3',
            path: 'Nostalgy/01.mp3',
            source: 'https://example.com/1.mp3',
            fileLocation: 'remote-only',
            duration: 180,
          },
          {
            id: 'track:mock:2',
            pluginId: 'local',
            folderId: 'folder:mock:sub1',
            title: 'Song 2',
            artist: 'Artist 2',
            album: 'Album 1',
            filename: '02.mp3',
            path: 'Nostalgy/02.mp3',
            source: 'https://example.com/2.mp3',
            fileLocation: 'remote-only',
            duration: 200,
          },
        ]

        // 1. Заполняем папки
        library.folders = {
          [rootFolder.id]: rootFolder,
          [sub1.id]: sub1,
          [sub2.id]: sub2,
          [sub3.id]: sub3,
        }

        // 2. Заполняем треки (используем non-null assertion, так как массив жестко задан выше)
        const track0 = mockTracks[0]!
        const track1 = mockTracks[1]!

        library.tracks = {
          [track0.id]: track0,
          [track1.id]: track1,
        }

        // 3. Устанавливаем текущую папку
        library.setCurrentFolder(rootFolder.id)

        // 4. Мок плеера
        player.queue = [track0]
        player.currentIndex = 0
        player.currentTrack = track0
        player.isPlaying = true

        return {}
      },
      template: '<div class="max-w-md bg-bg text-fg"><story /></div>',
    }),
  ],
}

export default meta
type Story = StoryObj<typeof FolderList>

export const Default: Story = {
  render: () => ({
    components: { FolderList },
    template: `<FolderList />`,
  }),
}
