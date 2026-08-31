export const errorCodes = {
  unauthorized: "UNAUTHORIZED",
  forbidden: "FORBIDDEN",
  validation: "VALIDATION_ERROR",
  notFound: "NOT_FOUND",
  conflict: "SEAT_CONFLICT",
  eventConflict: "EVENT_CONFLICT",
  locationRequired: "LOCATION_REQUIRED",
  deviceBound: "DEVICE_ALREADY_BOUND",
  identityMismatch: "IDENTITY_MISMATCH",
  identityCandidateInvalid: "IDENTITY_CANDIDATE_INVALID",
  lotteryUnavailable: "LOTTERY_UNAVAILABLE",
  ticketIssueExpired: "TICKET_ISSUE_EXPIRED",
  ticketIssueClaimed: "TICKET_ISSUE_CLAIMED",
  ticketIssueCapacity: "TICKET_ISSUE_CAPACITY_EXCEEDED",
  ticketIssueSelectionExists: "TICKET_ISSUE_SELECTION_EXISTS",
  consecutiveWorkflowActive: "CONSECUTIVE_WORKFLOW_ACTIVE",
  consecutiveWorkflowExpired: "CONSECUTIVE_WORKFLOW_EXPIRED",
  consecutiveWorkflowUnavailable: "CONSECUTIVE_WORKFLOW_UNAVAILABLE",
  consecutiveSeatHeld: "CONSECUTIVE_SEAT_HELD",
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
