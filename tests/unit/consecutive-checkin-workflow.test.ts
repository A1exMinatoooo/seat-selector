import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  consecutiveHardLimitMs,
  consecutiveHeartbeatIntervalMs,
  consecutiveLeaseMs,
} from "@/server/domain/consecutive-checkin-workflow";

describe("consecutive check-in workflow timing", () => {
  it("uses the agreed heartbeat, disconnect lease and hard deadline", () => {
    expect(consecutiveHeartbeatIntervalMs).toBe(5_000);
    expect(consecutiveLeaseMs).toBe(120_000);
    expect(consecutiveHardLimitMs).toBe(300_000);
  });
});
