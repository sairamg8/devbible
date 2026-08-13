export interface Row141 { id: string; qty: number; tags: string[] }
export function total141(rows: Row141[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample141: Row141 = { id: 'r141', qty: 141, tags: ['a', 'b'] };
