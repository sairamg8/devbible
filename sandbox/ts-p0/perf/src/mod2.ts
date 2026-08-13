export interface Row2 { id: string; qty: number; tags: string[] }
export function total2(rows: Row2[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample2: Row2 = { id: 'r2', qty: 2, tags: ['a', 'b'] };
