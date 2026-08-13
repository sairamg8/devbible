export interface Row102 { id: string; qty: number; tags: string[] }
export function total102(rows: Row102[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample102: Row102 = { id: 'r102', qty: 102, tags: ['a', 'b'] };
