// src/services/events/bus.spec.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBus } from './bus';
import type { TrackId } from '@/types/ids';

const TRACK_A = '11111111-1111-4111-8111-111111111111' as TrackId;
const TRACK_B = '22222222-2222-4222-8222-222222222222' as TrackId;

describe('eventBus', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('вызывает обработчик с payload события', () => {
    const bus = createBus();
    const handler = vi.fn();

    bus.on('track:metadata-updated', handler);
    bus.emit('track:metadata-updated', TRACK_A);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(TRACK_A);
  });

  it('вызывает всех обработчиков события', () => {
    const bus = createBus();
    const first = vi.fn();
    const second = vi.fn();

    bus.on('track:metadata-updated', first);
    bus.on('track:metadata-updated', second);
    bus.emit('track:metadata-updated', TRACK_A);

    expect(first).toHaveBeenCalledWith(TRACK_A);
    expect(second).toHaveBeenCalledWith(TRACK_A);
  });

  it('не вызывает обработчиков других событий', () => {
    const bus = createBus();
    const trackHandler = vi.fn();
    const spaceHandler = vi.fn();

    bus.on('track:metadata-updated', trackHandler);
    bus.on('download:space-selected', spaceHandler);

    bus.emit('track:metadata-updated', TRACK_A);

    expect(trackHandler).toHaveBeenCalledTimes(1);
    expect(spaceHandler).not.toHaveBeenCalled();
  });

  it('emit без подписчиков не бросает ошибку', () => {
    const bus = createBus();
    expect(() => bus.emit('track:metadata-updated', TRACK_A)).not.toThrow();
  });

  it('отписка прекращает вызовы', () => {
    const bus = createBus();
    const handler = vi.fn();

    const off = bus.on('track:metadata-updated', handler);
    bus.emit('track:metadata-updated', TRACK_A);
    off();
    bus.emit('track:metadata-updated', TRACK_B);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(TRACK_A);
  });

  it('повторная отписка безопасна', () => {
    const bus = createBus();
    const off = bus.on('track:metadata-updated', () => {});

    off();
    expect(() => off()).not.toThrow();
  });

  it('один упавший обработчик не блокирует остальные', () => {
    const bus = createBus();
    const after = vi.fn();

    bus.on('track:metadata-updated', () => {
      throw new Error('boom');
    });
    bus.on('track:metadata-updated', after);

    expect(() => bus.emit('track:metadata-updated', TRACK_A)).not.toThrow();

    expect(after).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('отписка во время dispatch не пропускает остальных', () => {
    const bus = createBus();
    const late = vi.fn();

    let offLate: (() => void) | null = null;
    bus.on('track:metadata-updated', () => {
      offLate?.();
    });
    offLate = bus.on('track:metadata-updated', late);

    bus.emit('track:metadata-updated', TRACK_A);

    // Снимок списка сделан до dispatch — late обязан получить событие.
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('подписка во время dispatch не вызывает нового обработчика в этом же emit', () => {
    const bus = createBus();
    const nested = vi.fn();

    bus.on('track:metadata-updated', () => {
      bus.on('track:metadata-updated', nested);
    });

    bus.emit('track:metadata-updated', TRACK_A);

    expect(nested).not.toHaveBeenCalled();

    // Но на следующем dispatch он уже участвует.
    bus.emit('track:metadata-updated', TRACK_B);
    expect(nested).toHaveBeenCalledTimes(1);
  });

  it('после отписки всех обработчиков событие можно переподписать заново', () => {
    const bus = createBus();
    const first = vi.fn();
    const second = vi.fn();

    const off = bus.on('track:metadata-updated', first);
    off();

    bus.on('track:metadata-updated', second);
    bus.emit('track:metadata-updated', TRACK_A);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
