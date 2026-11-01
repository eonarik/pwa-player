// src/utils/playlistBlueprint.ts

const PREFIX = 'CUEI1:';

export interface BlueprintTrack {
  a: string;
  t: string;
  al?: string;
  d?: number;
}

export interface BlueprintData {
  n: string;
  tr: BlueprintTrack[];
}

/**
 * Сжимает строку через Gzip (нативный API браузера).
 */
async function compress(str: string): Promise<ArrayBuffer> {
  const stream = new Blob([str]).stream();
  const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
  return new Response(compressedStream).arrayBuffer();
}

/**
 * Разжимает Gzip.
 */
async function decompress(buffer: ArrayBuffer): Promise<string> {
  const stream = new Blob([buffer]).stream();
  const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
  return new Response(decompressedStream).text();
}

/**
 * Упаковывает данные плейлиста в строку формата `CUEI1:...`
 */
export async function encodeBlueprint(data: BlueprintData): Promise<string> {
  const json = JSON.stringify(data);
  const compressed = await compress(json);

  // Преобразуем ArrayBuffer в Base64
  const bytes = new Uint8Array(compressed);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const base64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${PREFIX}${base64}`;
}

/**
 * Распаковывает строку `CUEI1:...` в объект.
 * Возвращает `null`, если строка невалидна.
 */
export async function decodeBlueprint(str: string): Promise<BlueprintData | null> {
  if (!str.startsWith(PREFIX)) return null;

  try {
    const base64 = str.slice(PREFIX.length);

    let b64 = base64.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';

    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const json = await decompress(bytes.buffer);
    const data = JSON.parse(json) as BlueprintData;

    if (!data.n || !Array.isArray(data.tr)) return null;

    return data;
  } catch {
    return null;
  }
}
