export interface Row37 { id: string; qty: number; tags: string[] }
export function total37(rows: Row37[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample37: Row37 = { id: 'r37', qty: 37, tags: ['a', 'b'] };
