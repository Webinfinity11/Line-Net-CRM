import { Children, Fragment, isValidElement, type ElementType, type ReactNode } from "react";

export type SelectOption = { value: string; label: string; disabled: boolean; group?: string };

type OptionProps = { value?: string | number; label?: string; disabled?: boolean; children?: ReactNode };

function textContent(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement<{ children?: ReactNode }>(child)
    ? textContent(child.props.children) : String(child)).join("");
}

/** Reads props only: native elements and the compatibility components work alike. */
export function parseSelectOptions(children: ReactNode, groupType?: ElementType): SelectOption[] {
  const result: SelectOption[] = [];
  function visit(nodes: ReactNode, group?: string, disabled = false) {
    Children.forEach(nodes, child => {
      if (!isValidElement<OptionProps>(child)) return;
      const props = child.props;
      if (child.type === Fragment) return visit(props.children, group, disabled);
      const isGroup = child.type === "optgroup" || child.type === groupType;
      if (isGroup) return visit(props.children, props.label, disabled || !!props.disabled);
      const text = textContent(props.children);
      result.push({ value: String(props.value ?? text), label: props.label ?? text,
        disabled: disabled || !!props.disabled, ...(group !== undefined ? { group } : {}) });
    });
  }
  visit(children);
  return result;
}

export function filterSelectOptions(options: SelectOption[], query: string): SelectOption[] {
  const search = query.trim().toLowerCase();
  return options.filter(option => `${option.label} ${option.group ?? ""}`.toLowerCase().includes(search));
}

export function selectValue(options: SelectOption[], value: unknown): string {
  const requested = value == null ? undefined : String(value);
  return options.find(option => option.value === requested)?.value ?? options.find(option => !option.disabled)?.value ?? "";
}
