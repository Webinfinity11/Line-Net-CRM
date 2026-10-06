"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { CheckIcon } from "lucide-react";
import { cn } from "cn";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import { filterSelectOptions, parseSelectOptions, selectValue } from "@/lib/native-select-options";

type NativeSelectProps = Omit<React.ComponentProps<"select">, "size"> & {
  size?: "sm" | "default";
  variant?: "field" | "toolbar";
};

function NativeSelect({ children, className, size = "default", variant = "field", value, defaultValue,
  onChange, name, required, disabled, id, form, autoComplete, ...props }: NativeSelectProps) {
  const options = React.useMemo(() => parseSelectOptions(children, NativeSelectOptGroup), [children]);
  const [localValue, setLocalValue] = React.useState(() => selectValue(options, defaultValue));
  const selected = selectValue(options, value === undefined ? localValue : value);
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const menuOptions = options.flatMap(option => {
    const placeholder = option.value === "" && option.label.includes("აირჩიეთ");
    if (!placeholder) return [option];
    return selected && !required && !option.disabled
      ? [{ ...option, label: "არჩევის გასუფთავება" }]
      : [];
  });
  const visible = filterSelectOptions(menuOptions, query);

  React.useEffect(() => {
    if (value === undefined && localValue !== selected) setLocalValue(selected);
  }, [localValue, selected, value]);

  React.useEffect(() => {
    const owner = inputRef.current?.form;
    const reset = () => { if (value === undefined) setLocalValue(selectValue(options, defaultValue)); };
    owner?.addEventListener("reset", reset);
    return () => owner?.removeEventListener("reset", reset);
  }, [defaultValue, options, value]);

  function change(next: string | null) {
    const nextValue = next ?? "";
    // Existing filters call requestSubmit synchronously inside onChange.
    // Commit the successful form control before handing the event to callers.
    flushSync(() => setLocalValue(nextValue));
    if (inputRef.current) inputRef.current.value = nextValue;
    const target = { value: nextValue, name: name ?? "", form: inputRef.current?.form ?? null };
    onChange?.({ target, currentTarget: target } as React.ChangeEvent<HTMLSelectElement>);
  }

  // Native DOM-specific handlers/ref are retained in the public compatibility API;
  // the existing callers only use standard button attributes and onChange.
  const { ref: _ref, multiple: _multiple, onInvalid, ...triggerProps } = props;
  return (
    <div className={cn("group/native-select relative w-fit min-w-0 max-w-full text-[13px] max-md:min-h-[44px]", size === "sm" ? "h-[32px]" : "h-[40px]", className)} data-slot="native-select-wrapper" data-size={size}
      onInvalid={onInvalid as unknown as React.FormEventHandler<HTMLDivElement>}>
      <Select value={selected} onValueChange={change} name={name} required={required} disabled={disabled}
        id={id} form={form} autoComplete={autoComplete} inputRef={inputRef} items={options}
        onOpenChange={() => setQuery("")}>
        <SelectTrigger {...triggerProps as React.ComponentProps<typeof SelectTrigger>} id={id} size={size}
          className={cn("h-full! min-h-[inherit] w-full min-w-0 max-w-full rounded-[8px] border-input bg-transparent px-[10px] text-[length:inherit] max-md:text-[16px] motion-reduce:transition-none", variant === "toolbar" && "rounded-full border-[#dbe1ec] bg-white px-3.5 font-heading text-[12.5px] font-bold text-[#617084] hover:border-[#c9d3e3] hover:bg-[#f8faff] hover:text-[#17212b]")}>
          <SelectValue className="min-w-0 truncate">{options.find(option => option.value === selected)?.label ?? ""}</SelectValue>
        </SelectTrigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Positioner align="start" sideOffset={6} alignItemWithTrigger={false} className="z-50 max-w-[calc(100vw-16px)]">
            <SelectPrimitive.Popup className="flex max-h-[min(360px,var(--available-height))] w-[var(--anchor-width)] min-w-[180px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-[14px] border border-[#e6ebf2] bg-white p-[4px] text-[#17212b] shadow-lg outline-none">
              {menuOptions.length > 12 && <div className="shrink-0 border-b border-[#eef1f6] p-[4px]">
                <input type="search" value={query} onChange={event => setQuery(event.target.value)}
                  aria-label="სიაში ძებნა" placeholder="ძებნა…"
                  className="h-[44px] w-full min-w-0 rounded-[8px] bg-[#f1f4f9] px-[10px] text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-[#3457d5]"
                  onKeyDown={event => {
                    if (event.key === "Escape" || event.key === "Tab") return;
                    event.stopPropagation();
                    if (event.key === "Enter") event.preventDefault();
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      listRef.current?.querySelector<HTMLElement>('[role="option"]:not([data-disabled])')?.focus();
                    }
                  }} />
              </div>}
              <SelectPrimitive.List ref={listRef} className="min-h-0 overflow-y-auto overscroll-contain">
                {visible.map((option, index) => <React.Fragment key={option.value}>
                  {option.group !== undefined && option.group !== visible[index - 1]?.group &&
                    <div className="px-[10px] pb-[4px] pt-[12px] text-[12px] text-[#617084]">{option.group}</div>}
                  <SelectPrimitive.Item value={option.value} disabled={option.disabled}
                    className="relative flex min-h-[36px] cursor-pointer items-center rounded-[8px] py-[8px] pr-[34px] pl-[10px] text-[13px] outline-none data-highlighted:bg-[#f1f4f9] data-selected:bg-[#eef2ff] data-disabled:pointer-events-none data-disabled:opacity-50 max-md:min-h-[44px] max-md:text-[16px]">
                    <SelectPrimitive.ItemText className="min-w-0 break-words [overflow-wrap:anywhere]">{option.label}</SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator className="absolute right-[10px] text-[#3457d5]"><CheckIcon className="size-[16px]" /></SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                </React.Fragment>)}
                {visible.length === 0 && <div role="status" className="p-[12px] text-[13px] text-[#617084]">ვერ მოიძებნა</div>}
              </SelectPrimitive.List>
            </SelectPrimitive.Popup>
          </SelectPrimitive.Positioner>
        </SelectPrimitive.Portal>
      </Select>
    </div>
  );
}

function NativeSelectOption(props: React.ComponentProps<"option">) { return <option {...props} />; }
function NativeSelectOptGroup(props: React.ComponentProps<"optgroup">) { return <optgroup {...props} />; }
export { NativeSelect, NativeSelectOption, NativeSelectOptGroup };
