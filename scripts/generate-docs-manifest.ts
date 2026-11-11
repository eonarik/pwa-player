// scripts/generate-docs-manifest.ts
//
// AST-скрипт: извлекает публичные экспорты из исходников в компактный JSON.
// Фильтрует по слоям архитектуры, усекает signatures до существенного.
//
// Использование: npx tsx scripts/generate-docs-manifest.ts
// Выход: docs/.manifest.json (~40-60 KB)

import ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const SERVER = path.join(ROOT, 'server/src');
const OUTPUT = path.join(ROOT, 'docs/.manifest.json');

const INCLUDE_DIRS = [
  'src/types',
  'src/plugins',
  'src/services',
  'src/stores',
  'src/composables',
  'src/navigation',
  'src/router',
  'src/utils',
  'src/shared',
  'server/src',
];

interface ExportEntry {
  name: string;
  kind: 'interface' | 'type' | 'class' | 'function' | 'const' | 'enum';
  signature: string;
  jsdoc?: string;
}

interface FileManifest {
  file: string;
  layer: string;
  exports: ExportEntry[];
}

function extractJsDoc(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
  const fullText = sourceFile.getFullText();
  const ranges = ts.getLeadingCommentRanges(fullText, node.getFullStart());
  if (!ranges) return undefined;
  for (const r of ranges) {
    const text = fullText.slice(r.pos, r.end);
    if (text.startsWith('/**')) {
      const cleaned = text
        .replace(/^\/\*\*[\s]*/, '')
        .replace(/[\s]*\*\/$/, '')
        .split('\n')
        .map((l) => l.replace(/^\s*\*?\s?/, ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      return cleaned.length > 200 ? cleaned.slice(0, 197) + '...' : cleaned;
    }
  }
  return undefined;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 3) + '...';
}

function signatureHeader(node: ts.Node, sourceFile: ts.SourceFile): string {
  const text = node.getText(sourceFile);
  const single = text.replace(/\s+/g, ' ').trim();

  if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) {
    return truncate(single, 400);
  }

  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
    const braceIdx = text.indexOf('{');
    if (braceIdx > 0) {
      const header = text.slice(0, braceIdx).replace(/\s+/g, ' ').trim();
      return truncate(header + ' ...', 250);
    }
    return truncate(single, 250);
  }

  if (ts.isClassDeclaration(node)) {
    const name = node.name?.getText(sourceFile) ?? 'anonymous';
    const publicMembers: string[] = [];
    for (const m of node.members) {
      const mods = ts.canHaveModifiers(m) ? ts.getModifiers(m) : undefined;
      if (mods?.some((mod) => mod.kind === ts.SyntaxKind.PrivateKeyword || mod.kind === ts.SyntaxKind.ProtectedKeyword))
        continue;
      if (ts.isPropertyDeclaration(m) || ts.isMethodDeclaration(m)) {
        const propName = m.name?.getText(sourceFile);
        if (propName) {
          if (ts.isMethodDeclaration(m)) {
            const sig = m.getText(sourceFile).replace(/\s+/g, ' ');
            const braceIdx = sig.indexOf('{');
            publicMembers.push(braceIdx > 0 ? sig.slice(0, braceIdx).trim() + ';' : sig + ';');
          } else {
            const propText = m.getText(sourceFile).replace(/\s+/g, ' ');
            publicMembers.push(
              propText.includes('=') ? propText.split('=').slice(0, 2).join('=').trim() + ';' : propText.trim() + ';',
            );
          }
        }
      }
    }
    return truncate(`class ${name} { ${publicMembers.join(' ')} }`, 600);
  }

  if (ts.isVariableStatement(node)) {
    const decls = node.declarationList.declarations.map((d) => {
      const name = d.name.getText(sourceFile);
      const type = d.type ? ': ' + d.type.getText(sourceFile) : '';
      return `${name}${type}`;
    });
    const kind = node.declarationList.flags & ts.NodeFlags.Const ? 'const' : 'let';
    return `export ${kind} ${decls.join(', ')}`;
  }

  return truncate(single, 200);
}

function shouldInclude(relativePath: string): boolean {
  for (const dir of INCLUDE_DIRS) {
    if (relativePath.startsWith(dir)) return true;
  }
  return false;
}

function inferLayer(relativePath: string): string {
  if (relativePath.startsWith('src/types')) return 'types';
  if (relativePath.startsWith('src/plugins/')) return 'plugins';
  if (relativePath.startsWith('src/services/')) return 'services';
  if (relativePath.startsWith('src/stores/')) return 'stores';
  if (relativePath.startsWith('src/composables/')) return 'composables';
  if (relativePath.startsWith('src/router')) return 'router';
  if (relativePath.startsWith('src/navigation')) return 'navigation';
  if (relativePath.startsWith('src/utils')) return 'utils';
  if (relativePath.startsWith('src/shared')) return 'shared';
  if (relativePath.startsWith('server/')) return 'server';
  return 'other';
}

function processFile(filePath: string, program: ts.Program): FileManifest | null {
  const sourceFile = program.getSourceFile(filePath);
  if (!sourceFile) return null;

  const rel = path.relative(ROOT, filePath);
  const relativePath = rel.split(path.sep).join('/');
  if (!shouldInclude(relativePath)) return null;
  if (relativePath.includes('/logii/') && !relativePath.endsWith('index.ts')) return null;
  if (relativePath.includes('/test/') || relativePath.includes('/e2e/')) return null;

  const exports: ExportEntry[] = [];

  function hasExportModifier(node: ts.Node): boolean {
    const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    return mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
  }

  function visit(node: ts.Node) {
    if (ts.isInterfaceDeclaration(node) && hasExportModifier(node)) {
      exports.push({
        name: node.name.getText(sourceFile),
        kind: 'interface',
        signature: signatureHeader(node, sourceFile),
        jsdoc: extractJsDoc(node, sourceFile),
      });
    }
    if (ts.isTypeAliasDeclaration(node) && hasExportModifier(node)) {
      exports.push({
        name: node.name.getText(sourceFile),
        kind: 'type',
        signature: signatureHeader(node, sourceFile),
        jsdoc: extractJsDoc(node, sourceFile),
      });
    }
    if (ts.isClassDeclaration(node) && hasExportModifier(node)) {
      exports.push({
        name: node.name?.getText(sourceFile) ?? 'default',
        kind: 'class',
        signature: signatureHeader(node, sourceFile),
        jsdoc: extractJsDoc(node, sourceFile),
      });
    }
    if (ts.isFunctionDeclaration(node) && hasExportModifier(node)) {
      exports.push({
        name: node.name?.getText(sourceFile) ?? 'default',
        kind: 'function',
        signature: signatureHeader(node, sourceFile),
        jsdoc: extractJsDoc(node, sourceFile),
      });
    }
    if (ts.isVariableStatement(node) && hasExportModifier(node)) {
      for (const decl of node.declarationList.declarations) {
        const name = decl.name.getText(sourceFile);
        if (name.startsWith('_')) continue;
        exports.push({
          name,
          kind: 'const',
          signature: signatureHeader(node, sourceFile),
          jsdoc: extractJsDoc(node, sourceFile),
        });
      }
    }
    if (ts.isEnumDeclaration(node) && hasExportModifier(node)) {
      exports.push({
        name: node.name.getText(sourceFile),
        kind: 'enum',
        signature: signatureHeader(node, sourceFile),
        jsdoc: extractJsDoc(node, sourceFile),
      });
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);

  if (exports.length === 0) return null;

  return { file: relativePath, layer: inferLayer(relativePath), exports };
}

function collectRelevantFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'coverage', '.git', 'test', 'e2e'].includes(entry.name)) continue;
      results.push(...collectRelevantFiles(full));
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.spec.ts') || entry.name.endsWith('.stories.ts') || entry.name.endsWith('.test.js'))
        continue;
      if (
        entry.name.endsWith('.ts') ||
        entry.name.endsWith('.mts') ||
        entry.name.endsWith('.js') ||
        entry.name.endsWith('.mjs')
      ) {
        results.push(full);
      }
    }
  }
  return results;
}

// --- Main ---

const allCandidateFiles = [...collectRelevantFiles(SRC), ...collectRelevantFiles(SERVER)];

const allFiles = allCandidateFiles.filter((f) => {
  const rel = path.relative(ROOT, f).split(path.sep).join('/');
  return shouldInclude(rel);
});

console.log(`Scanning ${allFiles.length} files (filtered from ${allCandidateFiles.length})...`);

const program = ts.createProgram(allFiles, {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  allowJs: true,
  baseUrl: ROOT,
  paths: { '@/*': ['./src/*'] },
});

const manifests: FileManifest[] = [];

for (const file of allFiles) {
  const manifest = processFile(file, program);
  if (manifest) {
    manifests.push(manifest);
  }
}

const grouped: Record<string, FileManifest[]> = {};
for (const m of manifests) {
  if (!grouped[m.layer]) grouped[m.layer] = [];
  grouped[m.layer].push(m);
}

const totalExports = manifests.reduce((acc, m) => acc + m.exports.length, 0);
const byKind: Record<string, number> = {};
for (const m of manifests) {
  for (const e of m.exports) {
    byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
  }
}

const output = {
  $schema: 'cuei-docs-manifest-v1',
  generated: new Date().toISOString(),
  stats: {
    files: manifests.length,
    totalExports,
    byKind,
    layers: Object.fromEntries(
      Object.entries(grouped).map(([k, v]) => [k, v.reduce((a, m) => a + m.exports.length, 0)]),
    ),
  },
  groups: grouped,
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
const jsonStr = JSON.stringify(output, null, 1);
fs.writeFileSync(OUTPUT, jsonStr, 'utf-8');

const sizeKB = (Buffer.byteLength(jsonStr) / 1024).toFixed(1);
console.log(`Done: ${manifests.length} files, ${totalExports} exports (${sizeKB} KB)`);
console.log(
  'Layer exports:',
  JSON.stringify(
    Object.fromEntries(Object.entries(grouped).map(([k, v]) => [k, v.reduce((a, m) => a + m.exports.length, 0)])),
  ),
);
