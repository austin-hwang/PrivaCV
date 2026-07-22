"use client";

import * as React from "react";
import { type CalendarDate, getLocalTimeZone, parseDate } from "@internationalized/date";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger } from "@/components/ui/popover";

/** Parse an ISO "YYYY-MM-DD" string into a CalendarDate, or null when empty/invalid. */
function toCalendarDate(value: string): CalendarDate | null {
  if (!value) return null;
  try {
    return parseDate(value);
  } catch {
    return null;
  }
}

const dateFormat: Intl.DateTimeFormatOptions = { dateStyle: "medium" };
const dateTimeFormat: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };

type TriggerProps = {
  id?: string;
  "aria-label"?: string;
  isDisabled?: boolean;
  className?: string;
};

/**
 * Date picker built on the shadcn react-aria Calendar. Takes and emits an ISO
 * "YYYY-MM-DD" string so it drops into form state that used a native date input.
 */
function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  ...trigger
}: TriggerProps & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = toCalendarDate(value);

  return (
    <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        aria-label={trigger["aria-label"]}
        id={trigger.id}
        isDisabled={trigger.isDisabled}
        className={cn(
          "w-full justify-start font-normal",
          !selected && "text-muted-foreground",
          className,
        )}
      >
        <CalendarIcon data-icon="inline-start" />
        {selected
          ? selected.toDate(getLocalTimeZone()).toLocaleDateString(undefined, dateFormat)
          : placeholder}
      </Button>
      <Popover className="w-auto p-0" placement="bottom start">
        <Calendar
          value={selected}
          onChange={(date) => {
            onChange(date ? date.toString() : "");
            setOpen(false);
          }}
        />
      </Popover>
    </PopoverTrigger>
  );
}

/**
 * Date + time picker: the shadcn Calendar for the day plus a time field. Takes
 * and emits a "YYYY-MM-DDTHH:mm" value, matching an <input type="datetime-local">.
 */
function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date & time",
  className,
  ...trigger
}: TriggerProps & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [datePart, timePart] = value ? value.split("T") : ["", ""];
  const selected = toCalendarDate(datePart);
  const time = timePart?.slice(0, 5) ?? "";

  const emit = (nextDate: string, nextTime: string) => {
    if (!nextDate) {
      onChange("");
      return;
    }
    onChange(`${nextDate}T${nextTime || "09:00"}`);
  };

  return (
    <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        aria-label={trigger["aria-label"]}
        id={trigger.id}
        isDisabled={trigger.isDisabled}
        className={cn(
          "w-full justify-start font-normal",
          !selected && "text-muted-foreground",
          className,
        )}
      >
        <CalendarIcon data-icon="inline-start" />
        {selected ? new Date(value).toLocaleString(undefined, dateTimeFormat) : placeholder}
      </Button>
      <Popover className="w-auto p-0" placement="bottom start">
        <Calendar value={selected} onChange={(date) => emit(date ? date.toString() : "", time)} />
        <div className="flex items-center gap-2 border-t p-2.5">
          <label htmlFor="date-time-picker-time" className="text-sm text-muted-foreground">
            Time
          </label>
          <Input
            id="date-time-picker-time"
            type="time"
            className="h-9 w-auto flex-1"
            value={time}
            disabled={!selected}
            onChange={(event) => emit(datePart, event.target.value)}
          />
        </div>
      </Popover>
    </PopoverTrigger>
  );
}

export { DatePicker, DateTimePicker };
