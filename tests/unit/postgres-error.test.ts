import { describe, expect, it } from "vitest";
import { postgresErrorInfo } from "@/shared/postgres-error";

describe("PostgreSQL error extraction", () => {
  it("reads a constraint error wrapped by the query layer", () => {
    const error = new Error("query failed", { cause: { code: "23505", constraint: "reservation_seats_event_seat_uidx" } });
    expect(postgresErrorInfo(error)).toEqual({ code: "23505", constraint: "reservation_seats_event_seat_uidx" });
  });

  it("returns an empty code for unrelated failures", () => {
    expect(postgresErrorInfo(new Error("network failed"))).toEqual({ code: "" });
  });
});
