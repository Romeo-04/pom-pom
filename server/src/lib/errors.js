/** Error envelope from docs/fe-be-task-assignment.md §3.6. Four codes, four statuses. */
export const CODES = Object.freeze({
  UNAVAILABLE: "UNAVAILABLE",
  VALIDATION: "VALIDATION",
  CONFLICT: "CONFLICT",
  UNAUTHORIZED: "UNAUTHORIZED",
});

const STATUS = Object.freeze({
  [CODES.VALIDATION]: 400,
  [CODES.UNAUTHORIZED]: 401,
  [CODES.CONFLICT]: 409,
  [CODES.UNAVAILABLE]: 503,
});

export class AppError extends Error {
  constructor(code, message, module) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.module = module;
    this.statusCode = STATUS[code] ?? 500;
  }

  toEnvelope() {
    return { error: { code: this.code, message: this.message, module: this.module } };
  }
}

export const unavailable = (module, message = "module unavailable") =>
  new AppError(CODES.UNAVAILABLE, message, module);
export const validation = (module, message) => new AppError(CODES.VALIDATION, message, module);
export const conflict = (module, message) => new AppError(CODES.CONFLICT, message, module);
export const unauthorized = (module, message = "missing or invalid token") =>
  new AppError(CODES.UNAUTHORIZED, message, module);
