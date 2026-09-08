// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LocationCheckFields } from "@/features/events/location-check-fields";

afterEach(cleanup);

describe("location check fields", () => {
  it("defaults a new event to disabled while retaining and submitting its radius", () => {
    const { container } = render(
      <form>
        <LocationCheckFields>
          <label>
            活动地点
            <select name="locationId" defaultValue="venue">
              <option value="venue">测试地点</option>
            </select>
          </label>
        </LocationCheckFields>
      </form>,
    );
    const toggle = screen.getByRole<HTMLInputElement>("checkbox", {
      name: "开启活动定位检查",
    });
    const radius = screen.getByRole<HTMLInputElement>("spinbutton", { hidden: true });

    expect(toggle.checked).toBe(false);
    expect(radius.closest("label")?.hasAttribute("hidden")).toBe(true);
    expect(new FormData(container.querySelector("form")!).get("radiusMeters")).toBe("1000");
    expect(new FormData(container.querySelector("form")!).has("locationCheckEnabled")).toBe(false);

    fireEvent.click(toggle);
    expect(radius.closest("label")?.hasAttribute("hidden")).toBe(false);
    fireEvent.change(radius, { target: { value: "2500" } });
    fireEvent.click(toggle);

    expect(radius.value).toBe("2500");
    expect(new FormData(container.querySelector("form")!).get("radiusMeters")).toBe("2500");
  });

  it("shows an enabled event with its saved radius", () => {
    render(
      <form>
        <LocationCheckFields defaultEnabled defaultRadiusMeters={750}>
          <span>地点</span>
        </LocationCheckFields>
      </form>,
    );

    expect(screen.getByRole<HTMLInputElement>("checkbox").checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>("spinbutton").value).toBe("750");
  });
});
