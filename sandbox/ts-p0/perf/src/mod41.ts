export interface Row41 { id: string; qty: number; tags: string[] }
export function total41(rows: Row41[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample41: Row41 = { id: 'r41', qty: 41, tags: ['a', 'b'] };
