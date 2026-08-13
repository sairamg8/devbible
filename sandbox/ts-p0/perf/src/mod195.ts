export interface Row195 { id: string; qty: number; tags: string[] }
export function total195(rows: Row195[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample195: Row195 = { id: 'r195', qty: 195, tags: ['a', 'b'] };
