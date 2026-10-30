#!/usr/bin/env bash
# add-path-comments.sh — добавляет/чистит шапку-комментарий с путём файла.
# Использование:
#   ./add-path-comments.sh src server          # добавить шапки
#   ./add-path-comments.sh --cleanup src       # удалить шапки

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Папки, которые игнорируем (используется как -not -path '*...*')
EXCLUDE_DIRS=(
  node_modules .git dist build coverage .vscode .idea
  .storybook test-results playwright-report .sessions
)

MODE="add"
if [ "${1:-}" = "--cleanup" ]; then
  MODE="cleanup"
  shift
fi

if [ "$#" -eq 0 ]; then
  echo "Укажите папки для обработки (например: ./add-path-comments.sh src server)"
  echo "Для удаления шапок: ./add-path-comments.sh --cleanup src"
  exit 1
fi

# Собираем аргументы find для исключения директорий
FIND_EXCLUDES=()
for d in "${EXCLUDE_DIRS[@]}"; do
  FIND_EXCLUDES+=(-not -path "*/$d/*")
done

EXT_REGEX='.*\.(js|jsx|mjs|cjs|css|scss|sass|vue|ts|tsx|html)$'

# Возвращает 0, если расширение поддерживается; иначе 1
is_supported() {
  case "$1" in
    js|jsx|mjs|cjs|ts|tsx|css|scss|sass|vue|html) return 0 ;;
    *) return 1 ;;
  esac
}

# Печатает start/end-комментарии для расширения в глобальные переменные
comment_style() {
  case "$1" in
    html|vue)      START_COMMENT="<!--"; END_COMMENT="-->" ;;
    css|scss|sass) START_COMMENT="/*";   END_COMMENT="*/"   ;;
    js|jsx|mjs|cjs|ts|tsx) START_COMMENT="//"; END_COMMENT="" ;;
    *) return 1 ;;
  esac
}

# Удаляет ведущие пустые строки (только в самом начале файла)
strip_leading_blank_lines() {
  local f="$1" tmp
  tmp="$(mktemp)"
  awk 'NF {p=1} p' "$f" > "$tmp" || { rm -f "$tmp"; return 1; }
  # если файл был полностью пустой — вернём пустой
  mv "$tmp" "$f"
}

process_file() {
  local file="$1"
  local ext="${file##*.}"
  is_supported "$ext" || return 0

  # путь относительно директории скрипта
  local rel_path
  if command -v realpath >/dev/null 2>&1; then
    rel_path="$(realpath --relative-to="$SCRIPT_DIR" "$file")"
  else
    # macOS без coreutils: fallback
    rel_path="${file#$SCRIPT_DIR/}"
  fi

  comment_style "$ext" || return 0

  local expected_comment
  if [ -n "$END_COMMENT" ]; then
    expected_comment="$START_COMMENT $rel_path $END_COMMENT"
  else
    expected_comment="$START_COMMENT $rel_path"
  fi

  local first_line
  first_line="$(head -n 1 "$file" | tr -d '\r')"

  if [ "$MODE" = "add" ]; then
    # Уже стоит ровно такой комментарий — ничего не делаем
    if [ "$first_line" = "$expected_comment" ]; then
      return 0
    fi

    # Убираем ведущие пустые строки
    strip_leading_blank_lines "$file"

    # Собираем новый файл: шапка + пустая строка + содержимое
    local tmp
    tmp="$(mktemp)"
    {
      printf '%s\n\n' "$expected_comment"
      cat "$file"
    } > "$tmp"
    mv "$tmp" "$file"

    echo "Добавлен заголовок: $rel_path"
  else
    # cleanup
    local tmp
    tmp="$(mktemp)"
    awk -v start="$START_COMMENT" -v end="$END_COMMENT" '
      BEGIN { removed = 0; }
      NR == 1 && removed == 0 {
        line = $0
        # нормализуем CR
        sub(/\r$/, "", line)
        ok = 0
        if (end == "") {
          # // path
          if (line ~ /^\/\/ [^ ]+\.[A-Za-z0-9]+$/) ok = 1
        } else if (start == "<!--") {
          # <!-- path -->
          if (line ~ /^<!-- [^ ]+\.[A-Za-z0-9]+ -->$/) ok = 1
        } else {
          # /* path */
          if (line ~ /^\/\* [^ ]+\.[A-Za-z0-9]+ \*\/$/) ok = 1
        }
        if (ok) {
          # удаляем первую строку и следующую пустую (если есть)
          removed = 1
          next
        }
      }
      removed == 1 && NR == 2 && $0 ~ /^[[:space:]]*$/ {
        # вторая строка после шапки — пустая, её тоже убираем
        next
      }
      { print }
    ' "$file" > "$tmp"

    mv "$tmp" "$file"
    echo "Очищен заголовок (если был): $rel_path"
  fi
}

for DIR in "$@"; do
  if [ ! -d "$DIR" ]; then
    echo "Папка '$DIR' не найдена. Пропускаем." >&2
    continue
  fi

  while IFS= read -r -d '' file; do
    process_file "$file"
  done < <(find "$DIR" -type f "${FIND_EXCLUDES[@]}" | grep -E "$EXT_REGEX" | tr '\n' '\0' )
done