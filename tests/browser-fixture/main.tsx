import { ResultFixture } from "./result-fixture";
import { createRoot } from "react-dom/client";
import { SeatLayoutEditor } from "@/features/venues/seat-layout-editor";
import { HallLayoutPreview } from "@/features/venues/hall-layout-preview";
import { EventSeatEditor } from "@/features/events/event-seat-editor";
import { LocationCheckFields } from "@/features/events/location-check-fields";
import { SeatPicker } from "@/features/seating/seat-picker";
import { ConsecutiveSeatFlow } from "@/features/seating/consecutive-seat-flow";
import "@/app/globals.css";
const query = new URLSearchParams(location.search);
const rows = Number(query.get("rows") ?? 20);
const columns = Number(query.get("columns") ?? 30);
const centerAfterColumn = query.has("center") ? Number(query.get("center")) : null;
const statefulParticipantSeats = query.get("states") === "1";
const cells = Array.from({ length: rows }, (_, rowIndex) =>
  Array.from({ length: columns }, (_, columnIndex) => ({
    id: `${rowIndex}:${columnIndex}`,
    rowIndex,
    columnIndex,
    rowLabel: String.fromCharCode(65 + rowIndex),
    columnLabel: String(columnIndex + 1),
    kind: columnIndex === Math.floor(columns / 2) - 1 ? ("aisle" as const) : ("seat" as const),
    selectable: !(statefulParticipantSeats && rowIndex === 0 && columnIndex === 1),
    golden:
      (statefulParticipantSeats && rowIndex === 0 && columnIndex === 2) ||
      (rowIndex > 8 && rowIndex < 15 && columnIndex > 9 && columnIndex < 19),
  })),
).flat();
const occupied = statefulParticipantSeats ? ["0:0"] : [];
const available = cells
  .filter((c) => c.kind === "seat" && c.selectable && !occupied.includes(c.id))
  .map((c) => c.id);
const hall = {
  id: "hall",
  cinemaId: "cinema",
  cinemaName: "测试影院",
  hallName: "测试影厅",
  centerAfterColumn,
  seats: cells,
};
const kind = query.get("kind") ?? "preview";
const names: Record<string, string> = {
  editor: "影厅编辑",
  preview: "影厅预览",
  event: "活动座位编辑",
  picker: "单场选座",
  consecutive: "连签选座",
  "location-new": "新建活动",
  "location-edit": "编辑活动",
};
const step = {
  eventId: "event",
  eventName: "测试观影活动",
  lotteryEnabled: false,
  centerAfterColumn,
  ticketTotal: 1,
  historical: false,
  sortOrder: 0,
  tickets: [],
  confirmedAt: null,
  confirmedSeats: [],
  lotteryResults: [],
  lotteryChances: 0,
  seats: cells,
  availableSeatIds: available,
  occupiedSeatIds: occupied,
  selectedSeatIds: statefulParticipantSeats ? ["0:4"] : [],
};

const fixtureKinds: Record<string, true> = {
  success: true,
  today: true,
  "result-consecutive": true,
  "ticket-states": true,
  "records-missing": true,
  "records-empty": true,
};

createRoot(document.getElementById("root")!).render(
  fixtureKinds[kind] ? (
    <ResultFixture kind={kind} />
  ) : (
    <main style={{ maxWidth: 1100, margin: "24px auto", padding: "0 16px" }}>
    <h1>{names[kind]}</h1>
    {kind === "location-new" || kind === "location-edit" ? (
      <form data-testid="location-form">
        <LocationCheckFields
          defaultEnabled={kind === "location-edit"}
          defaultRadiusMeters={kind === "location-edit" ? 750 : 1000}
        >
          <label>
            活动地点
            <select name="locationId" defaultValue="location">
              <option value="location">测试地点</option>
            </select>
          </label>
        </LocationCheckFields>
      </form>
    ) : kind === "editor" ? (
      <SeatLayoutEditor initialLayout={{ rows, columns, centerAfterColumn, cells }} />
    ) : kind === "event" ? (
      <EventSeatEditor
        halls={[hall, { ...hall, id: "other", hallName: "偏置中线影厅", centerAfterColumn: 3 }]}
        initialHallId="hall"
        includeHallSelect
        planningToolsEnabled
      />
    ) : kind === "picker" ? (
      <SeatPicker
        code="FIXTURE"
        eventName="测试观影活动"
        seats={cells}
        initialAvailable={available}
        initialOccupied={occupied}
        initialVersion={1}
        ticketTotal={1}
        centerAfterColumn={centerAfterColumn}
        skipLocationCheck
      />
    ) : kind === "consecutive" ? (
      <ConsecutiveSeatFlow
        code="FIXTURE"
        initialView={{
          id: "workflow",
          status: "active",
          serverTime: new Date().toISOString(),
          claimedAt: new Date().toISOString(),
          hardExpiresAt: new Date(Date.now() + 300000).toISOString(),
          needsLocation: false,
          steps: [step],
        }}
      />
    ) : (
      <HallLayoutPreview cells={cells} centerAfterColumn={centerAfterColumn} />
    )}
    </main>
  )
);
