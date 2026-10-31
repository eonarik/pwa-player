// server/test-zvuk.js

import 'dotenv/config';
import { searchMetadataStrict } from './service.js';
import { ZvukAPI } from './sberzvuk-api.js';
import { getArtistSearchVariants } from '../../shared/aliases.js';

// ==========================================
// НАСТРОЙКИ ДЛЯ ТЕСТА (МЕНЯЙ ТОЛЬКО ЗДЕСЬ)
// ==========================================
const ARTIST = '#####';
const TITLE = 'Пусто';
// ==========================================

const USER_TOKEN = process.env.ZVUK_TOKEN;

async function test() {
  if (!USER_TOKEN) {
    console.error('❌ ОШИБКА: ZVUK_TOKEN не найден в .env');
    return;
  }

  console.log(`\n=== ЗАПРОС: "${ARTIST}" - "${TITLE}" ===\n`);

  try {
    const api = new ZvukAPI(USER_TOKEN);

    // 1. Проверяем, как отработали алиасы
    const artistVariants = getArtistSearchVariants(ARTIST);
    let targetArtists = artistVariants;
    if (artistVariants.length > 1) {
      targetArtists = artistVariants.slice(1); // Берем только алиасы
    }

    const searchQueries = targetArtists.length > 0 ? targetArtists.map((a) => `${a} ${TITLE}`) : [TITLE];

    console.log(`[Алиасы] Исходный артист: "${ARTIST}"`);
    console.log(`[Алиасы] Найденные варианты: ${JSON.stringify(artistVariants)}`);
    console.log(`[Алиасы] Будут использоваться для поиска: ${JSON.stringify(searchQueries)}`);

    // 2. Что реально возвращает Звук на эти запросы?
    for (const query of searchQueries) {
      console.log(`\n--- Сырой ответ API Звука на запрос: "${query}" ---`);
      const searchData = await api.execute('getSearchAll', { query, limit: 5 });
      const rawTracks = searchData?.search?.tracks?.items || [];

      if (rawTracks.length === 0) {
        console.log('  (ничего не найдено)');
        continue;
      }

      for (const t of rawTracks) {
        console.log(`  - [${t.id}] "${t.title}" (Артисты: ${t.artists?.map((a) => a.title).join(', ') || 'нет'})`);
      }
    }

    // 3. Что вернет наша функция searchMetadataStrict?
    console.log(`\n--- Результат searchMetadataStrict (с логикой скоринга) ---`);
    const result = await searchMetadataStrict(ARTIST, TITLE, USER_TOKEN);

    if (result) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('null (не найдено или скор ниже порога)');
    }
  } catch (err) {
    console.error('Ошибка:', err);
  }
}

test();
