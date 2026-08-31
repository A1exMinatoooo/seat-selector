// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  ConsecutiveCheckinFields,
  type ConsecutiveTargetOption,
} from "@/features/events/consecutive-checkin-fields";

const candidates: ConsecutiveTargetOption[] = [
  { id: "event-2", name: "第二场", startsAtLabel: "2026/8/31 14:00:00", status: "open" },
];

afterEach(cleanup);

function checkbox(name: string | RegExp) {
  return screen.getByRole<HTMLInputElement>("checkbox", { name });
}

describe("ConsecutiveCheckinFields", () => {
  it("adopts the persisted enabled selection after a successful rerender", () => {
    const view = render(
      <form>
        <ConsecutiveCheckinFields initialTargetIds={[]} candidates={candidates} />
      </form>,
    );

    fireEvent.click(checkbox("开启同日连续签到"));
    fireEvent.click(checkbox(/第二场/));
    view.container.querySelector("form")?.reset();
    view.rerender(
      <form>
        <ConsecutiveCheckinFields initialTargetIds={["event-2"]} candidates={candidates} />
      </form>,
    );

    expect(checkbox("开启同日连续签到").checked).toBe(true);
    expect(checkbox(/第二场/).checked).toBe(true);
    expect(view.container.querySelector<HTMLInputElement>('input[name="targetEventIds"]')?.value)
      .toBe('["event-2"]');
  });

  it("adopts the persisted disabled state after a successful rerender", () => {
    const view = render(
      <ConsecutiveCheckinFields initialTargetIds={["event-2"]} candidates={candidates} />,
    );

    fireEvent.click(checkbox("开启同日连续签到"));
    view.rerender(<ConsecutiveCheckinFields initialTargetIds={[]} candidates={candidates} />);

    expect(checkbox("开启同日连续签到").checked).toBe(false);
    expect(screen.queryByRole("checkbox", { name: /第二场/ })).toBeNull();
  });

  it("does not discard edits when only the persisted id order changes", () => {
    const moreCandidates = [
      ...candidates,
      { id: "event-3", name: "第三场", startsAtLabel: "2026/8/31 16:00:00", status: "draft" as const },
    ];
    const view = render(
      <ConsecutiveCheckinFields
        initialTargetIds={["event-2", "event-3"]}
        candidates={moreCandidates}
      />,
    );
    fireEvent.click(checkbox(/第三场/));

    view.rerender(
      <ConsecutiveCheckinFields
        initialTargetIds={["event-3", "event-2"]}
        candidates={moreCandidates}
      />,
    );

    expect(checkbox(/第三场/).checked).toBe(false);
  });
});
