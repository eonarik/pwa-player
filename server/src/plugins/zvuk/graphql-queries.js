// server/src/plugins/zvuk/graphql-queries.js

export const QUERIES = {
  getSearchAll: `
    query getSearchAll($query: String, $limit: Int = 10) {
      search(query: $query) {
        bestMatch {
          __typename
          ... on Artist { id title }
          ... on Release { id title }
        }
        tracks(limit: $limit) {
          items {
            id
            title
            duration
            artists { id title }
            release { title image { src } }
          }
        }
        artists(limit: 5) {
          items { id title }
        }
        releases(limit: 5) {
          items { id title type }
        }
      }
    }
  `,

  getArtist: `
    query getArtist($ids: [ID!]!, $withPopularTracks: Boolean = false) {
      getArtists(ids: $ids) {
        id
        title
        popularTracks(limit: 30) @include(if: $withPopularTracks) {
          id
          title
          duration
          artists { id title }
          release { title image { src } }
        }
      }
    }
  `,

  getRelease: `
    query getRelease($ids: [ID!]!) {
      getReleases(ids: $ids) {
        id
        title
        tracks {
          id
          title
          duration
          artists { id title }
          release { title image { src } }
        }
      }
    }
  `,

  getStream: `
    query getStream($ids: [ID!]!) {
      mediaContents(ids: $ids) {
        __typename
        ... on Track {
          id
          stream { high mid low }
        }
      }
    }
  `,
}
