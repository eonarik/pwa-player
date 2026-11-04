// server/src/plugins/zvuk/test-zvuk.js

import 'dotenv/config';
import { searchMetadataStrict } from './service.js';
import { ZvukAPI } from './sberzvuk-api.js';
import { getArtistSearchVariants } from '../../shared/aliases.js';

// ==========================================
// НАСТРОЙКИ ДЛЯ ТЕСТА (МЕНЯЙ ТОЛЬКО ЗДЕСЬ)
// ==========================================
const ARTIST = 'The Hatters';
const TITLE = 'Танцы';
// ==========================================

const USER_TOKEN = process.env.ZVUK_TOKEN;
async function test() {
  if (!USER_TOKEN) {
    console.error('❌ ОШИБКА: ZVUK_TOKEN не найден в .env');
    return;
  }
  try {
    const api = new ZvukAPI(USER_TOKEN);

    // 1. Проверяем, как отработали алиасы
    const artistVariants = getArtistSearchVariants(ARTIST);
    let targetArtists = artistVariants;
    if (artistVariants.length > 1) {
      targetArtists = artistVariants.slice(1); // Берем только алиасы
    }

    const searchQueries = targetArtists.length > 0 ? targetArtists.map((a) => `${a} ${TITLE}`) : [TITLE];
    // 2. Что реально возвращает Звук на эти запросы?
    for (const query of searchQueries) {
      const searchData = await api.execute('getSearchAll', { query, limit: 5 });
      const rawTracks = searchData?.search?.tracks?.items || [];

      if (rawTracks.length === 0) {
        continue;
      }

      for (const t of rawTracks) {
      }
    }

    // 3. Что вернет наша функция searchMetadataStrict?
    const result = await searchMetadataStrict(ARTIST, TITLE, USER_TOKEN);

    if (result) {
    } else {
    }
  } catch (err) {
    console.error('Ошибка:', err);
  }
}

test();
