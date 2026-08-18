"use client";

import { parseDate } from "@internationalized/date";
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateInput,
  DatePicker,
  DateSegment,
  Dialog,
  FieldError,
  Group,
  Heading,
  I18nProvider,
  Label,
  Popover,
} from "react-aria-components";

export function DatePickerField({
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
  return (
    <I18nProvider locale="zh-CN-u-ca-gregory">
      <DatePicker
        className="date-picker-field"
        name={name}
        defaultValue={defaultValue ? parseDate(defaultValue) : null}
        granularity="day"
        isRequired={required}
        validationBehavior="native"
      >
        <Label>{label}</Label>
        <Group className="date-picker-control">
          <DateInput className="date-picker-input">
            {(segment) => <DateSegment segment={segment} className="date-picker-segment" />}
          </DateInput>
          <Button className="date-picker-button" aria-label="打开日历">
            <span aria-hidden="true">▦</span>
          </Button>
        </Group>
        <FieldError className="field-error" />
        <Popover className="date-picker-popover">
          <Dialog>
            <Calendar className="date-picker-calendar">
              <header>
                <Button slot="previous" aria-label="上个月">
                  ‹
                </Button>
                <Heading />
                <Button slot="next" aria-label="下个月">
                  ›
                </Button>
              </header>
              <CalendarGrid weekdayStyle="short">
                <CalendarGridHeader>
                  {(day) => <CalendarHeaderCell>{day}</CalendarHeaderCell>}
                </CalendarGridHeader>
                <CalendarGridBody>{(date) => <CalendarCell date={date} />}</CalendarGridBody>
              </CalendarGrid>
            </Calendar>
          </Dialog>
        </Popover>
      </DatePicker>
    </I18nProvider>
  );
}
