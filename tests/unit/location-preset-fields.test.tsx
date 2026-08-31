// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocationPresetCreateForm } from "@/features/locations/location-preset-create-form";
import { LocationPresetFields } from "@/features/locations/location-preset-fields";

const actions = vi.hoisted(() => ({
  createLocationAction: vi.fn(),
  importAppleMapsLocationAction: vi.fn(),
}));

vi.mock("@/app/(admin)/admin/locations/actions", () => actions);
vi.mock("@/features/admin/admin-toast", () => ({ useAdminActionToast: vi.fn() }));

const initialValues = {
  name: "原地点",
  latitude: 31.2304,
  longitude: 121.4737,
  defaultRadiusMeters: 1000,
};

function valueOf(label: string): string {
  return (screen.getByLabelText(label) as HTMLInputElement).value;
}

beforeEach(() => {
  actions.createLocationAction.mockReset();
  actions.importAppleMapsLocationAction.mockReset();
});

afterEach(cleanup);

describe("LocationPresetFields", () => {
  it("imports coordinates and a name, then keeps every field editable", async () => {
    const user = userEvent.setup();
    actions.importAppleMapsLocationAction.mockResolvedValue({
      status: "success",
      code: "APPLE_MAPS_LOCATION_IMPORTED",
      message: "坐标已从 GCJ-02 转换为 WGS-84。",
      name: "Apple 地图影城",
      nameNotice: null,
      latitude: "22.5267893",
      longitude: "113.9648171",
      conversion: "gcj02-to-wgs84",
    });
    render(
      <form>
        <LocationPresetFields initialValues={initialValues} />
      </form>,
    );

    await user.type(screen.getByLabelText("Apple 地图分享链接"), "https://maps.apple.com/place");
    await user.click(screen.getByRole("button", { name: "导入 Apple 地图" }));

    await waitFor(() => expect(valueOf("地点名称")).toBe("Apple 地图影城"));
    expect(valueOf("纬度")).toBe("22.5267893");
    expect(valueOf("经度")).toBe("113.9648171");
    expect(screen.getByRole("status").textContent).toContain("GCJ-02 转换为 WGS-84");

    await user.clear(screen.getByLabelText("地点名称"));
    await user.type(screen.getByLabelText("地点名称"), "人工复核名称");
    await user.clear(screen.getByLabelText("纬度"));
    await user.type(screen.getByLabelText("纬度"), "22.5");
    expect(valueOf("地点名称")).toBe("人工复核名称");
    expect(valueOf("纬度")).toBe("22.5");
  });

  it("preserves all fields on failure", async () => {
    const user = userEvent.setup();
    actions.importAppleMapsLocationAction.mockResolvedValue({
      status: "error",
      code: "INVALID_APPLE_MAPS_COORDINATE",
      message: "链接中的坐标格式或范围无效。",
    });
    render(
      <form>
        <LocationPresetFields initialValues={initialValues} />
      </form>,
    );

    await user.type(screen.getByLabelText("Apple 地图分享链接"), "https://maps.apple.com/place");
    await user.click(screen.getByRole("button", { name: "导入 Apple 地图" }));

    expect((await screen.findByRole("alert")).textContent).toContain("坐标格式或范围无效");
    expect(valueOf("地点名称")).toBe("原地点");
    expect(valueOf("纬度")).toBe("31.2304");
    expect(valueOf("经度")).toBe("121.4737");
  });

  it("imports coordinates but preserves the current name when no usable name exists", async () => {
    const user = userEvent.setup();
    actions.importAppleMapsLocationAction.mockResolvedValue({
      status: "success",
      code: "APPLE_MAPS_LOCATION_IMPORTED",
      message: "坐标位于转换范围外，已按 WGS-84 原样导入。",
      name: null,
      nameNotice: "too-long",
      latitude: "35.6812000",
      longitude: "139.7671000",
      conversion: "unchanged",
    });
    render(
      <form>
        <LocationPresetFields initialValues={initialValues} />
      </form>,
    );

    await user.type(screen.getByLabelText("Apple 地图分享链接"), "https://maps.apple.com/place");
    await user.click(screen.getByRole("button", { name: "导入 Apple 地图" }));

    expect((await screen.findByRole("status")).textContent).toContain("名称超过 80 个字符");
    expect(valueOf("地点名称")).toBe("原地点");
    expect(valueOf("纬度")).toBe("35.6812000");
    expect(valueOf("经度")).toBe("139.7671000");
  });
});

describe("LocationPresetCreateForm", () => {
  it("resets manual and temporary import fields after a successful create", async () => {
    const user = userEvent.setup();
    actions.createLocationAction.mockResolvedValue({
      status: "success",
      message: "地点已保存。",
      submission: 123,
      code: "LOCATION_CREATED",
      resetKey: 123,
    });
    render(<LocationPresetCreateForm />);

    await user.type(screen.getByLabelText("Apple 地图分享链接"), "https://maps.apple.com/place");
    await user.type(screen.getByLabelText("地点名称"), "新地点");
    await user.type(screen.getByLabelText("纬度"), "31.2");
    await user.type(screen.getByLabelText("经度"), "121.4");
    await user.click(screen.getByRole("button", { name: "保存地点" }));

    await waitFor(() => expect(actions.createLocationAction).toHaveBeenCalledOnce());
    await waitFor(() => expect(valueOf("地点名称")).toBe(""));
    expect(valueOf("Apple 地图分享链接")).toBe("");
    expect(valueOf("纬度")).toBe("");
    expect(valueOf("经度")).toBe("");
    expect(valueOf("默认范围（米）")).toBe("1000");
  });
});
