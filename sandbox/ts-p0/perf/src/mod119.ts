export interface Row119 { id: string; qty: number; tags: string[] }
export function total119(rows: Row119[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample119: Row119 = { id: 'r119', qty: 119, tags: ['a', 'b'] };
