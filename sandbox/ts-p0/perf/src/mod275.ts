export interface Row275 { id: string; qty: number; tags: string[] }
export function total275(rows: Row275[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample275: Row275 = { id: 'r275', qty: 275, tags: ['a', 'b'] };
