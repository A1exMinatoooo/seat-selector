import { describe, expect, it } from "vitest";
import { DomainError, errorCodes } from "@/shared/errors";

describe("DomainError", () => {
  it("preserves stable public error codes", () => {
    const error = new DomainError(errorCodes.validation, "invalid");
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(errorCodes.eventConflict).toBe("EVENT_CONFLICT");
  });
});
