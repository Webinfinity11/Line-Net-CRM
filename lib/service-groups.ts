import { compareNames } from "@/lib/order-utils";

export const NO_SERVICE_CATEGORY = "none";

type Categorized = { systemType: string | null };
type CatalogueEntry = Categorized & { name: string; description: string | null; subgroupId?: number | null; subgroupName?: string | null };
type Category = { key: string; name: string };

export function serviceCategoryKey(item: Categorized, labels: Record<string, string>) {
  return item.systemType && labels[item.systemType] ? item.systemType : NO_SERVICE_CATEGORY;
}

/** Keep the catalogue screen and its download on the same search/filter rules. */
export function filterServiceCatalogue<T extends CatalogueEntry>(
  items: T[], labels: Record<string, string>, filters: { q?: string; cat?: string },
) {
  const needle = filters.q?.trim().toLowerCase();
  return items.filter(item => {
    if (filters.cat && serviceCategoryKey(item, labels) !== filters.cat) return false;
    return !needle || item.name.toLowerCase().includes(needle)
      || (item.subgroupName ?? "").toLowerCase().includes(needle)
      || (item.description ?? "").toLowerCase().includes(needle)
      || (!!item.systemType && (labels[item.systemType] ?? "").toLowerCase().includes(needle));
  });
}

/** Category order follows the catalogue. Unknown/legacy categories remain visible. */
export function groupByServiceCategory<T extends Categorized>(items: T[], categories: Category[]) {
  const labels = Object.fromEntries(categories.map(c => [c.key, c.name]));
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = serviceCategoryKey(item, labels);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  const keys = [...categories.map(c => c.key), NO_SERVICE_CATEGORY];
  return [...new Set(keys)].filter(key => groups.has(key)).map(key => ({
    key,
    name: key === NO_SERVICE_CATEGORY ? "კატეგორიის გარეშე" : labels[key],
    items: groups.get(key)!,
  }));
}

export const NO_SUBGROUP = "none";
type SubgroupEntry = { name: string; subgroupId?: number | null; subgroupName?: string | null };

/** Named subgroups first, ungrouped services last; never mutate the input. */
export function compareServiceSubgroups(a: SubgroupEntry, b: SubgroupEntry) {
  const aName = a.subgroupName ?? "";
  const bName = b.subgroupName ?? "";
  return Number(!aName) - Number(!bName) || compareNames(aName, bName) || compareNames(a.name, b.name);
}

export function groupByServiceSubgroup<T extends SubgroupEntry>(items: T[]) {
  const groups = new Map<string, { key: string; name: string; items: T[] }>();
  for (const item of [...items].sort(compareServiceSubgroups)) {
    const key = item.subgroupId == null ? NO_SUBGROUP : String(item.subgroupId);
    const group = groups.get(key) ?? { key, name: item.subgroupName ?? "ქვეჯგუფის გარეშე", items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => Number(a.key === NO_SUBGROUP) - Number(b.key === NO_SUBGROUP) || compareNames(a.name, b.name));
}
