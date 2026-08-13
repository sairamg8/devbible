export interface Row14 { id: string; qty: number; tags: string[] }
export function total14(rows: Row14[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample14: Row14 = { id: 'r14', qty: 14, tags: ['a', 'b'] };
