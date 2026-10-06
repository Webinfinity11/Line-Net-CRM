import { createElement as h, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NativeSelect, NativeSelectOption, NativeSelectOptGroup } from "@/components/ui/native-select";
import { describe, expect, it } from "vitest";
import { filterSelectOptions, parseSelectOptions, selectValue } from "@/lib/native-select-options";

// Compatibility components are inspected by props, never executed.
const Option = (_props: { value?: string; children?: string }) => null;
const Group = (_props: { label: string; disabled?: boolean; children?: unknown }) => null;

describe("custom select compatibility", () => {
  it("reads native server children, wrappers, fragments and numeric values in original order", () => {
    const options = parseSelectOptions([null, false, h(Fragment, null,
      h("option", { value: "" }, "აირჩიეთ"),
      h("option", { value: 12 }, "თბილისი", " (", 2, ")")),
      h(Option, { value: "b" }, "Branch"), h("option", { label: "Label" }, "implicit")]);
    expect(options.map(({ value, label }) => [value, label])).toEqual([
      ["", "აირჩიეთ"], ["12", "თბილისი (2)"], ["b", "Branch"], ["implicit", "Label"],
    ]);
  });
  it("preserves group names and inherited disabled state", () => {
    expect(parseSelectOptions([
      h("optgroup", { label: "ქსელი", disabled: true }, h("option", { value: "1" }, "კაბელი")),
      h(Group, { label: "ვიდეო" }, h(Option, { value: "2" }, "კამერა")),
    ], Group)).toEqual([
      { value: "1", label: "კაბელი", disabled: true, group: "ქსელი" },
      { value: "2", label: "კამერა", disabled: false, group: "ვიდეო" },
    ]);
  });
  it("searches Georgian including Mtavruli and Latin case-insensitively, including group names", () => {
    const options = parseSelectOptions([
      h("option", { value: "a" }, "თბილისი"), h("option", { value: "b" }, "Camera"),
      h("optgroup", { label: "ქსელი" }, h("option", { value: "c" }, "კაბელი")),
    ]);
    expect(filterSelectOptions(options, "  ᲗᲑᲘᲚᲘᲡᲘ  ").map(x => x.value)).toEqual(["a"]);
    expect(filterSelectOptions(options, "CAM").map(x => x.value)).toEqual(["b"]);
    expect(filterSelectOptions(options, "ქსელი").map(x => x.value)).toEqual(["c"]);
    expect(filterSelectOptions(options, "missing")).toEqual([]);
    expect(filterSelectOptions(options, " ")).toEqual(options);
  });
  it("uses the requested/default value or first enabled option when dependent options disappear", () => {
    const options = parseSelectOptions([
      h("option", { value: "", disabled: true }, "აირჩიეთ"),
      h("option", { value: "1" }, "ერთი"), h("option", { value: "2" }, "ორი"),
    ]);
    expect(selectValue(options, "")).toBe("");
    expect(selectValue(options, 2)).toBe("2");
    expect(selectValue(options, undefined)).toBe("1");
    expect(selectValue(options, "removed")).toBe("1");
    expect(selectValue([], "removed")).toBe("");
  });
});


describe("custom select server HTML", () => {
  it("renders the initial label and named required control without a native select", () => {
    const html = renderToStaticMarkup(h(NativeSelect, { name: "clientId", defaultValue: "2", required: true, id: "client" },
      h(NativeSelectOption, { value: "" }, "აირჩიეთ"),
      h(NativeSelectOptGroup, { label: "კლიენტები" }, h(NativeSelectOption, { value: "2" }, "თბილისი"))));
    expect(html).not.toContain("<select");
    expect(html).toContain('role="combobox"');
    expect(html).toContain('name="clientId"');
    expect(html).toContain('value="2"');
    expect(html).toContain('required=""');
    expect(html).toContain("თბილისი");
  });
  it("handles server-page plain options and disabled fields", () => {
    const html = renderToStaticMarkup(h(NativeSelect, { name: "cat", value: "a", disabled: true },
      h("option", { value: "a" }, "კატეგორია", " (", 3, ")")));
    expect(html).toContain("კატეგორია (3)");
    expect(html).toContain('disabled=""');
    expect(html).toContain('value="a"');
  });
  it("keeps empty groups empty and supports label-only options", () => {
    expect(parseSelectOptions([
      h(NativeSelectOptGroup, { label: "ცარიელი" }), h("option", { label: "label", value: "a" }),
    ], NativeSelectOptGroup)).toEqual([{ value: "a", label: "label", disabled: false }]);
  });
});
