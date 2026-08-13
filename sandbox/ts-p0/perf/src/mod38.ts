export interface Row38 { id: string; qty: number; tags: string[] }
export function total38(rows: Row38[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample38: Row38 = { id: 'r38', qty: 38, tags: ['a', 'b'] };
