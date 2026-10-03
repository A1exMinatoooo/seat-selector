import { useState } from "react";
import { DatePickerField } from "@/features/forms/date-picker-field";
import { TimePickerField } from "@/features/forms/time-picker-field";
import { NumericInput } from "@/features/forms/numeric-input";
import { SelectField, SearchableSelectField } from "@/features/forms/select-field";

const options = [
  { id: "Shanghai", label: "Asia/Shanghai" },
  { id: "Tokyo", label: "Asia/Tokyo" },
  { id: "long", label: "用于检查完整换行的超长选项名称：影院、影厅与活动地点均应清晰可读" },
];

export function FormFixture() {
  const [submitted, setSubmitted] = useState("");
  return (
    <main className="admin-shell">
      <h1 style={{ fontSize: 32, letterSpacing: "-.02em" }}>表单控件验收</h1>
      <form
        className="panel stack-form"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))));
        }}
      >
        <div className="form-row">
          <label>
            活动名称
            <input name="name" placeholder="例如：八月特别观影会" />
          </label>
          <SearchableSelectField
            name="zone"
            label="显示时区"
            options={options}
            defaultValue="Shanghai"
            required
          />
          <DatePickerField name="date" label="开始日期" defaultValue="2026-10-03" required />
          <TimePickerField name="time" label="开始时间" required />
          <SelectField name="location" label="活动地点" options={options} defaultValue="long" />
          <label>
            票数
            <NumericInput name="quantity" min={1} max={20} defaultValue={2} />
          </label>
          <SearchableSelectField
            label="不可编辑时区"
            options={options}
            defaultValue="Shanghai"
            disabled
          />
          <SelectField label="不可编辑地点" options={options} defaultValue="Shanghai" disabled />
          <label>
            只读内容
            <input readOnly value="已确认的活动信息" />
          </label>
          <label>
            禁用内容
            <input disabled value="当前不可编辑" />
          </label>
          <label>
            导入文件
            <input type="file" name="file" accept=".csv" />
          </label>
          <label>
            备注
            <textarea name="notes" placeholder="补充活动说明" />
          </label>
        </div>
        <label className="switch-label">
          <input type="checkbox" name="enabled" />
          <span className="switch-control" aria-hidden="true" />
          开启活动定位检查
        </label>
        <fieldset className="consecutive-targets">
          <legend>后续场次</legend>
          <div className="consecutive-target-list">
            <label>
              <input type="checkbox" name="next" />
              <span>
                连续后场<small>已配置的活动</small>
              </span>
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>参与方式</legend>
          <div className="segmented-control">
            <label>
              <input type="radio" name="mode" value="onsite" defaultChecked />
              <span>现场发行</span>
            </label>
            <label>
              <input type="radio" name="mode" value="preregistered" />
              <span>预录参与者</span>
            </label>
          </div>
        </fieldset>
        <button className="button primary" type="submit">
          提交验收表单
        </button>
        <output aria-label="提交结果">{submitted}</output>
      </form>
    </main>
  );
}
