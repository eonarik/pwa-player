// src/architecture.spec.ts

/**
 * Архитектурные тесты графа импортов.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_ROOT = dirname(fileURLToPath(import.meta.url));

/** Файлы, не входящие в граф приложения (тесты, истории, сами архитектурные проверки). */
function isSourceFile(name: string): boolean {
  return /\.(ts|vue)$/.test(name) && !name.endsWith('.spec.ts') && !name.endsWith('.stories.ts');
}

function collectFiles(dir: string, acc: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectFiles(full, acc);
    } else if (isSourceFile(entry)) {
      acc.push(full);
    }
  }
}

/**
 * Разрешает спецификатор импорта в путь файла внутри src.
 * Возвращает null для внешних пакетов и для не-разрешимых путей.
 */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) {
    base = resolvePath(SRC_ROOT, specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    base = resolvePath(dirname(fromFile), specifier);
  } else {
    return null;
  }

  const candidates = [`${base}.ts`, `${base}.vue`, `${base}/index.ts`, base];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* кандидата нет — пробуем следующий */
    }
  }
  return null;
}

const IMPORT_RE = /(?:^|\n)[ \t]*(?:import|export)([\s\S]*?)from[ \t]*['"]([^'"]+)['"]/g;

/** true, если импорт полностью type-only (`import type ...` или все спецификаторы с `type`). */
function isTypeOnly(clause: string): boolean {
  const trimmed = clause.trim();
  if (trimmed.startsWith('type ') || /^type\s*\{/.test(trimmed)) return true;

  const braces = trimmed.match(/\{([^}]*)\}/s);
  const withoutBraces = trimmed.replace(/\{[^}]*\}/s, '').trim();
  const hasValueBinding = /^[A-Za-z_$][\w$]*\s*(?:,|$)/.test(withoutBraces);

  if (!braces) return false;
  const specs = (braces[1] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allSpecsAreType = specs.length > 0 && specs.every((s) => s.startsWith('type '));

  return allSpecsAreType && !hasValueBinding;
}

interface GraphOptions {
  includeTypeOnly: boolean;
}

function buildGraph({ includeTypeOnly }: GraphOptions): Map<string, Set<string>> {
  const files: string[] = [];
  collectFiles(SRC_ROOT, files);

  const graph = new Map<string, Set<string>>();

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const deps = new Set<string>();

    for (const match of content.matchAll(IMPORT_RE)) {
      const clause = match[1];
      const specifier = match[2];
      if (clause === undefined || specifier === undefined) continue;

      if (!includeTypeOnly && isTypeOnly(clause)) continue;

      const resolved = resolveSpecifier(file, specifier);
      if (resolved && resolved !== file) deps.add(resolved);
    }

    graph.set(file, deps);
  }

  return graph;
}

/** Тарьян: возвращает сильно-связные компоненты размером > 1 (то есть циклы). */
function findCycles(graph: Map<string, Set<string>>): string[][] {
  let counter = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indexOf = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const cycles: string[][] = [];

  // Явный стек вместо рекурсии: граф достаточно глубокий для рекурсивного обхода.
  for (const root of graph.keys()) {
    if (indexOf.has(root)) continue;

    const frames: Array<{ node: string; children: string[]; cursor: number }> = [];
    indexOf.set(root, counter);
    lowlink.set(root, counter);
    counter++;
    stack.push(root);
    onStack.add(root);
    frames.push({ node: root, children: [...(graph.get(root) ?? [])], cursor: 0 });

    while (frames.length > 0) {
      const frame = frames[frames.length - 1]!;
      const children = frame.children;

      if (frame.cursor < children.length) {
        const next = children[frame.cursor]!;
        frame.cursor++;
        if (!graph.has(next)) continue;

        if (!indexOf.has(next)) {
          indexOf.set(next, counter);
          lowlink.set(next, counter);
          counter++;
          stack.push(next);
          onStack.add(next);
          frames.push({ node: next, children: [...(graph.get(next) ?? [])], cursor: 0 });
        } else if (onStack.has(next)) {
          lowlink.set(frame.node, Math.min(lowlink.get(frame.node)!, indexOf.get(next)!));
        }
        continue;
      }

      frames.pop();
      if (lowlink.get(frame.node) === indexOf.get(frame.node)) {
        const component: string[] = [];
        let popped: string;
        do {
          popped = stack.pop()!;
          onStack.delete(popped);
          component.push(popped);
        } while (popped !== frame.node);
        if (component.length > 1) cycles.push(component);
      } else {
        const parent = frames[frames.length - 1];
        if (parent) {
          lowlink.set(parent.node, Math.min(lowlink.get(parent.node)!, lowlink.get(frame.node)!));
        }
      }
    }
  }

  return cycles;
}

function relative(fullPath: string): string {
  return fullPath.slice(SRC_ROOT.length + 1).split(/[\\/]/).join('/');
}

describe('архитектура графа импортов', () => {
  it('не содержит рантайм-циклов между модулями src', () => {
    const cycles = findCycles(buildGraph({ includeTypeOnly: false }));

    const rendered = cycles
      .map((component) => `\n  цикл из ${component.length} модулей:\n    ${component.map(relative).join('\n    ')}`)
      .join('');

    expect(rendered, `Найдены циклические зависимости:${rendered}`).toBe('');
  });

  it('не содержит циклов даже с учётом type-only импортов', () => {
    const cycles = findCycles(buildGraph({ includeTypeOnly: true }));

    const rendered = cycles
      .map((component) => `\n  цикл из ${component.length} модулей:\n    ${component.map(relative).join('\n    ')}`)
      .join('');

    expect(rendered, `Найдены циклические зависимости (включая типы):${rendered}`).toBe('');
  });
});
