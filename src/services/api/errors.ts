// src/services/api/errors.ts

export type AuthErrorReason = 'refresh-expired' | 'no-refresh-token';

export class AuthError extends Error {
  readonly providerId: string;
  readonly reason: AuthErrorReason;

  constructor(details: { providerId: string; reason: AuthErrorReason }) {
    super(`Auth failed for "${details.providerId}": ${details.reason}`);
    this.name = 'AuthError';
    this.providerId = details.providerId;
    this.reason = details.reason;
  }
}

export class ServerError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Server error: ${status}`);
    this.name = 'ServerError';
    this.status = status;
  }
}

export class NetworkError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super('Network error');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}
