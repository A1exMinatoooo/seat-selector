export const errorCodes = {
  unauthorized: "UNAUTHORIZED",
  forbidden: "FORBIDDEN",
  validation: "VALIDATION_ERROR",
  notFound: "NOT_FOUND",
  conflict: "SEAT_CONFLICT",
  locationRequired: "LOCATION_REQUIRED",
  deviceBound: "DEVICE_ALREADY_BOUND",
} as const;

export type ErrorCode = (typeof errorCodes)[keyof typeof errorCodes];

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
