# Документация CUEI Media Player

Онбординг-документация проекта

## Структура документации

| Файл              | Что описывает                                                         |
| ----------------- | --------------------------------------------------------------------- |
| `STRUCTURE.md`    | Дерево файлов проекта (генерируется `yarn tree-generate`)             |
| `architecture.md` | Глобальная архитектура: ядро, плагины, жизненный цикл данных          |
| `data-model.md`   | Типы и интерфейсы: Track, Folder, Album, Source, Metadata             |
| `plugins.md`      | Контракт LibrarySource + таблица плагинов                             |
| `server.md`       | Express-сервер: маршруты, прокси, метаданные                          |
| `stores.md`       | Pinia stores: состояние, действия, подписки                           |
| `services.md`     | Сервисы ядра: audio, library, metadata, download, persistence, backup |
| `conventions.md`  | Соглашения проекта: UUID, реляционные связи, именование               |

## Как обновлять

```bash
# Пересобрать AST-манифест (для LLM или ревью)
yarn docs:manifest

# Обновить дерево файлов
yarn tree-generate
```

Манифест генерируется скриптом `scripts/generate-docs-manifest.ts` и сохраняется в `docs/.manifest.json` (~200KB). Содержит все публичные экспорты (interfaces, types, classes, functions) с сигнатурами и JSDoc, сгруппированные по слоям архитектуры.
