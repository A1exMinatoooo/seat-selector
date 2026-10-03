"use client";

import { useId, useState, useTransition } from "react";
import {
  importAppleMapsLocationAction,
  type AppleMapsLocationImportState,
} from "@/app/(admin)/admin/locations/actions";
import { NumericInput } from "@/features/forms/numeric-input";

type LocationPresetValues = {
  name: string;
  latitude: number;
  longitude: number;
  defaultRadiusMeters: number;
};

type ImportFeedback = Pick<AppleMapsLocationImportState, "status" | "message" | "fieldErrors">;

export function LocationPresetFields({ initialValues }: { initialValues?: LocationPresetValues }) {
  const appleMapsUrlId = useId();
  const feedbackId = useId();
  const [appleMapsUrl, setAppleMapsUrl] = useState("");
  const [name, setName] = useState(initialValues?.name ?? "");
  const [latitude, setLatitude] = useState(initialValues ? String(initialValues.latitude) : "");
  const [longitude, setLongitude] = useState(initialValues ? String(initialValues.longitude) : "");
  const [defaultRadiusMeters, setDefaultRadiusMeters] = useState(
    String(initialValues?.defaultRadiusMeters ?? 1000),
  );
  const [feedback, setFeedback] = useState<ImportFeedback | null>(null);
  const [pending, startTransition] = useTransition();

  function importLocation() {
    startTransition(async () => {
      try {
        const result = await importAppleMapsLocationAction(appleMapsUrl);
        if (result.status === "error") {
          setFeedback(result);
          return;
        }
        setLatitude(result.latitude);
        setLongitude(result.longitude);
        if (result.name) setName(result.name);
        const nameNotice =
          result.nameNotice === "missing"
            ? " 链接中未找到地点名称，已保留当前名称。"
            : result.nameNotice === "too-long"
              ? " Apple 地图地点名称超过 80 个字符，已保留当前名称。"
              : "";
        setFeedback({ status: "success", message: `${result.message}${nameNotice}` });
      } catch {
        setFeedback({
          status: "error",
          message: "地点导入失败，请刷新页面后重试。",
          fieldErrors: { appleMapsUrl: "无法读取地图链接，请检查后重试。" },
        });
      }
    });
  }

  return (
    <>
      <div className="apple-maps-import">
        <label htmlFor={appleMapsUrlId}>Apple 地图分享链接</label>
        <div className="apple-maps-import-control">
          <input
            id={appleMapsUrlId}
            type="url"
            value={appleMapsUrl}
            maxLength={4096}
            aria-invalid={
              feedback?.status === "error" && feedback.fieldErrors?.appleMapsUrl
                ? true
                : undefined
            }
            aria-describedby={feedback ? feedbackId : undefined}
            placeholder="https://maps.apple.com/place?..."
            onChange={(event) => {
              setAppleMapsUrl(event.target.value);
              setFeedback(null);
            }}
          />
          <button
            className="button"
            type="button"
            disabled={pending || !appleMapsUrl.trim()}
            onClick={importLocation}
          >
            {pending ? "正在导入…" : "导入 Apple 地图"}
          </button>
        </div>
        <span className="muted">仅支持完整的 Apple 地图分享链接，最多 4096 个字符。</span>
        {feedback ? (
          <p
            id={feedbackId}
            className={`apple-maps-import-feedback ${feedback.status}`}
            role={feedback.status === "error" ? "alert" : "status"}
          >
            {feedback.message}
          </p>
        ) : null}
      </div>
      <label>
        地点名称
        <input
          name="name"
          aria-label="地点名称"
          aria-describedby={`${appleMapsUrlId}-name-help`}
          required
          maxLength={80}
          value={name}
          placeholder="例如：上海影城正门"
          onChange={(event) => setName(event.target.value)}
        />
        <span className="muted" id={`${appleMapsUrlId}-name-help`}>最多 80 个字符。</span>
      </label>
      <div className="form-row">
        <label>
          纬度
          <NumericInput
            name="latitude"
            aria-label="纬度"
            aria-describedby={`${appleMapsUrlId}-latitude-help`}
            step="any"
            min={-90}
            max={90}
            draftValue={latitude}
            placeholder="31.2304"
            onDraftValueChange={setLatitude}
          />
          <span className="muted" id={`${appleMapsUrlId}-latitude-help`}>范围为 -90 至 90。</span>
        </label>
        <label>
          经度
          <NumericInput
            name="longitude"
            step="any"
            aria-label="经度"
            aria-describedby={`${appleMapsUrlId}-longitude-help`}
            min={-180}
            max={180}
            draftValue={longitude}
            placeholder="121.4737"
            onDraftValueChange={setLongitude}
          />
          <span className="muted" id={`${appleMapsUrlId}-longitude-help`}>范围为 -180 至 180。</span>
        </label>
      </div>
      <label>
        默认范围（米）
        <NumericInput
          name="defaultRadiusMeters"
          aria-label="默认范围（米）"
          aria-describedby={`${appleMapsUrlId}-radius-help`}
          min={50}
          max={100000}
          draftValue={defaultRadiusMeters}
          onDraftValueChange={setDefaultRadiusMeters}
        />
        <span className="muted" id={`${appleMapsUrlId}-radius-help`}>范围为 50–100000 米。</span>
      </label>
    </>
  );
}
