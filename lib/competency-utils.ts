/** Serializable competencies shared by server queries and client candidate pickers. */
export type Competencies = "all" | string[];

export function canHandle(systemType: string | null | undefined, comp: Competencies): boolean {
  return systemType == null || comp === "all" || comp.includes(systemType);
}

export function competenceLabel(comp: Competencies, systemLabels: Record<string, string>): string {
  return comp === "all" ? "ყველა" : comp.map(slug => systemLabels[slug] ?? slug).join(", ");
}
