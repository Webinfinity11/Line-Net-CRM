"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dateAllowed, formatFieldDate, joinDateTime, MONTHS_KA, monthGrid, parseDate, shiftMonth, tbilisiDate, TIME_OPTIONS, validTime, WEEKDAYS_KA } from "@/lib/date-field";

type FieldProps = {
  value?: string;
  defaultValue?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  className?: string;
  "aria-label"?: string;
};
const fieldStyle = "flex h-[40px] min-w-0 w-full items-center gap-[8px] rounded-[8px] border border-[#dbe1ec] bg-white px-[10px] text-[13px] text-[#17212b] outline-none focus-visible:ring-2 focus-visible:ring-[#3457d5] disabled:opacity-50 max-md:min-h-[44px] max-md:text-[16px]";
const choiceStyle = "flex h-[44px] min-w-0 items-center justify-center rounded-[8px] text-[13px] outline-none hover:bg-[#f1f4f9] focus-visible:ring-2 focus-visible:ring-[#3457d5] disabled:opacity-30 disabled:pointer-events-none";
const popupStyle = "w-[332px] max-w-[calc(100vw-16px)] max-h-[var(--available-height)] overflow-y-auto rounded-[14px] border border-[#e6ebf2] bg-white p-[10px] text-[#17212b] shadow-lg";

function useField(props: FieldProps) {
  const [local, setLocal] = useState(props.defaultValue ?? "");
  const input = useRef<HTMLInputElement>(null);
  const value = props.value ?? local;
  useEffect(() => {
    const form = input.current?.form;
    const reset = () => { if (props.value === undefined) setLocal(props.defaultValue ?? ""); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [props.value, props.defaultValue]);
  function change(next: string) {
    flushSync(() => setLocal(next));
    if (input.current) input.current.value = next;
    props.onChange?.(next);
  }
  return { value, change, input };
}

export function DateField(props: FieldProps & { iconOnly?: boolean }) {
  const { value, change, input } = useField(props);
  const [open, setOpen] = useState(false);
  // Current day is read only when opened, avoiding a server/client midnight mismatch.
  const [today, setToday] = useState("");
  const [month, setMonth] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const valid = !value || dateAllowed(value, props.min, props.max);
  function openChange(next: boolean) {
    if (next) {
      const day = tbilisiDate();
      setToday(day);
      setMonth(parseDate(value) ? value : day);
    }
    setOpen(next);
  }
  function select(day: string) { change(day); setOpen(false); }
  useEffect(() => {
    input.current?.setCustomValidity(valid ? "" : "აირჩიეთ დასაშვები თარიღი");
  }, [valid, input]);
  const monthDate = parseDate(month);
  return <div className={cn("relative min-w-0", props.iconOnly && "w-[44px]", props.className)}>
    <input type="hidden" name={props.name} value={value} disabled={props.disabled} />
    {/* Hidden inputs do not participate in constraint validation. This focusable
        proxy validates the field and redirects invalid focus to its trigger. */}
    <input ref={input} type="text" tabIndex={-1} aria-label={props["aria-label"] ?? "თარიღი"}
      className="pointer-events-none absolute bottom-0 left-0 h-px w-px opacity-0" value={value} onChange={() => {}}
      required={props.required} disabled={props.disabled}
      onInvalid={event => { event.preventDefault(); trigger.current?.focus(); openChange(true); }} />
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger ref={trigger} id={props.id} disabled={props.disabled} aria-label={props["aria-label"] ?? (props.iconOnly ? "თარიღის არჩევა" : undefined)}
        className={cn(fieldStyle, "h-full min-h-[40px]", props.iconOnly && "justify-center px-0")}>
        <CalendarDays className="size-[16px] shrink-0 text-[#617084]" />
        {!props.iconOnly && <span className="truncate">{formatFieldDate(value) || "თარიღი"}</span>}
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className={popupStyle}>
        <div className="grid grid-cols-[44px_1fr_44px] items-center">
          <button type="button" aria-label="წინა თვე" className={choiceStyle} onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft className="size-[18px]" /></button>
          <span aria-live="polite" className="text-center text-[14px] font-medium">{monthDate && `${MONTHS_KA[monthDate.getUTCMonth()]} ${monthDate.getUTCFullYear()}`}</span>
          <button type="button" aria-label="შემდეგი თვე" className={choiceStyle} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight className="size-[18px]" /></button>
        </div>
        <div className="grid grid-cols-7">
          {WEEKDAYS_KA.map(day => <span key={day} className="py-[8px] text-center text-[11px] text-[#617084]">{day}</span>)}
          {monthGrid(month).map(day => <button key={day} type="button" aria-label={formatFieldDate(day)} aria-pressed={day === value} aria-current={day === today ? "date" : undefined}
            disabled={!dateAllowed(day, props.min, props.max)}
            className={cn(choiceStyle, day.slice(0, 7) !== month.slice(0, 7) && "text-[#8b98a9]", day === today && "ring-1 ring-inset ring-[#3457d5]", day === value && "bg-[#3457d5] text-white hover:bg-[#2846b7]")}
            onClick={() => select(day)}>{Number(day.slice(8))}</button>)}
        </div>
        <div className="flex justify-between border-t border-[#eef1f6] pt-[4px]">
          <button type="button" className={cn(choiceStyle, "px-[12px] text-[#3457d5]")} disabled={!dateAllowed(today, props.min, props.max)} onClick={() => select(today)}>დღეს</button>
          {!props.iconOnly && <button type="button" className={cn(choiceStyle, "px-[12px] text-[#617084]")} onClick={() => select("")}>გასუფთავება</button>}
        </div>
      </PopoverContent>
    </Popover>
  </div>;
}

export function TimeField(props: FieldProps) {
  const { value, change, input } = useField(props);
  const [open, setOpen] = useState(false);
  return <div className={cn("relative min-w-0", props.className)}>
    <input type="hidden" name={props.name} value={validTime(value) ? value : ""} disabled={props.disabled} />
    <div className={cn(fieldStyle, "h-full min-h-[40px] p-0")}>
      <input ref={input} id={props.id} type="text" inputMode="text" placeholder="სს:წწ" value={value}
        onChange={event => change(event.target.value)} required={props.required} disabled={props.disabled}
        pattern="([01][0-9]|2[0-3]):[0-5][0-9]" title="საათი:წუთი (მაგ. 09:30)" aria-label={props["aria-label"] ?? "დრო"}
        className="h-full min-h-[40px] w-full min-w-0 rounded-[8px] bg-transparent pl-[10px] outline-none focus-visible:ring-2 focus-visible:ring-[#3457d5] max-md:min-h-[44px]" />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger disabled={props.disabled} aria-label="დროის არჩევა" className="flex size-[44px] shrink-0 items-center justify-center rounded-[8px] text-[#617084] outline-none focus-visible:ring-2 focus-visible:ring-[#3457d5]"><Clock className="size-[16px]" /></PopoverTrigger>
        <PopoverContent align="end" sideOffset={6} className={cn(popupStyle, "w-[264px] max-h-[min(320px,var(--available-height))]")}>
          <div className="grid grid-cols-3 gap-[4px]">
            {TIME_OPTIONS.map(time => <button type="button" key={time} aria-pressed={value === time}
              className={cn(choiceStyle, value === time && "bg-[#3457d5] text-white hover:bg-[#2846b7]")}
              onClick={() => { change(time); setOpen(false); }}>{time}</button>)}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  </div>;
}

export function DateTimeField(props: FieldProps) {
  const { value, change, input } = useField(props);
  const [date = "", time = ""] = value.split("T");
  return <div className={cn("grid min-w-0 grid-cols-[minmax(0,1fr)_120px] gap-[8px]", props.className)}>
    <input ref={input} type="hidden" name={props.name} value={joinDateTime(date, time)} disabled={props.disabled} />
    <DateField id={props.id} value={date} onChange={next => change(next ? `${next}T${time}` : "")}
      required={props.required || !!time} disabled={props.disabled} min={props.min?.slice(0, 10)} max={props.max?.slice(0, 10)} aria-label={props["aria-label"]} />
    <TimeField value={time} onChange={next => change(date || next ? `${date}T${next}` : "")} required={props.required || !!date} disabled={props.disabled} />
  </div>;
}
