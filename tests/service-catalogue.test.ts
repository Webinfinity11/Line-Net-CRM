import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Evaluate the actual pure declarations without loading server actions, React or the database.
// Keep helpers private in their existing files; no test-only server-action exports.
function declaration(path: string, name: string) {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
  for (const node of source.statements) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) return node.getText(source);
    if (ts.isVariableStatement(node)) {
      const found = node.declarationList.declarations.find((d) => d.name.getText(source) === name);
      if (found) return `const ${found.getText(source)};`;
    }
  }
  throw new Error(`Missing ${name} in ${path}`);
}

function evaluate(source: string, result: string, dependencies: Record<string, unknown>) {
  const js = ts.transpileModule(`${source}\nreturn ${result};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return new Function(...Object.keys(dependencies), js)(...Object.values(dependencies));
}

const knownSystem = vi.fn(async (slug: string) => ["first", "second", "third"].includes(slug));
const systemSlug = evaluate(declaration("lib/systems.ts", "systemSlug"), "systemSlug", { z, isKnownSystem: knownSystem });
const subgroupBelongs = vi.fn(async (id: number, slug: string) => id === 7 && slug === "second");
const serviceInput = evaluate(
  ["emptyToNull", "serviceInput"].map((name) => declaration("actions/services.ts", name)).join("\n"),
  "serviceInput", { z, systemSlug, subgroupBelongs },
) as z.ZodType;

describe("service category validation (shared by create and update)", () => {
  const valid = { name: "სერვისი", price: "10", description: "", systemType: "second" };
  it.each([undefined, null, "", "   "])("requires a category for %s", async (systemType) => {
    knownSystem.mockClear();
    const result = await serviceInput.safeParseAsync({ ...valid, systemType });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("აირჩიეთ კატეგორია");
    expect(knownSystem).not.toHaveBeenCalled();
  });
  it("checks valid slugs asynchronously and trims input", async () => {
    const result = await serviceInput.safeParseAsync({ ...valid, systemType: " second " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toMatchObject({ systemType: "second" });
    expect(knownSystem).toHaveBeenCalledWith("second");
  });
  it.each([undefined, "", null])("keeps subgroup optional for %s", async subgroupId => {
    const result = await serviceInput.safeParseAsync({ ...valid, subgroupId });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toMatchObject({ subgroupId: null });
  });
  it("accepts a subgroup of the selected category", async () => {
    const result = await serviceInput.safeParseAsync({ ...valid, subgroupId: "7" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toMatchObject({ subgroupId: 7 });
  });
  it.each(["8", "99"])("rejects missing or foreign subgroup %s", async subgroupId => {
    const result = await serviceInput.safeParseAsync({ ...valid, subgroupId });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("ქვეჯგუფი სხვა კატეგორიისაა");
  });
  it.each(["0", "-1", "1.5", "abc"])("rejects invalid subgroup id %s", async subgroupId => {
    expect((await serviceInput.safeParseAsync({ ...valid, subgroupId })).success).toBe(false);
  });
  it("rejects unknown categories", async () => {
    const result = await serviceInput.safeParseAsync({ ...valid, systemType: "missing" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("კატეგორია ვერ მოიძებნა");
  });
});

type Item = { id: number; systemType: string | null };
type Category = { key: string; name: string };
const categoryGroups = evaluate(
  declaration("components/app/order-detail/services.tsx", "categoryGroups"), "categoryGroups", {},
) as (items: Item[], categories: Category[], preferred?: string | null) => { key: string; items: Item[] }[];
const categories = ["first", "second", "third"].map((key) => ({ key, name: key }));
const items = ["third", null, "second", "first", "second", "unknown"].map((systemType, id) => ({ id, systemType }));

describe("order service groups", () => {
  it("puts the order category first and preserves other groups and item order", () => {
    const result = categoryGroups(items, categories, "second");
    expect(result.map((g) => g.key)).toEqual(["second", "first", "third", ""]);
    expect(result[0].items.map((i) => i.id)).toEqual([2, 4]);
    expect(result[3].items.map((i) => i.id)).toEqual([1, 5]);
    expect(items.map((i) => i.id)).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it.each([undefined, null, "", "unknown", "first"])("preserves category order for %s", (preferred) => {
    expect(categoryGroups(items, categories, preferred).map((g) => g.key)).toEqual(["first", "second", "third", ""]);
  });
  it("does not create an empty group for an order category without services", () => {
    expect(categoryGroups(items.filter((i) => i.systemType !== "second"), categories, "second").map((g) => g.key))
      .toEqual(["first", "third", ""]);
    expect(categoryGroups([], categories, "second")).toEqual([]);
  });
});
