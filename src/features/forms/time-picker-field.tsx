"use client";

import { Clock3 } from "lucide-react";
import { useId, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
} from "react-aria-components";

const HOURS = Array.from({ length: 24 }, (_, value) => String(value).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, value) => String(value * 5).padStart(2, "0"));

export function parseTimeSelection(value?: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? "");
  if (!match) return { hour: "", minute: "" };
  const [, hour, minute] = match;
  if (Number(hour) > 23 || Number(minute) > 59) return { hour: "", minute: "" };
  return { hour, minute };
}

function selectedKey(keys: "all" | Set<React.Key>) {
  return keys === "all" ? "" : String(keys.values().next().value ?? "");
}

export function TimePickerField({
  name,
  label,
  defaultValue,
  required = false,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const initial = parseTimeSelection(defaultValue);
  const [value, setValue] = useState(
    initial.hour && initial.minute ? `${initial.hour}:${initial.minute}` : "",
  );
  const [draftHour, setDraftHour] = useState(initial.hour);
  const [draftMinute, setDraftMinute] = useState(initial.minute);
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const errorId = useId();
  const labelId = useId();

  function changeOpen(nextOpen: boolean) {
    if (nextOpen) {
      const current = parseTimeSelection(value);
      setDraftHour(current.hour);
      setDraftMinute(current.minute);
    } else if (required && !value) {
      setInvalid(true);
    }
    setOpen(nextOpen);
  }

  function commit() {
    if (!draftHour || !draftMinute) return;
    setValue(`${draftHour}:${draftMinute}`);
    setInvalid(false);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <div
      className="time-picker-field"
      role="group"
      aria-labelledby={labelId}
      aria-describedby={invalid ? errorId : undefined}
      data-invalid={invalid || undefined}
      data-open={open || undefined}
    >
      <Label id={labelId}>{label}</Label>
      <DialogTrigger isOpen={open} onOpenChange={changeOpen}>
        <Button
          ref={triggerRef}
          className="time-picker-trigger"
          aria-label={`${label}，${value || "未选择"}`}
          aria-describedby={invalid ? errorId : undefined}
        >
          <span>{value || "--:--"}</span>
          <Clock3 className="time-picker-clock" aria-hidden="true" size={18} strokeWidth={2} />
        </Button>
        <Popover className="time-picker-popover" placement="bottom end">
          <Dialog aria-label="选择时间">
            <div
              className="time-picker-dialog"
              onKeyDownCapture={(event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                event.stopPropagation();
                changeOpen(false);
              }}
            >
              <output className="time-picker-preview" aria-live="polite" aria-atomic="true">
                <span>当前选择</span>
                <strong>
                  {draftHour && draftMinute ? `${draftHour}:${draftMinute}` : "请选择小时和分钟"}
                </strong>
              </output>
              <div className="time-picker-columns">
                <div>
                  <strong>小时</strong>
                  <ListBox
                    aria-label="小时"
                    selectionMode="single"
                    selectedKeys={draftHour ? [draftHour] : []}
                    onSelectionChange={(keys) => setDraftHour(selectedKey(keys as Set<React.Key>))}
                  >
                    {HOURS.map((hour) => (
                      <ListBoxItem id={hour} key={hour} textValue={hour}>
                        {hour}
                      </ListBoxItem>
                    ))}
                  </ListBox>
                </div>
                <div>
                  <strong>分钟</strong>
                  <ListBox
                    aria-label="分钟"
                    selectionMode="single"
                    selectedKeys={draftMinute ? [draftMinute] : []}
                    onSelectionChange={(keys) =>
                      setDraftMinute(selectedKey(keys as Set<React.Key>))
                    }
                  >
                    {MINUTES.map((minute) => (
                      <ListBoxItem id={minute} key={minute} textValue={minute}>
                        {minute}
                      </ListBoxItem>
                    ))}
                  </ListBox>
                </div>
              </div>
              <Button
                className="button primary time-picker-confirm"
                isDisabled={!draftHour || !draftMinute}
                onPress={commit}
              >
                完成
              </Button>
            </div>
          </Dialog>
        </Popover>
      </DialogTrigger>
      <input
        aria-hidden="true"
        className="time-picker-native-input"
        name={name}
        value={value}
        required={required}
        aria-label={label}
        tabIndex={-1}
        autoComplete="off"
        onChange={() => undefined}
        onInvalid={(event) => {
          // Keep native submission blocked, but replace its hidden-field focus with the visible trigger.
          event.preventDefault();
          setInvalid(true);
          triggerRef.current?.focus();
        }}
      />
      <span className="field-error" id={errorId} role={invalid ? "alert" : undefined}>
        {invalid ? "请选择时间" : ""}
      </span>
    </div>
  );
}
