// src/plugins/radio/RadioSavedList.spec.ts

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RadioSavedList from './RadioSavedList.vue'
import type { SavedStation } from './index'

function makeStation(overrides: Partial<SavedStation> = {}): SavedStation {
  return {
    id: 'st-1',
    name: 'Station One',
    url: 'https://stream.example.com/one',
    favicon: '',
    ...overrides,
  }
}

describe('RadioSavedList', () => {
  it('рендерит пустое состояние', () => {
    const wrapper = mount(RadioSavedList, {
      props: { stations: [], currentTrackId: null, isPlaying: false },
    })
    expect(wrapper.text()).toContain('Вы пока не добавили ни одной станции')
  })

  it('рендерит список станций', () => {
    const wrapper = mount(RadioSavedList, {
      props: {
        stations: [makeStation({ id: 'a', name: 'A' }), makeStation({ id: 'b', name: 'B' })],
        currentTrackId: null,
        isPlaying: false,
      },
    })
    expect(wrapper.text()).toContain('A')
    expect(wrapper.text()).toContain('B')
  })

  it('эмитит play при клике', async () => {
    const station = makeStation({ id: 'a', name: 'A' })
    const wrapper = mount(RadioSavedList, {
      props: { stations: [station], currentTrackId: null, isPlaying: false },
    })

    const rows = wrapper.findAll('.cursor-pointer')
    await rows[0]!.trigger('click')

    expect(wrapper.emitted('play')).toBeTruthy()
    expect(wrapper.emitted('play')![0]).toEqual([station])
  })

  it('эмитит remove при клике на крестик', async () => {
    const station = makeStation({ id: 'a', name: 'A' })
    const wrapper = mount(RadioSavedList, {
      props: { stations: [station], currentTrackId: null, isPlaying: false },
    })

    const removeBtn = wrapper.find('button[aria-label="Удалить станцию"]')
    await removeBtn.trigger('click')

    expect(wrapper.emitted('remove')).toBeTruthy()
    expect(wrapper.emitted('remove')![0]).toEqual([station])
  })
})
