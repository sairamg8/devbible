export interface Row1 { id: string; qty: number; tags: string[] }
export function total1(rows: Row1[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample1: Row1 = { id: 'r1', qty: 1, tags: ['a', 'b'] };
