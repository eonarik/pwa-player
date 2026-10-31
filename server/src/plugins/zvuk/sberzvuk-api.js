// server/src/plugins/zvuk/sberzvuk-api.js

import axios from 'axios';
import { QUERIES } from './graphql-queries.js';

export var Quality;
(function (Quality) {
  Quality[(Quality['High'] = 0)] = 'High';
  Quality[(Quality['Middle'] = 1)] = 'Middle';
})(Quality || (Quality = {}));

const RETRY_DELAYS_MS = [5000, 10000, 15000];

export class RateLimitError extends Error {
  constructor() {
    super('Zvuk rate limit (418/429)');
    this.name = 'RateLimitError';
    this.status = 429;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ZvukAPI {
  constructor(token, axiosOptions = {}) {
    if (typeof token !== 'string' || token.length === 0) {
      throw new Error('A token is required but not provided!');
    }
    this.token = token;
    this.client = axios.create({
      ...axiosOptions,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        Origin: 'https://zvuk.com',
        Referer: 'https://zvuk.com/',
        'Content-Type': 'application/json',
        'X-Auth-Token': this.token,
        ...axiosOptions.headers,
      },
    });
  }

  async quickSearch(query, limit = 10) {
    const variables = { query, limit, tracks: true };
    const data = await this.execute('getSearchAll', variables);
    return data?.search?.tracks?.items || [];
  }

  async getStreamURL(trackId, quality) {
    const ids = Array.isArray(trackId) ? trackId : [trackId];
    const data = await this.execute('getStream', { ids });

    return data.mediaContents.map((param) => {
      const stream = param.stream;
      if (quality === Quality.High) {
        if (!stream.high) {
          throw new ReferenceError("The high quality of the track is missing! Perhaps you don't have a subscription?");
        }
        return stream.high;
      } else if (quality === Quality.Middle) {
        return stream.mid;
      } else {
        return stream.high ?? stream.mid;
      }
    });
  }

  async getTrack(id, withArtists = false, withAlbum = false) {
    const ids = Array.isArray(id) ? id : [id];
    const data = await this.execute('getFullTrack', {
      withReleases: withAlbum,
      withArtists: withArtists,
      ids,
    });
    return data.getTracks;
  }

  async execute(operationName, variables) {
    const query = QUERIES[operationName];
    if (!query) throw new Error(`Unknown operation: ${operationName}`);

    const cleanQuery = query.replace(/\s+/g, ' ').trim();
    const url = 'https://zvuk.com/api/v1/graphql';

    let attempt = 0;

    while (true) {
      try {
        const response = await this.client.post(url, {
          operationName,
          variables,
          query: cleanQuery,
        });

        if (response.data.errors) {
          console.error(`[zvuk] GraphQL Error for ${operationName}:`, JSON.stringify(response.data.errors, null, 2));
          throw new Error(response.data.errors[0].message);
        }
        return response.data.data;
      } catch (err) {
        const status = err.response?.status;

        if (status === 418 || status === 429) {
          const delay = RETRY_DELAYS_MS[attempt];
          attempt++;

          if (delay === undefined) {
            console.warn(
              `[zvuk] anti-bot ${status} for ${operationName}: retries exhausted after ${RETRY_DELAYS_MS.length} attempts`,
            );
            throw new RateLimitError();
          }

          console.warn(
            `[zvuk] anti-bot ${status} for ${operationName}: retry ${attempt}/${RETRY_DELAYS_MS.length} in ${delay}ms`,
          );
          await sleep(delay);
          continue;
        }

        if (err.response?.data?.errors) {
          console.error(`[zvuk] GraphQL Error Response:`, JSON.stringify(err.response.data.errors, null, 2));
        }
        throw err;
      }
    }
  }

  static async getAnonymousToken() {
    const response = await axios.get('https://zvuk.com/api/tiny/profile', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
      },
    });
    return response.data.result.token;
  }
}
