export function allAssigneesDone(people: { doneAt: unknown }[]) { return people.length > 0 && people.every(p => Boolean(p.doneAt)); }
export function assigneeStage(person: { doneAt: unknown; userId: string }, visits: { userId: string }[]) { return person.doneAt ? "ჩააბარა" : visits.some(v => v.userId === person.userId) ? "მუშაობს" : "დანიშნული"; }
export const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };
export function comparePriority(a: { priority: keyof typeof PRIORITY_RANK }, b: { priority: keyof typeof PRIORITY_RANK }) { return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]; }
