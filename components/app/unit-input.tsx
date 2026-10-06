"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { flushSync } from "react-dom";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { UNITS } from "@/lib/units";

const OTHER = "__other__";
type UnitInputProps = Pick<ComponentProps<typeof Input>,
  "name" | "defaultValue" | "aria-label" | "className" | "id" | "disabled" | "form"
> & { formRow?: boolean; label?: string };

export function UnitInput({ name, defaultValue, className, id, disabled, form, formRow, label, "aria-label": ariaLabel }: UnitInputProps) {
  const initialValue = String(defaultValue ?? "") || "ცალი";
  const initialSelection = UNITS.includes(initialValue) ? initialValue : OTHER;
  const [selection, setSelection] = useState(initialSelection);
  const [customValue, setCustomValue] = useState(initialSelection === OTHER ? initialValue : "");
  const hiddenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const owner = hiddenRef.current?.form;
    const reset = () => {
      flushSync(() => {
        setSelection(initialSelection);
        setCustomValue(initialSelection === OTHER ? initialValue : "");
      });
    };
    owner?.addEventListener("reset", reset);
    return () => owner?.removeEventListener("reset", reset);
  }, [initialSelection, initialValue, form]);

  const customInput = selection === OTHER && (
    <label className={cn("grid min-w-0 gap-1 text-[12px] leading-4 text-muted-foreground", formRow && "order-last col-span-full")}>
      ჩაწერეთ საზომი ერთეული
      <Input value={customValue} onChange={(event) => setCustomValue(event.target.value)}
        aria-label="სხვა საზომი ერთეული" disabled={disabled} form={form}
        required maxLength={30} autoFocus placeholder="მაგ. ლიტრი"
        className="h-11 w-full text-[16px] sm:text-[13px]" />
    </label>
  );

  return (<>
    <div className={cn("grid min-w-0 gap-[8px]", className, "h-auto!")}>
      <input ref={hiddenRef} type="hidden" name={name} form={form} disabled={disabled}
        value={selection === OTHER ? customValue : selection} />
      <label className="grid min-w-0 gap-1">
      {label && <span className="text-[12px] leading-4 text-muted-foreground">{label}</span>}
      <NativeSelect id={id} aria-label={ariaLabel} disabled={disabled} form={form}
        value={selection} onChange={(event) => setSelection(event.target.value)}
        className="h-11 w-full text-[length:inherit]">
        {UNITS.map((unit) => <NativeSelectOption key={unit} value={unit}>{unit}</NativeSelectOption>)}
        <NativeSelectOption value={OTHER}>სხვა…</NativeSelectOption>
      </NativeSelect>
      </label>
      {!formRow && customInput}
    </div>
    {formRow && customInput}
    </>
  );
}
