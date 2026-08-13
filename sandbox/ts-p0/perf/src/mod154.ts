export interface Row154 { id: string; qty: number; tags: string[] }
export function total154(rows: Row154[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample154: Row154 = { id: 'r154', qty: 154, tags: ['a', 'b'] };
