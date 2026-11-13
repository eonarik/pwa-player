.
├── docs
│   ├── architecture.md
│   ├── conventions.md
│   ├── data-model.md
│   ├── plugins.md
│   ├── README.md
│   ├── server.md
│   ├── services.md
│   ├── stores.md
│   ├── storybook.md
│   └── STRUCTURE.md
├── e2e
│   ├── core
│   │   ├── 01-bootstrap.spec.ts
│   │   ├── 02-player-collections.spec.ts
│   │   ├── 03-offline-cache.spec.ts
│   │   ├── 05-metadata.spec.ts
│   │   ├── 06-multi-source-merge.spec.ts
│   │   ├── 07-local-disconnect.spec.ts
│   │   ├── 08-zvuk-source.spec.ts
│   │   ├── 09-cleanup-orphans.spec.ts
│   │   ├── 10-albums-crud.spec.ts
│   │   ├── 11-toasts.spec.ts
│   │   ├── 12-playlist-sharing.spec.ts
│   │   ├── 13-clipboard-watcher.spec.ts
│   │   ├── 14-metadata-same-title.spec.ts
│   │   └── 15-physical-tracks-merge.spec.ts
│   ├── fixtures
│   │   └── mp3_15s_sample_file_236KB.mp3
│   ├── helpers
│   │   ├── api-mock.ts
│   │   ├── fs-mock.ts
│   │   ├── logii-helpers.ts
│   │   └── test-utils.ts
│   ├── mocks
│   │   └── api
│   │       ├── auth.ts
│   │       ├── index.ts
│   │       ├── metadata.ts
│   │       ├── podcasts.ts
│   │       ├── radio.ts
│   │       ├── yandex-disk.ts
│   │       ├── yandex.ts
│   │       └── zvuk.ts
│   └── plugins
│       ├── 01-local-plugin.spec.ts
│       ├── 02-radio-plugin.spec.ts
│       ├── 03-podcasts-plugin.spec.ts
│       ├── 04-zvuk-plugin.spec.ts
│       ├── 05-yandex-folder-statuses.spec.ts
│       ├── 06-cancel-background-scan.spec.ts
│       ├── 07-yandex-progressive.spec.ts
│       ├── 08-deep-nesting-scan.spec.ts
│       ├── 09-sync-architecture.spec.ts
│       ├── 10-local-matches.spec.ts
│       ├── 11-metadata-album-cover.spec.ts
│       ├── 12-local-only-mode.spec.ts
│       ├── 14-force-scan-diff.spec.ts
│       ├── 15-logii-view.spec.ts
│       ├── 16-logii-read.spec.ts
│       ├── 17-logii-play-author.spec.ts
│       ├── 18-logii-refresh-back.spec.ts
│       ├── 19-logii-comments.spec.ts
│       ├── 20-logii-create-season.spec.ts
│       ├── 21-logii-authors.spec.ts
│       ├── 22-logii-tops.spec.ts
│       ├── 23-logii-upload-track.spec.ts
│       └── 24-logii-gallery.spec.ts
├── scripts
│   └── generate-docs-manifest.ts
├── server
│   ├── src
│   │   ├── core
│   │   │   ├── middleware
│   │   │   ├── providers
│   │   │   ├── index.js
│   │   │   ├── passport.js
│   │   │   ├── routes.js
│   │   │   └── session.js
│   │   ├── metadata
│   │   │   ├── jaroWinkler.js
│   │   │   ├── parseTitle.js
│   │   │   ├── routes.js
│   │   │   ├── similarity.js
│   │   │   └── similarity.spec.js
│   │   ├── plugins
│   │   │   ├── feedback
│   │   │   ├── hls-proxy
│   │   │   ├── podcasts
│   │   │   ├── telemetry
│   │   │   ├── yandex
│   │   │   ├── yandex-self
│   │   │   └── zvuk
│   │   ├── shared
│   │   │   ├── aliases.js
│   │   │   ├── audio.js
│   │   │   ├── errors.js
│   │   │   ├── logger.js
│   │   │   ├── paths.js
│   │   │   └── yandexApi.js
│   │   ├── index.mjs
│   │   └── modules.js
│   ├── ecosystem.config.js
│   ├── package.json
│   └── tsconfig.json
├── src
│   ├── assets
│   │   ├── fallback-barbie-cover.jpg
│   │   ├── fallback-default-cover.webp
│   │   ├── fallback-neon-cover.webp
│   │   ├── fallback-radio-cover.png
│   │   ├── fallback-tiffany-cover.jpg
│   │   ├── fluffy-clouds.jpg
│   │   ├── main.css
│   │   ├── sber-zvuk.png
│   │   ├── theme-barbie.css
│   │   ├── theme-neon.css
│   │   ├── theme-radio.css
│   │   ├── theme-tiffany.css
│   │   ├── tiffany-floral-corner.png
│   │   ├── tiffany-gold-foil.webp
│   │   ├── tiffany-marble-bg.avif
│   │   └── yandex-disk.png
│   ├── components
│   │   ├── atoms
│   │   │   ├── Badge.stories.ts
│   │   │   ├── Badge.vue
│   │   │   ├── Button.stories.ts
│   │   │   ├── Button.vue
│   │   │   ├── Checkbox.stories.ts
│   │   │   ├── Checkbox.vue
│   │   │   ├── Divider.stories.ts
│   │   │   ├── Divider.vue
│   │   │   ├── IconButton.stories.ts
│   │   │   ├── IconButton.vue
│   │   │   ├── IconGallery.stories.ts
│   │   │   ├── Icon.stories.ts
│   │   │   ├── Icon.vue
│   │   │   ├── Input.stories.ts
│   │   │   ├── Input.vue
│   │   │   ├── Label.stories.ts
│   │   │   ├── Label.vue
│   │   │   ├── LinkButton.stories.ts
│   │   │   ├── LinkButton.vue
│   │   │   ├── PlayingIndicator.stories.ts
│   │   │   ├── PlayingIndicator.vue
│   │   │   ├── Select.stories.ts
│   │   │   ├── Select.vue
│   │   │   ├── Spinner.stories.ts
│   │   │   ├── Spinner.vue
│   │   │   ├── Textarea.stories.ts
│   │   │   ├── Textarea.vue
│   │   │   ├── Toggle.stories.ts
│   │   │   └── Toggle.vue
│   │   ├── catalog
│   │   │   └── CatalogLayout.vue
│   │   ├── download
│   │   │   └── SpacePermissionModal.vue
│   │   ├── icons
│   │   │   ├── IconAlbum.vue
│   │   │   ├── IconAlertTriangle.vue
│   │   │   ├── IconArrowDown.vue
│   │   │   ├── IconArrowLeft.vue
│   │   │   ├── IconArrowUp.vue
│   │   │   ├── IconArtist.vue
│   │   │   ├── IconCheck.vue
│   │   │   ├── IconChevronDown.vue
│   │   │   ├── IconChevronLeft.vue
│   │   │   ├── IconChevronRight.vue
│   │   │   ├── IconCloudCheck.vue
│   │   │   ├── IconDots.vue
│   │   │   ├── IconDownload.vue
│   │   │   ├── IconEyeOff.vue
│   │   │   ├── IconFeedback.vue
│   │   │   ├── IconFile.vue
│   │   │   ├── IconFilter.vue
│   │   │   ├── IconFolder.vue
│   │   │   ├── IconGrid.vue
│   │   │   ├── IconHeart.vue
│   │   │   ├── IconHistory.vue
│   │   │   ├── IconHome.vue
│   │   │   ├── IconLink.vue
│   │   │   ├── IconListPlay.vue
│   │   │   ├── IconList.vue
│   │   │   ├── IconMaximize.vue
│   │   │   ├── IconMenu.vue
│   │   │   ├── IconMinimize.vue
│   │   │   ├── IconNext.vue
│   │   │   ├── IconPause.vue
│   │   │   ├── IconPencil.vue
│   │   │   ├── IconPlaylist.vue
│   │   │   ├── IconPlay.vue
│   │   │   ├── IconPlus.vue
│   │   │   ├── IconPrev.vue
│   │   │   ├── IconRadio.vue
│   │   │   ├── IconRefresh.vue
│   │   │   ├── IconRepeat.vue
│   │   │   ├── IconSearch.vue
│   │   │   ├── IconSettings.vue
│   │   │   ├── IconShare.vue
│   │   │   ├── IconShuffle.vue
│   │   │   ├── IconSpinner.vue
│   │   │   ├── IconThumbsDown.vue
│   │   │   ├── IconTrash.vue
│   │   │   ├── IconVolumeMute.vue
│   │   │   ├── IconVolume.vue
│   │   │   ├── IconWarning.vue
│   │   │   ├── IconX.vue
│   │   │   └── index.ts
│   │   ├── layout
│   │   │   ├── AppDrawer.vue
│   │   │   └── AppLoader.vue
│   │   ├── library
│   │   │   ├── metadata
│   │   │   ├── AlbumSelect.vue
│   │   │   ├── BatchAddToPlaylistButton.vue
│   │   │   ├── BatchDownloadButton.vue
│   │   │   ├── FileListItem.vue
│   │   │   ├── FileLocationFilter.vue
│   │   │   ├── FolderActionsMenu.vue
│   │   │   ├── FolderBreadcrumbs.vue
│   │   │   ├── FolderListItem.vue
│   │   │   ├── FolderList.vue
│   │   │   ├── FolderSettingsMenu.vue
│   │   │   ├── FolderSortMenu.vue
│   │   │   ├── FolderSyncMenu.vue
│   │   │   ├── ImagePreviewModal.vue
│   │   │   ├── MetadataCandidatesButton.vue
│   │   │   ├── MetadataCandidatesModal.vue
│   │   │   ├── MetadataMenu.vue
│   │   │   ├── PlaylistSubmenu.vue
│   │   │   ├── RemoteMetadataModal.vue
│   │   │   ├── SyncIssuesModal.vue
│   │   │   ├── TextEditorModal.vue
│   │   │   ├── TrackActions.vue
│   │   │   ├── TrackDownloadItem.vue
│   │   │   ├── TrackListHeader.vue
│   │   │   ├── TrackListItem.vue
│   │   │   ├── TrackListPage.vue
│   │   │   ├── TrackList.vue
│   │   │   ├── TrackMetadataMenu.vue
│   │   │   ├── TrackMetadataModal.vue
│   │   │   ├── TrackResolvedItem.vue
│   │   │   ├── TrackRow.vue
│   │   │   └── TrackSearchResults.vue
│   │   ├── molecules
│   │   │   ├── AlphabetIndex.stories.ts
│   │   │   ├── AlphabetIndex.vue
│   │   │   ├── AutocompleteInput.stories.ts
│   │   │   ├── AutocompleteInput.vue
│   │   │   ├── Avatar.stories.ts
│   │   │   ├── Avatar.vue
│   │   │   ├── CoverPicker.stories.ts
│   │   │   ├── CoverPicker.vue
│   │   │   ├── DropdownMenu.stories.ts
│   │   │   ├── DropdownMenu.vue
│   │   │   ├── EmptyState.stories.ts
│   │   │   ├── EmptyState.vue
│   │   │   ├── FormField.stories.ts
│   │   │   ├── FormField.vue
│   │   │   ├── InputWithAffix.stories.ts
│   │   │   ├── InputWithAffix.vue
│   │   │   ├── ListContainer.stories.ts
│   │   │   ├── ListContainer.vue
│   │   │   ├── ListRow.stories.ts
│   │   │   ├── ListRow.vue
│   │   │   ├── ModalLayout.stories.ts
│   │   │   ├── ModalLayout.vue
│   │   │   ├── PageHeader.stories.ts
│   │   │   ├── PageHeader.vue
│   │   │   ├── ProgressBar.stories.ts
│   │   │   ├── ProgressBar.vue
│   │   │   ├── SearchInput.stories.ts
│   │   │   ├── SearchInput.vue
│   │   │   ├── SectionTitle.stories.ts
│   │   │   ├── SectionTitle.vue
│   │   │   ├── Toolbar.stories.ts
│   │   │   ├── Toolbar.vue
│   │   │   ├── ViewToggle.stories.ts
│   │   │   └── ViewToggle.vue
│   │   ├── player
│   │   │   ├── FullPlayer.vue
│   │   │   ├── NowPlayingInfo.vue
│   │   │   ├── PlayerControls.vue
│   │   │   └── PlayerProgressBar.vue
│   │   ├── playlists
│   │   │   ├── ImportPlaylistModal.vue
│   │   │   └── PlaylistShareMenu.vue
│   │   ├── settings
│   │   │   ├── fields
│   │   │   └── PluginSettingsSection.vue
│   │   └── ui
│   │       ├── AddRemoveButton.vue
│   │       ├── CoverImage.stories.ts
│   │       ├── CoverImage.vue
│   │       ├── DislikeButton.vue
│   │       ├── FavoriteButton.vue
│   │       ├── FeedbackModal.vue
│   │       ├── MarkdownText.vue
│   │       ├── ModalHost.stories.ts
│   │       ├── ModalHost.vue
│   │       ├── SettingsActionRow.vue
│   │       ├── ShowSourceCheckbox.vue
│   │       ├── ToastHost.stories.ts
│   │       ├── ToastHost.vue
│   │       ├── TrackCover.stories.ts
│   │       ├── TrackCover.vue
│   │       ├── TrackReactionButtons.vue
│   │       ├── VirtualGrid.types.ts
│   │       └── VirtualGrid.vue
│   ├── composables
│   │   ├── useAlbumCover.ts
│   │   ├── useAppBootstrap.ts
│   │   ├── useAutoActions.spec.ts
│   │   ├── useAutoActions.ts
│   │   ├── useBatchDownload.ts
│   │   ├── useButtonAs.ts
│   │   ├── useClipboardWatcher.spec.ts
│   │   ├── useClipboardWatcher.ts
│   │   ├── useCollectionActions.spec.ts
│   │   ├── useCollectionActions.ts
│   │   ├── useCollectionView.ts
│   │   ├── useDocumentTitle.ts
│   │   ├── useDominantColor.ts
│   │   ├── useFolderSync.ts
│   │   ├── useItemHeight.ts
│   │   ├── useKeyboardShortcuts.ts
│   │   ├── useLibrarySearch.ts
│   │   ├── useMediaSession.ts
│   │   ├── useMenu.ts
│   │   ├── useMetadataSearch.spec.ts
│   │   ├── useMetadataSearch.ts
│   │   ├── usePluginActions.ts
│   │   ├── usePluginsList.ts
│   │   ├── usePwaUpdate.ts
│   │   ├── useSoftTtlCache.ts
│   │   ├── useTrackCapabilities.spec.ts
│   │   ├── useTrackCapabilities.ts
│   │   ├── useTrackDisplay.ts
│   │   ├── useTrackDownloadAction.spec.ts
│   │   ├── useTrackDownloadAction.ts
│   │   ├── useTrackEndOnVisibility.ts
│   │   ├── useTrackFilter.spec.ts
│   │   ├── useTrackFilter.ts
│   │   ├── useTrackMetadataActions.spec.ts
│   │   ├── useTrackMetadataActions.ts
│   │   ├── useTrackPlayability.ts
│   │   └── useVirtualList.ts
│   ├── directives
│   │   ├── tooltip.spec.ts
│   │   └── tooltip.ts
│   ├── navigation
│   │   ├── menu.ts
│   │   └── title.ts
│   ├── plugins
│   │   ├── demo
│   │   │   ├── DemoView.vue
│   │   │   ├── extension.ts
│   │   │   ├── index.ts
│   │   │   └── manifest.ts
│   │   ├── local
│   │   │   ├── FileSystemService.ts
│   │   │   ├── index.ts
│   │   │   ├── manifest.ts
│   │   │   ├── persistence.ts
│   │   │   ├── settings.ts
│   │   │   └── types.ts
│   │   ├── podcasts
│   │   │   ├── components
│   │   │   ├── composables
│   │   │   ├── AddPodcastModal.vue
│   │   │   ├── constants.ts
│   │   │   ├── episodeTrack.spec.ts
│   │   │   ├── episodeTrack.ts
│   │   │   ├── extension.ts
│   │   │   ├── index.ts
│   │   │   ├── manifest.ts
│   │   │   ├── parseOpml.ts
│   │   │   ├── PodcastCatalog.vue
│   │   │   ├── PodcastRoute.vue
│   │   │   ├── PodcastService.ts
│   │   │   ├── PodcastStorage.ts
│   │   │   ├── PodcastsView.vue
│   │   │   └── types.ts
│   │   ├── radio
│   │   │   ├── browser
│   │   │   ├── AddStationModal.vue
│   │   │   ├── constants.ts
│   │   │   ├── extension.ts
│   │   │   ├── index.ts
│   │   │   ├── manifest.ts
│   │   │   ├── RadioBrowserClient.ts
│   │   │   ├── RadioCatalog.vue
│   │   │   ├── RadioFilters.vue
│   │   │   ├── RadioSavedList.vue
│   │   │   ├── RadioService.ts
│   │   │   └── RadioView.vue
│   │   ├── yandexDisk
│   │   │   ├── backgroundScan.ts
│   │   │   ├── concurrency.ts
│   │   │   ├── constants.ts
│   │   │   ├── createPlugin.ts
│   │   │   ├── download.ts
│   │   │   ├── index.ts
│   │   │   ├── load.ts
│   │   │   ├── localMatches.ts
│   │   │   ├── localRestore.ts
│   │   │   ├── manifest.ts
│   │   │   ├── persistence.ts
│   │   │   ├── scanFolder.spec.ts
│   │   │   ├── scanFolder.ts
│   │   │   ├── ScanQueue.spec.ts
│   │   │   ├── ScanQueue.ts
│   │   │   ├── scan.ts
│   │   │   ├── storage.ts
│   │   │   ├── textFiles.ts
│   │   │   ├── types.ts
│   │   │   └── YandexDiskService.ts
│   │   ├── yandexSelf
│   │   │   ├── logii
│   │   │   ├── extension.ts
│   │   │   ├── index.ts
│   │   │   ├── manifest.ts
│   │   │   └── YandexSelfService.ts
│   │   ├── zvuk
│   │   │   ├── extension.ts
│   │   │   ├── index.ts
│   │   │   ├── manifest.ts
│   │   │   ├── restoreUnavailable.ts
│   │   │   ├── ZvukService.ts
│   │   │   └── ZvukView.vue
│   │   ├── contextDeps.spec.ts
│   │   ├── contextDeps.ts
│   │   ├── context.ts
│   │   ├── extensions.spec.ts
│   │   ├── extensions.ts
│   │   ├── lookup.spec.ts
│   │   ├── lookup.ts
│   │   ├── registry.spec.ts
│   │   ├── registry.ts
│   │   ├── settingsTypes.ts
│   │   ├── storage.ts
│   │   └── types.ts
│   ├── router
│   │   └── index.ts
│   ├── services
│   │   ├── api
│   │   │   ├── ApiClient.ts
│   │   │   └── errors.ts
│   │   ├── audio
│   │   │   ├── AudioService
│   │   │   ├── resolveTrackSource.ts
│   │   │   ├── toPlayableUrl.ts
│   │   │   └── types.ts
│   │   ├── auth
│   │   │   └── AuthService.ts
│   │   ├── backup
│   │   │   ├── BackupService.migration.spec.ts
│   │   │   ├── BackupService.spec.ts
│   │   │   ├── BackupService.ts
│   │   │   ├── collect.ts
│   │   │   ├── restore.ts
│   │   │   ├── schema.spec.ts
│   │   │   └── schema.ts
│   │   ├── collections
│   │   │   └── ensureTrackInLibrary.ts
│   │   ├── covers
│   │   │   ├── CoverBlobCache.ts
│   │   │   └── findCoverInDirectory.ts
│   │   ├── download
│   │   │   ├── active-downloads.spec.ts
│   │   │   ├── active-downloads.ts
│   │   │   ├── batch.spec.ts
│   │   │   ├── batch.ts
│   │   │   ├── DownloadOrchestrator.ts
│   │   │   ├── DownloadSpaceService.ts
│   │   │   ├── downloadUrlToFile.ts
│   │   │   ├── getFileFromPath.ts
│   │   │   ├── manage.spec.ts
│   │   │   ├── manage.ts
│   │   │   ├── PermissionService.ts
│   │   │   ├── scanDirectory.ts
│   │   │   ├── single-track.spec.ts
│   │   │   ├── single-track.ts
│   │   │   ├── SyncService.ts
│   │   │   └── types.ts
│   │   ├── events
│   │   │   ├── bus.spec.ts
│   │   │   └── bus.ts
│   │   ├── files
│   │   │   ├── FileHandlerRegistry.ts
│   │   │   └── setupHandlers.ts
│   │   ├── library
│   │   │   ├── TrackMerger
│   │   │   ├── EntityGraph.ts
│   │   │   ├── LibrarySaveService.ts
│   │   │   ├── LibraryWriter.race.spec.ts
│   │   │   ├── LibraryWriter.ts
│   │   │   ├── ReconciliationService.ts
│   │   │   ├── selectors.spec.ts
│   │   │   └── selectors.ts
│   │   ├── markdown
│   │   │   ├── index.ts
│   │   │   ├── simpleRenderer.ts
│   │   │   └── types.ts
│   │   ├── metadata
│   │   │   ├── MetadataService
│   │   │   ├── AutoFetchRegistry.ts
│   │   │   ├── MetadataService.applyCandidate.spec.ts
│   │   │   ├── MetadataService.applyRemote.spec.ts
│   │   │   ├── MetadataService.spec.ts
│   │   │   ├── MetadataWorkerService.ts
│   │   │   ├── runAutoFetch.ts
│   │   │   ├── TrackMetadataService.ts
│   │   │   └── types.ts
│   │   ├── persistence
│   │   │   ├── AlbumService.ts
│   │   │   ├── DislikesPersistenceService.ts
│   │   │   ├── HistoryPersistenceService.ts
│   │   │   ├── MetadataPersistenceService.ts
│   │   │   ├── PersistenceService.ts
│   │   │   ├── PlaylistPersistenceService.ts
│   │   │   ├── restore.ts
│   │   │   ├── SchemaService.ts
│   │   │   ├── schema.ts
│   │   │   └── types.ts
│   │   ├── playlists
│   │   │   ├── ImportService.spec.ts
│   │   │   ├── ImportService.ts
│   │   │   ├── PlaylistMatcher.spec.ts
│   │   │   ├── PlaylistMatcher.ts
│   │   │   └── PlaylistMatcher.unicode.spec.ts
│   │   ├── plugins
│   │   │   └── connectPlugin.ts
│   │   ├── pwa
│   │   │   └── PwaService.ts
│   │   ├── sort
│   │   │   └── SortService.ts
│   │   ├── telemetry
│   │   │   ├── autoFlush.ts
│   │   │   ├── counters.ts
│   │   │   ├── index.ts
│   │   │   ├── instrument.ts
│   │   │   ├── patches.ts
│   │   │   ├── sampler.ts
│   │   │   ├── TelemetryService.ts
│   │   │   └── types.ts
│   │   └── ui
│   │       ├── ModalService.ts
│   │       ├── ThemeService.spec.ts
│   │       ├── ThemeService.ts
│   │       ├── ToastService.spec.ts
│   │       └── ToastService.ts
│   ├── shared
│   │   ├── audioExtensions.spec.ts
│   │   ├── audioExtensions.ts
│   │   ├── paths.spec.ts
│   │   └── paths.ts
│   ├── stores
│   │   ├── library
│   │   │   ├── store
│   │   │   ├── writer
│   │   │   └── index.ts
│   │   ├── player
│   │   │   ├── actions
│   │   │   ├── events.ts
│   │   │   ├── index.ts
│   │   │   ├── playerHelpers.ts
│   │   │   ├── playerPersistence.ts
│   │   │   ├── playerRestore.ts
│   │   │   └── timeLoop.ts
│   │   ├── uiSettings
│   │   │   ├── index.ts
│   │   │   ├── schema.spec.ts
│   │   │   └── schema.ts
│   │   ├── collections.ts
│   │   ├── dislikes.ts
│   │   ├── history.spec.ts
│   │   ├── history.ts
│   │   ├── playlists.ts
│   │   └── uiSettings.metadataProviderOrder.spec.ts
│   ├── test
│   │   ├── audioMockState.ts
│   │   ├── mockAudio.ts
│   │   └── withSetup.ts
│   ├── types
│   │   ├── album.ts
│   │   ├── collection.ts
│   │   ├── filter.ts
│   │   ├── folder.ts
│   │   ├── ids.spec.ts
│   │   ├── ids.ts
│   │   ├── index.ts
│   │   ├── metadata.ts
│   │   ├── persistence.ts
│   │   ├── playability.ts
│   │   ├── plugin.ts
│   │   ├── track.ts
│   │   └── transfer.ts
│   ├── utils
│   │   ├── artists.ts
│   │   ├── deepToRaw.ts
│   │   ├── dominantColor.ts
│   │   ├── downloadFile.ts
│   │   ├── folderStatus.ts
│   │   ├── formatDuration.spec.ts
│   │   ├── formatDuration.ts
│   │   ├── formatRelativeTime.spec.ts
│   │   ├── formatRelativeTime.ts
│   │   ├── fuzzyMatch.spec.ts
│   │   ├── fuzzyMatch.ts
│   │   ├── hash.spec.ts
│   │   ├── hash.ts
│   │   ├── layout.spec.ts
│   │   ├── layout.ts
│   │   ├── logger.spec.ts
│   │   ├── logger.ts
│   │   ├── mergeText.spec.ts
│   │   ├── mergeText.ts
│   │   ├── parseFilename.spec.ts
│   │   ├── parseFilename.ts
│   │   ├── playlistBlueprint.spec.ts
│   │   ├── playlistBlueprint.ts
│   │   ├── playlistParser.spec.ts
│   │   ├── playlistParser.ts
│   │   ├── pluginDiagnostics.spec.ts
│   │   ├── pluginDiagnostics.ts
│   │   ├── pluralize.ts
│   │   ├── sort.ts
│   │   └── urlPath.ts
│   ├── views
│   │   ├── folder
│   │   │   ├── FolderContent.vue
│   │   │   ├── FolderFilters.vue
│   │   │   └── FolderHeader.vue
│   │   ├── home
│   │   │   └── PluginCard.vue
│   │   ├── playlist
│   │   │   └── PlaylistHeader.vue
│   │   ├── settings
│   │   │   ├── MetadataProvidersList.vue
│   │   │   ├── SettingsAbout.vue
│   │   │   ├── SettingsData.vue
│   │   │   ├── SettingsGeneral.vue
│   │   │   └── SettingsPlugins.vue
│   │   ├── AlbumsView.vue
│   │   ├── AlbumView.vue
│   │   ├── ArtistsView.vue
│   │   ├── ArtistView.vue
│   │   ├── DislikesView.vue
│   │   ├── FolderRoute.vue
│   │   ├── FolderView.vue
│   │   ├── HistoryView.vue
│   │   ├── HomeView.vue
│   │   ├── PlaylistRoute.vue
│   │   ├── PlaylistsView.vue
│   │   ├── QueueView.vue
│   │   ├── SearchView.vue
│   │   └── SettingsView.vue
│   ├── workers
│   │   └── metadata.worker.ts
│   ├── App.vue
│   ├── architecture.spec.ts
│   ├── globals.d.ts
│   ├── main.ts
│   └── version.ts
├── storybook-static
│   ├── assets
│   │   ├── AddRemoveButton-Bb__I2Ad.js
│   │   ├── AlphabetIndex-BIsDcwTy.css
│   │   ├── AlphabetIndex.stories-DL086u0D.js
│   │   ├── AutocompleteInput-CReaOXyq.js
│   │   ├── AutocompleteInput.stories-BtKrwHcE.js
│   │   ├── Avatar.stories-CRsqtQ4-.js
│   │   ├── Badge.stories-0mdkluOV.js
│   │   ├── Button-Czb1u3Rx.js
│   │   ├── Button.stories-BFLipINW.js
│   │   ├── Checkbox-BSLpmE3J.js
│   │   ├── Checkbox.stories-DDb5L79L.js
│   │   ├── CoverImage-CsG9EbrX.js
│   │   ├── CoverImage.stories-Co6IAfFT.js
│   │   ├── CoverPicker.stories-CHd_HzW6.js
│   │   ├── createPlugin-BC4K3--t.js
│   │   ├── DemoView-BbS6hZeV.js
│   │   ├── Divider-Bkr2TEWW.js
│   │   ├── Divider.stories-CW4C6S4K.js
│   │   ├── DropdownMenu-CRspRTYu.js
│   │   ├── DropdownMenu.stories-B9PQ5p1X.js
│   │   ├── EmptyState-D5XkBHsR.js
│   │   ├── EmptyState.stories-BodMsw8s.js
│   │   ├── episodeTrack-DPhyodwM.js
│   │   ├── extension-CpDqYZmQ.js
│   │   ├── extension-CrxxPbk7.js
│   │   ├── extension-DBuTjQdw.js
│   │   ├── extension-DtM7xcaX.js
│   │   ├── extension-RXmtAwl_.js
│   │   ├── fallback-barbie-cover-hIogO7Vx.jpg
│   │   ├── fallback-default-cover-qbQ_L16l.webp
│   │   ├── fallback-neon-cover-lYb2Cv60.webp
│   │   ├── fallback-radio-cover-BzWAg-xA.png
│   │   ├── fallback-tiffany-cover-CaXqpqie.jpg
│   │   ├── fluffy-clouds-CjvFoLmi.jpg
│   │   ├── FormField-BTvuMjFz.js
│   │   ├── FormField.stories-CuYCQunw.js
│   │   ├── IconButton-4jpniXrZ.js
│   │   ├── IconButton.stories-D1CSpW5W.js
│   │   ├── Icon-CIX18BiG.js
│   │   ├── IconGallery.stories-Ds1fOFxO.js
│   │   ├── Icon.stories-YXEZSU0v.js
│   │   ├── iframe-CbBKyjiU.css
│   │   ├── iframe-KLx_99Fx.js
│   │   ├── index-BqFt87G3.js
│   │   ├── index-C6iEUzUn.js
│   │   ├── index-CDaDENmo.js
│   │   ├── index-CHJlrsMz.js
│   │   ├── index-Di4q7vpO.js
│   │   ├── index-DQxM--Xi.js
│   │   ├── index-fGtO0XAo.js
│   │   ├── index-IUvClnQs.js
│   │   ├── Input-DGR2dFOk.js
│   │   ├── Input.stories-Dzyz7Z6a.js
│   │   ├── InputWithAffix-B56HOAFn.js
│   │   ├── InputWithAffix.stories-Dl7uRF7-.js
│   │   ├── Label-D60oUQYU.js
│   │   ├── Label.stories-DC6hKkvH.js
│   │   ├── LinkButton.stories-BCEPJ6wu.js
│   │   ├── ListContainer-D51S9M5D.js
│   │   ├── ListContainer.stories-Dkca7gcN.js
│   │   ├── ListRow-BcWRad06.js
│   │   ├── ListRow-QldPAAa2.css
│   │   ├── ListRow.stories-CvBOry_D.js
│   │   ├── LogiiView-DBSWNpBV.js
│   │   ├── lookup-7o1tNJGU.js
│   │   ├── metadata.worker-Gu6xOMwd.js
│   │   ├── ModalHost.stories-BkXP3arz.js
│   │   ├── ModalLayout-1BMdcDqo.js
│   │   ├── ModalLayout.stories-Cln4Yiix.js
│   │   ├── ModalService-DzHl0aab.js
│   │   ├── PageHeader-CrniuCre.js
│   │   ├── PageHeader.stories-BuHIulDu.js
│   │   ├── PlayingIndicator-3uSF8xo8.js
│   │   ├── PlayingIndicator.stories-Dawl0xRz.js
│   │   ├── _plugin-vue_export-helper-DlAUqK2U.js
│   │   ├── PodcastCatalog-CrR4SeYN.js
│   │   ├── PodcastRoute-BRR1nXat.js
│   │   ├── PodcastService-CFiRsehF.js
│   │   ├── PodcastsView-CEPSIsO2.js
│   │   ├── preload-helper-PPVm8Dsz.js
│   │   ├── ProgressBar-bHoDsGKI.js
│   │   ├── ProgressBar.stories-D-tKLv8v.js
│   │   ├── RadioBrowserClient-FWgob7cV.js
│   │   ├── RadioService-D_uSesTd.js
│   │   ├── RadioView-BTTc_tdD.js
│   │   ├── sber-zvuk-Bi_NENq7.png
│   │   ├── SearchInput.stories-DajMRfGU.js
│   │   ├── SearchInput-WPZLCipx.js
│   │   ├── SectionTitle-1D7frSP0.js
│   │   ├── SectionTitle.stories-BWObR5we.js
│   │   ├── Select.stories-CcL-74CU.js
│   │   ├── Spinner-CyuUrpme.js
│   │   ├── Spinner.stories-DO2-17Rg.js
│   │   ├── Textarea-CWsbeIdG.js
│   │   ├── Textarea.stories-DYbYpOhB.js
│   │   ├── tiffany-floral-corner-o4BrDjx6.png
│   │   ├── tiffany-marble-bg-BP7_03Dp.avif
│   │   ├── ToastHost.stories-DvDkrAM3.js
│   │   ├── ToastService-Ynf0auyx.js
│   │   ├── Toggle.stories-RkpbN0Fr.js
│   │   ├── Toolbar.stories-ClDmOjC7.js
│   │   ├── TrackActions-4yJNECbu.js
│   │   ├── TrackCover-BLhn8KAy.js
│   │   ├── TrackCover.stories-BhVvYesK.js
│   │   ├── useButtonAs-CcYIF8Vz.js
│   │   ├── ViewToggle.stories-Dt9_ESaM.js
│   │   ├── yandex-disk-BDFQ7T17.png
│   │   └── ZvukView-BpEdbGh1.js
│   ├── sb-addons
│   │   └── common-manager-bundle.js
│   ├── sb-common-assets
│   │   ├── favicon.svg
│   │   ├── favicon-wrapper.svg
│   │   ├── nunito-sans-bold-italic.woff2
│   │   ├── nunito-sans-bold.woff2
│   │   ├── nunito-sans-italic.woff2
│   │   └── nunito-sans-regular.woff2
│   ├── sb-manager
│   │   ├── globals.js
│   │   ├── globals-runtime.js
│   │   ├── manager-stores.js
│   │   └── runtime.js
│   ├── apple-touch-icon-180x180.png
│   ├── favicon.ico
│   ├── favicon.svg
│   ├── favicon-wrapper.svg
│   ├── iframe.html
│   ├── index.html
│   ├── index.json
│   ├── logo.webp
│   ├── maskable-icon-512x512.png
│   ├── nunito-sans-bold-italic.woff2
│   ├── nunito-sans-bold.woff2
│   ├── nunito-sans-italic.woff2
│   ├── nunito-sans-regular.woff2
│   ├── project.json
│   ├── pwa-192x192.png
│   ├── pwa-512x512.png
│   ├── pwa-64x64.png
│   └── vite-inject-mocker-entry.js
├── add-path-comments.sh
├── CHANGELOG.md
├── docker-compose.yml
├── Dockerfile
├── env.d.ts
├── eslint.config.ts
├── index.html
├── package.json
├── playwright.config.ts
├── README.md
├── ROADMAP.md
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.vitest.json
├── vite.config.ts
├── vitest.config.ts
└── vitest.setup.ts

102 directories, 725 files
