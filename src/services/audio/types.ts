export type AudioEventMap = {
  timeupdate: { currentTime: number; duration: number }
  loadedmetadata: { duration: number }
  play: void
  pause: void
  ended: void
  error: { message: string; code?: number }
  volumechange: { volume: number; muted: boolean }
  waiting: void
  canplay: void
}

export type AudioEventName = keyof AudioEventMap
export type AudioListener<K extends AudioEventName> = (payload: AudioEventMap[K]) => void
