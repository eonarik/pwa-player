// server/src/shared/errors.js

export class AppError extends Error {
  constructor(message, status = 500, code = 'APP_ERROR') {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authorization required') {
    super(message, 401, 'AUTH_ERROR');
    this.name = 'AuthError';
  }
}

export class YandexApiError extends AppError {
  constructor(status, message) {
    super(message, status, 'YANDEX_API_ERROR');
    this.name = 'YandexApiError';
  }
}
