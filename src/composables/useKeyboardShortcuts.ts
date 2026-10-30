// src/composables/useKeyboardShortcuts.ts

import { onMounted, onUnmounted } from 'vue';
import { modalService } from '@/services/ui/ModalService';
import { usePlayerStore } from '@/stores/player';
import { isLiveStream } from '@/plugins/registry';

interface KeyboardOptions {
  onToggle: () => void;
  onToggleMute: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeekBy: (delta: number) => void;
  onVolumeBy: (delta: number) => void;
}

export function useKeyboardShortcuts(options: KeyboardOptions) {
  const player = usePlayerStore();

  function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (target.isContentEditable) return true;
    return target.closest('[contenteditable="true"], [contenteditable=""]') !== null;
  }

  function isButtonLikeTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'BUTTON' || tag === 'A') return true;
    return target.closest('[role="button"]') !== null;
  }

  function isCurrentLive(): boolean {
    const track = player.currentTrack;
    return track ? isLiveStream(track.pluginId) : false;
  }

  function handler(e: KeyboardEvent) {
    if (modalService.active.value !== null) return;

    if (isEditableTarget(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.code === 'Space' && isButtonLikeTarget(e.target)) return;

    const live = isCurrentLive();

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        options.onToggle();
        break;

      case 'ArrowRight':
        if (live) return;
        e.preventDefault();
        options.onSeekBy(e.shiftKey ? 30 : 5);
        break;

      case 'ArrowLeft':
        if (live) return;
        e.preventDefault();
        options.onSeekBy(e.shiftKey ? -30 : -5);
        break;

      case 'ArrowUp':
        e.preventDefault();
        options.onVolumeBy(0.05);
        break;

      case 'ArrowDown':
        e.preventDefault();
        options.onVolumeBy(-0.05);
        break;

      case 'KeyN':
        if (live) return;
        e.preventDefault();
        options.onNext();
        break;

      case 'KeyP':
        if (live) return;
        e.preventDefault();
        options.onPrev();
        break;

      case 'KeyM':
        e.preventDefault();
        options.onToggleMute();
        break;
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handler);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handler);
  });
}
