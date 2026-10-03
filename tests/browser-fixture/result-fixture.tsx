import { ConsecutiveResultView } from "@/features/seating/consecutive-seat-flow";
import { ReservationTicket } from "@/features/seating/reservation-ticket";
import { SuccessView } from "@/features/seating/success-view";
import { TodayRecordsView } from "@/features/records/today-records-view";
import type { ConsecutiveWorkflowView } from "@/server/domain/consecutive-checkin-workflow";
import type { DailySeatRecord } from "@/server/domain/daily-seat-records";

const localFixtureDate = "2026-08-07";
const localTime = (time: string) => `2026-08-07T${time.length === 2 ? `${time}:00:00` : time.length === 5 ? `${time}:00` : time}.000Z`;
const seats = ["A排1座", "A排2座"];
const mixedResults = [
  { drawIndex: 0, prizeName: null },
  { drawIndex: 1, prizeName: "海报" },
];
const statesResults = [
  { drawIndex: 0, prizeName: "电影主题限定纪念礼盒（含角色海报、收藏徽章及纪念明信片）" },
  { drawIndex: 1, prizeName: "海报" },
];
const longLabel = "电影主题限定纪念礼盒（含角色海报、收藏徽章及纪念明信片）";
const longSeats = Array.from({ length: 6 }, (_, index) => `A排${index + 1}座`);
const records: DailySeatRecord[] = [
  {
    reservationId: "evening",
    eventName: "晚场",
    cinemaName: "二号影院",
    hallName: "二号厅",
    startsAt: localTime("12"),
    confirmedAt: localTime("08"),
    seats: ["B排8座"],
    tickets: [{ name: "学生票", quantity: 1 }],
    lotteryResults: [],
  },
  {
    reservationId: "noon",
    eventName: "午场",
    cinemaName: "一号影院",
    hallName: "一号厅",
    startsAt: localTime("04"),
    confirmedAt: localTime("02"),
    seats,
    tickets: [{ name: "普通票", quantity: 2 }],
    lotteryResults: mixedResults,
  },
];

const consecutiveView: ConsecutiveWorkflowView = {
  id: "fixture-workflow",
  status: "completed",
  serverTime: localTime("08:02:18"),
  claimedAt: localTime("08"),
  hardExpiresAt: localTime("08:05"),
  needsLocation: false,
  steps: [
    {
      eventId: "first",
      eventName: "连续首场",
      lotteryEnabled: true,
      centerAfterColumn: null,
      ticketTotal: 2,
      historical: false,
      sortOrder: 0,
      tickets: [{ name: "普通票", quantity: 2, lotteryEligible: true }],
      confirmedAt: localTime("08"),
      confirmedSeats: seats,
      lotteryResults: mixedResults,
      lotteryChances: 2,
      seats: [],
      availableSeatIds: [],
      occupiedSeatIds: [],
      selectedSeatIds: [],
    },
    {
      eventId: "second",
      eventName: "连续后场",
      lotteryEnabled: false,
      centerAfterColumn: null,
      ticketTotal: 1,
      historical: true,
      sortOrder: 1,
      tickets: [{ name: "学生票", quantity: 1, lotteryEligible: false }],
      confirmedAt: localTime("07"),
      confirmedSeats: ["B排8座"],
      lotteryResults: [],
      lotteryChances: 0,
      seats: [],
      availableSeatIds: [],
      occupiedSeatIds: [],
      selectedSeatIds: [],
    },
  ],
};

export function ResultFixture({ kind }: { kind: string }) {
  const long = new URLSearchParams(location.search).get("long") === "1";
  if (kind === "success") {
    return <SuccessView
      code="FIXTURE"
      eventName={long ? `${longLabel} · 夏日特别放映活动完整名称` : "午场"}
      phoneLast4="9002"
      confirmedAt={localTime("02")}
      serverTime={localTime("02:02:18")}
      seats={long ? longSeats : seats}
      tickets={[{ name: long ? `${longLabel} · 普通票` : "普通票", quantity: long ? 6 : 2, lotteryEligible: true }]}
      lotteryEnabled
      initialLotteryResults={long ? statesResults : mixedResults}
      showTodayRecordsLink
    />;
  }
  if (kind === "today") {
    return <TodayRecordsView date={localFixtureDate} devicePresent records={records} />;
  }
  if (kind === "records-missing" || kind === "records-empty") {
    return <TodayRecordsView date={localFixtureDate} devicePresent={kind === "records-empty"} records={[]} />;
  }
  if (kind === "result-consecutive") return <ConsecutiveResultView view={consecutiveView} />;
  if (kind === "ticket-states") {
    return <main className="success-page ticket-states-fixture">
      <ReservationTicket eventName={longLabel} seats={longSeats} tickets={[{ name: "普通票", quantity: 6 }]} lotteryResults={statesResults} confirmedAt={localTime("02")} compact />
      <ReservationTicket eventName="两次未中奖" seats={seats} tickets={[{ name: "普通票", quantity: 2 }]} lotteryResults={mixedResults.map((result) => ({ ...result, prizeName: null }))} confirmedAt={localTime("02")} compact />
      <ReservationTicket eventName="不参与抽奖" seats={["B排8座"]} tickets={[{ name: "学生票", quantity: 1 }]} lotteryResults={[]} confirmedAt={localTime("02")} compact />
    </main>;
  }
  return null;
}
