export interface Row247 { id: string; qty: number; tags: string[] }
export function total247(rows: Row247[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample247: Row247 = { id: 'r247', qty: 247, tags: ['a', 'b'] };
