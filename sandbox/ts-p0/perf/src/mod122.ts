export interface Row122 { id: string; qty: number; tags: string[] }
export function total122(rows: Row122[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample122: Row122 = { id: 'r122', qty: 122, tags: ['a', 'b'] };
