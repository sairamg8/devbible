export interface Row260 { id: string; qty: number; tags: string[] }
export function total260(rows: Row260[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample260: Row260 = { id: 'r260', qty: 260, tags: ['a', 'b'] };
