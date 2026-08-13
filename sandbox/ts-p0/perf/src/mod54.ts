export interface Row54 { id: string; qty: number; tags: string[] }
export function total54(rows: Row54[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample54: Row54 = { id: 'r54', qty: 54, tags: ['a', 'b'] };
