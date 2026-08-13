export interface Row39 { id: string; qty: number; tags: string[] }
export function total39(rows: Row39[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample39: Row39 = { id: 'r39', qty: 39, tags: ['a', 'b'] };
