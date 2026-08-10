import { describe, expect, it } from "vitest";
import { assembleDailySeatRecords, shanghaiDayWindow } from "@/server/domain/daily-seat-records";

describe("Shanghai daily record window", () => {
  it("uses Shanghai midnight boundaries across the UTC date", () => {
    const beforeMidnight = shanghaiDayWindow(new Date("2026-08-07T15:59:59.999Z"));
    expect(beforeMidnight).toEqual({
      date: "2026-08-07",
      start: new Date("2026-08-06T16:00:00.000Z"),
      end: new Date("2026-08-07T16:00:00.000Z"),
    });

    const atMidnight = shanghaiDayWindow(new Date("2026-08-07T16:00:00.000Z"));
    expect(atMidnight).toEqual({
      date: "2026-08-08",
      start: new Date("2026-08-07T16:00:00.000Z"),
      end: new Date("2026-08-08T16:00:00.000Z"),
    });
  });
});

describe("daily seat record assembly", () => {
  it("groups related details and orders the newest confirmation first", () => {
    const records = assembleDailySeatRecords({
      reservations: [
        { reservationId: "older", participantId: "person-1", eventName: "午场", cinemaName: "一号影院", hallName: "一号厅", startsAt: new Date("2026-08-07T04:00:00.000Z"), confirmedAt: new Date("2026-08-07T02:00:00.000Z") },
        { reservationId: "newer", participantId: "person-2", eventName: "晚场", cinemaName: "二号影院", hallName: "二号厅", startsAt: new Date("2026-08-07T12:00:00.000Z"), confirmedAt: new Date("2026-08-07T08:00:00.000Z") },
      ],
      seats: [
        { reservationId: "older", rowLabel: "A", columnLabel: "1" },
        { reservationId: "older", rowLabel: "A", columnLabel: "2" },
        { reservationId: "newer", rowLabel: "B", columnLabel: "8" },
      ],
      tickets: [
        { participantId: "person-1", name: "普通票", quantity: 2 },
        { participantId: "person-2", name: "学生票", quantity: 1 },
      ],
      lotteryResults: [
        { participantId: "person-1", drawIndex: 0, prizeName: null },
        { participantId: "person-1", drawIndex: 1, prizeName: "海报" },
      ],
    });

    expect(records.map((record) => record.reservationId)).toEqual(["newer", "older"]);
    expect(records[1]).toMatchObject({
      seats: ["A排1座", "A排2座"],
      tickets: [{ name: "普通票", quantity: 2 }],
      lotteryResults: [{ drawIndex: 0, prizeName: null }, { drawIndex: 1, prizeName: "海报" }],
    });
    expect(records[0]?.lotteryResults).toEqual([]);
  });
});
