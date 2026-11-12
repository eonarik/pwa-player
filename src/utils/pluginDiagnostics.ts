// src/utils/pluginDiagnostics.ts
//
// Диагностика загрузки плагинов для окружений без DevTools (Safari iOS PWA).
// Накапливает события (регистрация манифестов, ошибки entry()) и печатает
// их в DOM-блоке, который открывается кнопкой на экране Home.
//
// Временный инструмент для расследования бага "плагины не найдены" в Safari.

interface DiagnosticEvent {
  at: number;
  kind: 'info' | 'error';
  text: string;
}

const events: DiagnosticEvent[] = [];

function push(kind: DiagnosticEvent['kind'], text: string): void {
  events.push({ at: Date.now(), kind, text });
  // Защита от разрастания при массовых ошибках.
  if (events.length > 100) events.shift();
}

/** Зафиксировать информационное событие (например, результат glob-регистрации). */
export function diagInfo(text: string): void {
  push('info', text);
}

/** Зафиксировать ошибку с сериализацией причины (включая cause-цепочку). */
export function diagError(scope: string, err: unknown): void {
  push('error', `${scope}: ${describeError(err)}`);
}

export function getDiagnostics(): readonly DiagnosticEvent[] {
  return events;
}

export function clearDiagnostics(): void {
  events.length = 0;
}

function describeError(err: unknown): string {
  if (err instanceof Error) {
    const cause = err.cause instanceof Error ? ` | cause=${err.cause.message}` : '';
    return `${err.name}: ${err.message}${cause}`;
  }
  return String(err);
}

const PANEL_ID = 'plugin-diagnostics';

/**
 * Открывает/закрывает экранный блок с диагностикой. Работает без DevTools:
 * текст рендерится прямо в document.body.
 */
export function toggleDiagnosticsPanel(): void {
  if (typeof document === 'undefined') return;

  const existing = document.getElementById(PANEL_ID);
  if (existing) {
    existing.remove();
    return;
  }

  const box = document.createElement('div');
  box.id = PANEL_ID;
  box.setAttribute(
    'style',
    [
      'position:fixed',
      'left:8px',
      'right:8px',
      'bottom:8px',
      'max-height:60vh',
      'overflow:auto',
      'z-index:99999',
      'background:#0b1020',
      'color:#eaf0ff',
      'border:1px solid #334155',
      'border-radius:8px',
      'padding:12px',
      'font:12px/1.4 ui-monospace,SFMono-Regular,monospace',
      'white-space:pre-wrap',
      'word-break:break-word',
    ].join(';'),
  );

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'no navigator';
  const standalone =
    typeof window !== 'undefined' &&
    (('standalone' in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone) ||
      window.matchMedia('(display-mode: standalone)').matches);

  const lines = events.length > 0 ? events.map((e) => `${e.kind === 'error' ? 'ERR ' : '    '}${e.text}`) : ['нет событий'];

  box.textContent = [
    'Диагностика плагинов',
    `standalone: ${standalone ? 'да' : 'нет'} | online: ${navigator.onLine ? 'да' : 'нет'}`,
    `UA: ${ua}`,
    '---',
    ...lines,
  ].join('\n');

  box.addEventListener('click', () => box.remove());
  document.body.appendChild(box);
}
