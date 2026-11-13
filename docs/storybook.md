# Storybook

Storybook документирует UI-компоненты: как они выглядят в разных состояниях и в разных CSS-темах. Это источник истины по внешнему виду, а не по логике (логика - в `docs/`).

## Запуск

```bash
yarn storybook          # dev-режим, http://localhost:6006
yarn build-storybook    # статическая сборка в storybook-static/
```

## Слои компонентов

```
src/components/
├── atoms/        Прокидывают только props/slot. Без сторов, сервисов и плагинов.
├── molecules/    Композиция атомов. Без сторов, сервисов и плагинов.
├── ui/           Органимы: знают про сторы/сервисы ядра (ModalHost, TrackCover, ...).
└── icons/        SVG-иконки + реестр ICONS.
```

Границы слоёв держит линтер (`eslint.config.ts`, блоки `app/ui-layer-atoms` и `app/ui-layer-molecules`, правило `no-restricted-imports`):

| Слой      | Нельзя импортировать                                                    |
| --------- | ----------------------------------------------------------------------- |
| `atoms/`  | `@/stores/*`, `@/services/*`, `@/plugins/*`, `../molecules/*`, `../ui/*` |
| `molecules/` | `@/stores/*`, `@/services/*`, `@/plugins/*`, `../ui/*`                |

`@/composables/*` разрешён обоим слоям, если композабл не тянет стор (пример: `useButtonAs`).

## Темы

5 тем: Тёмная (default), Ретро-радио, Киберпанк, Барби, Тиффани. Механика: `ThemeService.apply()` ставит `data-theme` на `<html>`, `theme-*.css` переопределяют CSS-переменные и перекрашивают глобальные классы (`radio-inset`, `track-cover`, `player-play-pause-btn`).

В Storybook темы доступны двумя способами:

1. **Сетка 5 тем** - decorator из `.storybook/preview.ts` рендерит стори в пяти колонках с `data-theme`. Это дефолт для всех stories.
2. **Тулбар "Тема"** - одна тема на весь экран, для детального просмотра. Обязателен для компонентов с `Teleport to="body"` (ModalLayout, DropdownMenu, AutocompleteInput, ToastHost, ModalHost): их контент уходит в `<body>` вне `data-theme`-обёртки стори, поэтому сетка для них не работает.

`withThemedChrome` - decorator для компонентов, чьи тематические селекторы привязаны к `main`/`footer`/`header`. Оборачивает стори в тематический каркас страницы.

## Правила написания stories

- CSF3: `meta` + `args`. Ручной `render` только для слотов и композиций.
- Состояния показываются через `args`/несколько story-экспортов, не через интерактив.
- `play` - исключение: singleton-hosts без props (`ToastHost`, `ModalHost`). У них нет другого способа показать состояние: тост создаётся вызовом `toastService.show()`.
- Одна стори = одно наблюдаемое состояние. Варианты (variants/sizes) группируются в одном template через `v-for`.
- Заголовок: `Atoms/...`, `Molecules/...`, `Organisms/...`, `Themed/...` (тематически критичные органимы).
- `tags: ['autodocs']` обязателен - автодокументация пропсов из `defineProps`.

## Что вне объёма

Органимы с бизнес-логикой (`TrackRow`, `FolderListItem`, `TrackActions`, `FullPlayer`) и компоненты плагинов в Storybook не покрываются: их поведение зависит от сторов и плагинов, а критерий "как выглядит" для них не отделим от "что делает". Для них источник истины - E2E (`e2e/`).
