export interface Row192 { id: string; qty: number; tags: string[] }
export function total192(rows: Row192[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample192: Row192 = { id: 'r192', qty: 192, tags: ['a', 'b'] };
