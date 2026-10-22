// src/plugins/podcasts/constants.ts

export const PLUGIN_ID = 'podcasts'
export const PLUGIN_NAME = 'Подкасты'
export const PLUGIN_ICON = '🎙️'

export interface PodcastCountry {
  code: string
  label: string
}

export interface PodcastGenre {
  id: string
  label: string
}

export const PODCAST_COUNTRIES: PodcastCountry[] = [
  { code: 'ru', label: 'Россия' },
  { code: 'us', label: 'США' },
  { code: 'gb', label: 'Великобритания' },
  { code: 'de', label: 'Германия' },
  { code: 'fr', label: 'Франция' },
]

export const PODCAST_GENRES: PodcastGenre[] = [
  { id: '', label: 'Все жанры' },
  { id: '1488', label: 'Тру-крайм' },
  { id: '1303', label: 'Юмор' },
  { id: '1321', label: 'Бизнес' },
  { id: '1304', label: 'Образование' },
  { id: '1324', label: 'Общество и культура' },
  { id: '1512', label: 'Здоровье и фитнес' },
  { id: '1543', label: 'Документальный жанр' },
  { id: '1545', label: 'Спорт' },
  { id: '1487', label: 'История' },
  { id: '1489', label: 'Новости' },
  { id: '1500', label: 'Самосовершенствование' },
  { id: '1517', label: 'Ментальное здоровье' },
  { id: '1498', label: 'Изучаем языки' },
  { id: '1301', label: 'Творчество' },
  { id: '1483', label: 'Художественная литература' },
  { id: '1305', label: 'Дети и семья' },
  { id: '1521', label: 'Родительство' },
  { id: '1502', label: 'Досуг' },
  { id: '1310', label: 'Музыка' },
  { id: '1314', label: 'Религия и духовность' },
  { id: '1533', label: 'Наука' },
  { id: '1302', label: 'Личные дневники' },
  { id: '1544', label: 'Отношения' },
  { id: '1318', label: 'Технологии' },
  { id: '1309', label: 'ТВ и кино' },
  { id: '1493', label: 'Предпринимательство' },
  { id: '1482', label: 'Книги' },
  { id: '1511', label: 'Государство' },
]
