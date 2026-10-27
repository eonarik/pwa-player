// src/plugins/zvuk/ZvukService.ts

export interface ZvukArtist {
  id: string
  title: string
  image?: { src: string }
}

export interface ZvukTrack {
  id: string
  title: string
  duration: number
  artists: ZvukArtist[]
  release: {
    title: string
    image: { src: string }
  } | null
}

export interface ZvukRelease {
  id: string
  title: string
  artistTemplate: string
  image: { src: string }
}

export type ZvukSearchType = 'tracks' | 'artists' | 'releases'

export interface ZvukSearchResults {
  tracks: ZvukTrack[]
  artists: ZvukArtist[]
  releases: ZvukRelease[]
}

export class ZvukService {
  private static instance: ZvukService | null = null

  static getInstance(): ZvukService {
    if (!ZvukService.instance) {
      ZvukService.instance = new ZvukService()
    }
    return ZvukService.instance
  }

  async search(query: string, types: ZvukSearchType[]): Promise<ZvukSearchResults> {
    const params = new URLSearchParams({
      q: query,
      types: types.join(','),
    })
    const res = await fetch(`/api/zvuk/search?${params.toString()}`)

    if (!res.ok) {
      throw new Error(`Search failed: ${res.status}`)
    }

    return res.json() as Promise<ZvukSearchResults>
  }

  getStreamUrl(trackId: string): string {
    return `/api/zvuk/stream?id=${trackId}`
  }
}

export const zvukService = ZvukService.getInstance()
