export interface Row106 { id: string; qty: number; tags: string[] }
export function total106(rows: Row106[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample106: Row106 = { id: 'r106', qty: 106, tags: ['a', 'b'] };
